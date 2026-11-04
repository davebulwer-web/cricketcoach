// Ball-by-ball match simulation for three formats:
//   T20   20 overs a side, max 4 overs per bowler
//   OD50  50 overs a side, max 10 overs per bowler
//   FC    four-day first-class match: two innings each, 96 overs a day,
//         declarations, the follow-on, and a draw if time runs out
//
// Pure game logic with no drawing, so it can be tested on its own:
//   const m = CC.Match.create({ home, away, format: 'FC', humanSide: 0 });
//   m.doToss(); m.chooseToss(true /* bat first */);
//   while (!m.result) {
//     if (m.pendingFollowOn) m.chooseFollowOn(true);
//     if (m.needsBowler()) m.setBowler(i);
//     m.bowlBall();
//   }
//
// The human captains one side (`humanSide`, an index into [home, away]).
// The computer makes the same choices for the other side. m.simulate()
// lets the computer play both sides for a while ("sim to end of day").
(function (root) {
  const CC = root.CC = root.CC || {};

  const FIELDS = ['ATTACK', 'NORMAL', 'DEFEND'];
  const AGGRESSION = ['ATTACK', 'NORMAL', 'DEFEND'];

  // Base chance of each outcome on a single delivery, before modifiers, per format.
  //   T20:  a 20-over innings averages roughly 155 for 6
  //   OD50: a 50-over innings averages roughly 265 for 8
  //   FC:   about 3.2 runs an over and an all-out total near 300
  const BASE = {
    T20:  { dot: 0.35, 1: 0.35, 2: 0.08, 3: 0.012, 4: 0.115, 6: 0.04, W: 0.04, wide: 0.03, nb: 0.006 },
    OD50: { dot: 0.44, 1: 0.34, 2: 0.075, 3: 0.012, 4: 0.085, 6: 0.022, W: 0.022, wide: 0.022, nb: 0.004 },
    FC:   { dot: 0.67, 1: 0.19, 2: 0.048, 3: 0.012, 4: 0.056, 6: 0.004, W: 0.0115, wide: 0.006, nb: 0.006 },
  };

  const FORMATS = {
    T20:  { name: 'T20', overs: 20, limited: true },
    OD50: { name: '50 OVER', overs: 50, limited: true },
    FC:   { name: 'FOUR-DAY', limited: false, days: 4, oversPerDay: 96, sessionsPerDay: 3, followOn: 150 },
  };

  // Multipliers on the base chances for each captain choice.
  const AGG_MOD = {
    ATTACK: { dot: 0.8,  1: 0.95, 2: 1.0, 4: 1.4,  6: 1.9,  W: 1.55 },
    NORMAL: {},
    DEFEND: { dot: 1.3,  1: 1.05, 2: 0.9, 4: 0.55, 6: 0.35, W: 0.6 },
  };
  const FIELD_MOD = {
    ATTACK: { dot: 0.95, 1: 0.85, 2: 1.0, 4: 1.45, 6: 1.15, W: 1.2 },
    NORMAL: {},
    DEFEND: { dot: 0.85, 1: 1.25, 2: 1.25, 4: 0.65, 6: 0.8, W: 0.75 },
  };

  function makeRng(seed) {
    if (seed === undefined) return Math.random;
    let s = seed >>> 0;
    return function () { // mulberry32
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, weights) {
    let total = 0;
    for (const k in weights) total += weights[k];
    let r = rng() * total;
    for (const k in weights) { r -= weights[k]; if (r <= 0) return k; }
    return Object.keys(weights)[0];
  }

  function create(opts) {
    const teams = [opts.home, opts.away];
    const format = FORMATS[opts.format || 'T20'];
    if (!format) throw new Error('Unknown format ' + opts.format);
    const limited = format.limited;
    const overs = limited ? opts.overs || format.overs : null;
    const bpo = opts.ballsPerOver || 6;
    const humanSide = opts.humanSide === undefined ? 0 : opts.humanSide;
    const rng = makeRng(opts.seed);
    const maxOversPerBowler = limited ? Math.ceil(overs / 5) : Infinity;
    const base = BASE[opts.format || 'T20'];
    const days = format.days || 0;
    const ballsPerDay = (format.oversPerDay || 0) * bpo;
    // FC: English weather. Some days lose overs to rain; the match ends when
    // all the remaining overs have been bowled.
    const rainOvers = [];
    for (let d = 0; d < days; d++) {
      const r = rng();
      rainOvers.push(opts.noRain ? 0 : r < 0.18 ? 10 + Math.floor(rng() * 40) : r < 0.24 && d > 0 ? 96 : 0);
    }
    const dayBalls = rainOvers.map(lost => ballsPerDay - lost * bpo);
    const matchBalls = dayBalls.reduce((a, b) => a + b, 0);   // FC: when time runs out

    const m = {
      teams, format: opts.format || 'T20', formatName: format.name, limited,
      overs, ballsPerOver: bpo, humanSide, maxOversPerBowler, days,
      tossWinner: null,
      rainOvers,           // FC: overs lost to rain on each day
      totalBalls: 0,       // legal balls bowled in the whole match (FC uses it for the clock)
      pendingFollowOn: false, // FC: the side that batted first must decide on the follow-on
      followOn: false,     // FC: the follow-on was enforced
      autopilot: false,    // the computer is making the human's choices too (m.simulate)
      innings: [],
      cur: -1,             // index of the current innings
      field: 'NORMAL',     // fielding side's setting
      aggression: 'NORMAL',// batting side's setting
      result: null,
      log: [],             // every ball event, newest last
    };

    function newInnings(battingSide) {
      const bat = teams[battingSide], bowl = teams[1 - battingSide];
      return {
        battingSide,
        bowlingSide: 1 - battingSide,
        runs: 0, wkts: 0, balls: 0,
        extras: { wides: 0, noballs: 0, byes: 0 },
        batters: bat.players.map(() => ({ runs: 0, balls: 0, fours: 0, sixes: 0, out: null, batted: false })),
        bowlers: bowl.players.map(() => ({ balls: 0, runs: 0, wkts: 0, maidens: 0 })),
        fow: [],
        striker: 0, nonStriker: 1, nextIn: 2,
        bowler: null, lastOverBowler: null,
        overRuns: 0, overBalls: 0,
        target: null,
        done: false,
        declared: false,
        overBowlers: [],   // who bowled each completed over (for tiredness in FC)
        at110: null,       // FC: score after 110 overs, used for bonus points
      };
    }

    // --- Toss -------------------------------------------------------------

    m.doToss = function () {
      m.tossWinner = rng() < 0.5 ? 0 : 1;
      return m.tossWinner;
    };

    // The toss winner decides. For the computer, call with no argument.
    m.chooseToss = function (batFirst) {
      if (batFirst === undefined) batFirst = rng() < 0.5;
      const battingSide = batFirst ? m.tossWinner : 1 - m.tossWinner;
      startInnings(battingSide);
      return battingSide;
    };

    // Total runs a side has scored across its innings so far.
    function totalFor(side) {
      return m.innings.filter(i => i.battingSide === side).reduce((a, i) => a + i.runs, 0);
    }
    m.totalFor = totalFor;

    function startInnings(battingSide) {
      const inn = newInnings(battingSide);
      inn.batters[0].batted = inn.batters[1].batted = true;
      const lastInnings = limited ? m.innings.length === 1 : m.innings.length === 3;
      if (lastInnings) inn.target = totalFor(1 - battingSide) - totalFor(battingSide) + 1;
      m.innings.push(inn);
      m.cur = m.innings.length - 1;
      m.field = 'NORMAL';
      m.aggression = 'NORMAL';
    }

    // --- Queries ----------------------------------------------------------

    m.current = function () { return m.innings[m.cur]; };
    m.battingTeam = function () { return teams[m.current().battingSide]; };
    m.bowlingTeam = function () { return teams[m.current().bowlingSide]; };
    m.humanBatting = function () { return m.current().battingSide === humanSide; };
    m.humanBowling = function () { return m.current().bowlingSide === humanSide; };
    m.oversText = function (inn) {
      inn = inn || m.current();
      return Math.floor(inn.balls / bpo) + '.' + (inn.balls % bpo);
    };
    m.runRate = function (inn) {
      inn = inn || m.current();
      return inn.balls ? inn.runs * bpo / inn.balls : 0;
    };
    // Balls the batting side has left: in the innings (limited overs) or in the match (FC).
    m.ballsLeft = function () { return limited ? overs * bpo - m.current().balls : Math.max(0, matchBalls - m.totalBalls); };
    m.isHuman = function (side) { return side === humanSide && !m.autopilot; };

    // FC: the day (1-4) and session (1-3) of play.
    m.clock = function () {
      if (limited) return null;
      let b = Math.min(m.totalBalls, Math.max(0, matchBalls - 1)), day = 0;
      while (day < days - 1 && b >= dayBalls[day]) { b -= dayBalls[day]; day++; }
      const perSession = dayBalls[day] / format.sessionsPerDay;
      const session = perSession ? Math.min(format.sessionsPerDay, Math.floor(b / perSession) + 1) : 1;
      return {
        day: day + 1, session, rain: rainOvers[day],
        oversLeftToday: Math.ceil((dayBalls[day] - b) / bpo),
        ballsLeftInSession: Math.ceil(perSession * session) - b,
      };
    };

    // FC: how far the batting side is ahead (+) or behind (-) on runs.
    m.lead = function () {
      const inn = m.current();
      return totalFor(inn.battingSide) - totalFor(inn.bowlingSide);
    };

    // FC: may the batting side declare now? (Not in the fourth innings.)
    m.canDeclare = function () {
      return !limited && !m.result && !m.pendingFollowOn && m.cur >= 0 && m.cur < 3 && !m.current().done;
    };
    m.requiredRate = function () {
      const inn = m.current();
      if (!inn.target) return null;
      const left = m.ballsLeft();
      return left ? (inn.target - inn.runs) * bpo / left : Infinity;
    };
    m.bowlerOvers = function (stats) { return Math.floor(stats.balls / bpo) + (stats.balls % bpo ? '.' + stats.balls % bpo : ''); };

    m.needsBowler = function () {
      const inn = m.current();
      return !m.result && !inn.done && inn.bowler === null;
    };

    m.eligibleBowlers = function () {
      const inn = m.current();
      const team = m.bowlingTeam();
      const list = [];
      team.players.forEach((p, i) => {
        if (i === inn.lastOverBowler) return;
        if (inn.bowlers[i].balls >= maxOversPerBowler * bpo) return;
        list.push(i);
      });
      return list;
    };

    m.setBowler = function (i) {
      if (m.eligibleBowlers().indexOf(i) < 0) throw new Error('Bowler not eligible');
      m.current().bowler = i;
    };

    m.setField = function (f) { if (FIELDS.indexOf(f) >= 0) m.field = f; };
    m.setAggression = function (a) { if (AGGRESSION.indexOf(a) >= 0) m.aggression = a; };

    // FC: close the current innings.
    m.declare = function () {
      if (!m.canDeclare()) throw new Error('Cannot declare now');
      const inn = m.current();
      inn.declared = true;
      endInnings(inn);
    };

    // FC: the side that batted first decides whether to make the other side follow on.
    m.chooseFollowOn = function (enforce) {
      if (!m.pendingFollowOn) throw new Error('No follow-on to decide');
      m.pendingFollowOn = false;
      m.followOn = !!enforce;
      startInnings(enforce ? m.innings[1].battingSide : m.innings[0].battingSide);
    };

    // Let the computer play both sides until stop() is true (checked before
    // each ball) or the match ends. Returns the events played. The computer
    // only declares the human's innings when opts.declare is true.
    m.simulate = function (stop, opts) {
      const was = m.autopilot;
      m.autopilot = true;
      m.autoDeclare = !opts || opts.declare !== false;
      const played = [];
      try {
        while (!m.result) {
          if (stop && stop(m)) break;
          if (m.pendingFollowOn) cpuFollowOn();
          played.push(m.bowlBall());
        }
      } finally {
        m.autopilot = was;
      }
      return played;
    };

    // --- Computer captain -------------------------------------------------

    // FC: overs a bowler has bowled out of the last 16, a measure of tiredness.
    function recentOvers(inn, i) {
      return inn.overBowlers.slice(-16).filter(b => b === i).length;
    }
    m.recentOvers = function (i) { return recentOvers(m.current(), i); };

    function cpuPickBowler() {
      const inn = m.current();
      const team = m.bowlingTeam();
      const eligible = m.eligibleBowlers();
      // Prefer real bowlers, saving some overs from the best for the end.
      const oversDone = Math.floor(inn.balls / bpo);
      let best = null, bestScore = -Infinity;
      eligible.forEach(i => {
        const p = team.players[i];
        const used = inn.bowlers[i].balls / bpo;
        let score = p.bowl + rng() * 15;
        if (!p.style) score -= 40;
        if (limited) {
          if (oversDone < overs - 4 && used >= maxOversPerBowler - 1) score -= 15; // save a death over
        } else {
          score -= recentOvers(inn, i) * 6;                          // rest tired bowlers
          if (p.style === 'SPIN' && inn.balls < 20 * bpo) score -= 10; // seam with the new ball
        }
        if (score > bestScore) { bestScore = score; best = i; }
      });
      return best;
    }

    // FC: should the batting side declare? Checked at the end of each over.
    function cpuShouldDeclare() {
      const inn = m.current();
      const lead = m.lead();
      const left = m.ballsLeft() / bpo;            // overs left in the match
      if (m.cur === 0) return inn.runs >= 550 || (inn.runs >= 450 && left < 230);
      if (m.cur === 1) return lead >= 200 && left < 200;
      if (m.cur === 2) {
        // Set a target: enough runs to be safe, enough time to bowl them out.
        if (left < 35 || lead <= 0) return false;
        return lead >= left * 3.8 || (lead >= left * 3.2 && left <= 80) || lead >= 500;
      }
      return false;
    }

    function cpuFollowOn() {
      // Enforce unless the bowlers have had a very long first innings.
      const second = m.innings[1];
      m.chooseFollowOn(second.balls < 110 * bpo || m.ballsLeft() > 150 * bpo);
    }

    function cpuFieldFC() {
      const inn = m.current();
      const over = Math.floor(inn.balls / bpo);
      if (m.cur === 3) {
        const need = inn.target - inn.runs, left = m.ballsLeft();
        if (need > left * 0.75) return 'ATTACK';   // they can't win: go for wickets
        return need < left * 0.4 ? 'DEFEND' : 'NORMAL';
      }
      if (over < 15 || inn.wkts >= 7) return 'ATTACK';
      return 'NORMAL';
    }

    function cpuAggressionFC() {
      const inn = m.current();
      const left = m.ballsLeft();
      if (m.cur === 3) {
        const need = inn.target - inn.runs;
        if (need > left * 0.7 || (inn.wkts >= 6 && need > left * 0.5)) return 'DEFEND'; // bat for the draw
        return need > left * 0.55 ? 'ATTACK' : 'NORMAL';
      }
      if (m.cur === 2 && m.lead() > 150 && left < 160 * bpo) return 'ATTACK';   // quick runs before declaring
      if (m.lead() < 0 && left < 60 * bpo) return 'DEFEND';                     // saving the game
      return 'NORMAL';
    }

    function cpuField() {
      if (!limited) return cpuFieldFC();
      const inn = m.current();
      const over = Math.floor(inn.balls / bpo);
      if (inn.target) {
        const rrr = m.requiredRate();
        if (rrr > 11) return 'ATTACK';
        if (rrr < 6) return 'DEFEND';
      }
      if (over < 6) return 'ATTACK';
      if (over >= overs - 4) return 'DEFEND';
      return inn.wkts >= 6 ? 'ATTACK' : 'NORMAL';
    }

    function cpuAggression() {
      if (!limited) return cpuAggressionFC();
      const inn = m.current();
      const over = Math.floor(inn.balls / bpo);
      const late = over >= overs - 3;
      if (inn.target) {
        const need = inn.target - inn.runs, left = m.ballsLeft();
        if (need > left * 1.6) return 'ATTACK';            // way behind: swing
        if (left <= 18) return need > left * 0.9 ? 'ATTACK' : need <= left * 0.5 ? 'DEFEND' : 'NORMAL';
        if (inn.wkts >= 7) return 'DEFEND';
        return need > left * 1.3 ? 'ATTACK' : 'NORMAL';
      }
      if (late) return 'ATTACK';
      if (inn.wkts >= 6) return 'DEFEND';
      return over >= overs - 6 ? 'ATTACK' : 'NORMAL';
    }

    // Fill in any choices the computer is responsible for.
    m.autoChoices = function () {
      if (m.result) return;
      if (m.pendingFollowOn) {
        if (m.isHuman(m.innings[0].battingSide)) return;
        cpuFollowOn();
      }
      if (!m.isHuman(m.current().bowlingSide)) {
        if (m.needsBowler()) m.setBowler(cpuPickBowler());
        m.field = cpuField();
      }
      if (!m.isHuman(m.current().battingSide)) m.aggression = cpuAggression();
    };

    // Used when the human lets the computer choose (e.g. auto-play).
    m.suggestBowler = cpuPickBowler;

    // --- Playing a ball ---------------------------------------------------

    m.bowlBall = function () {
      if (m.result) return null;
      m.autoChoices();
      if (m.pendingFollowOn) throw new Error('Decide the follow-on first');
      const inn = m.current();
      if (inn.bowler === null) throw new Error('Choose a bowler first');

      const batTeam = m.battingTeam(), bowlTeam = m.bowlingTeam();
      const batter = batTeam.players[inn.striker];
      const bowler = bowlTeam.players[inn.bowler];
      const bs = inn.batters[inn.striker];
      const bw = inn.bowlers[inn.bowler];

      // Skill difference in roughly -0.9..0.9; positive favours the batter.
      // Batters "play themselves in" over their first few balls.
      const settled = Math.min(1, 0.75 + bs.balls * 0.05);
      const d = (batter.bat * settled - effectiveBowl(bowler, inn.bowler)) / 100;

      const w = Object.assign({}, base);
      const agg = AGG_MOD[m.aggression], fld = FIELD_MOD[m.field];
      for (const k in w) w[k] *= (agg[k] || 1) * (fld[k] || 1);
      w.W *= Math.exp(-2.2 * d);
      w[4] *= Math.exp(1.6 * d);
      w[6] *= Math.exp(2.2 * d);
      w.dot *= Math.exp(-0.8 * d);
      w.wide *= bowler.style ? 1 : 2;
      // FC: the pitch wears as the match goes on, helping the bowlers (spinners most).
      if (!limited) {
        const wear = [1, 1.08, 1.25, 1.4][m.cur] * (bowler.style === 'SPIN' && m.cur >= 2 ? 1.1 : 1);
        w.W *= wear;
        w.dot *= 1 + (wear - 1) / 2;
      }

      const outcome = pick(rng, w);
      const ev = {
        innings: m.cur, over: Math.floor(inn.balls / bpo), ball: inn.balls % bpo + 1,
        batter: batter.name, bowler: bowler.name, outcome, runs: 0, extra: 0, legal: true,
        wicket: null, shot: rng() * Math.PI * 2, text: '',
      };

      if (outcome === 'wide' || outcome === 'nb') {
        ev.legal = false;
        ev.extra = 1;
        if (outcome === 'wide') inn.extras.wides += 1; else inn.extras.noballs += 1;
        // Occasionally the batter still scores off a no-ball.
        if (outcome === 'nb' && rng() < 0.4) ev.runs = rng() < 0.3 ? 4 : 1;
        inn.runs += ev.extra + ev.runs;
        bw.runs += ev.extra + ev.runs;
        bs.runs += ev.runs;
        inn.overRuns += ev.extra + ev.runs;
        if (outcome === 'nb') bs.balls += 1;
        if (ev.runs === 4) bs.fours += 1;
        ev.text = outcome === 'wide' ? 'WIDE BALL' : 'NO BALL' + (ev.runs ? ' AND ' + ev.runs + ' RUN' + (ev.runs > 1 ? 'S' : '') : '');
      } else {
        inn.balls += 1;
        inn.overBalls += 1;
        m.totalBalls += 1;
        bs.balls += 1;
        bw.balls += 1;
        if (outcome === 'W') {
          ev.wicket = dismiss(inn, batter, bowler, bowlTeam);
          ev.text = wicketText(ev.wicket, batter);
        } else {
          const r = outcome === 'dot' ? 0 : Number(outcome);
          ev.runs = r;
          inn.runs += r; bs.runs += r; bw.runs += r; inn.overRuns += r;
          if (r === 4) bs.fours += 1;
          if (r === 6) bs.sixes += 1;
          ev.text = runText(r, batter);
          if (r % 2 === 1) swapStrike(inn);
        }
      }

      m.log.push(ev);
      afterBall(inn, ev);
      return ev;
    };

    function effectiveBowl(p, i) {
      let b = p.style ? p.bowl : p.bowl * 0.7; // part-timers are easier to score off
      // FC: long spells tire bowlers out (more than 5 of the last 16 overs).
      if (!limited) b *= 1 - 0.035 * Math.max(0, recentOvers(m.current(), i) - 5);
      return b;
    }

    function dismiss(inn, batter, bowler, bowlTeam) {
      const how = pick(rng, { bowled: 0.22, caught: 0.52, lbw: 0.14, stumped: bowler.style === 'SPIN' ? 0.06 : 0.0, runout: 0.06 });
      const out = { how, bowler: bowler.name, fielder: null, batterIndex: inn.striker };
      const bs = inn.batters[inn.striker];
      if (how === 'caught') {
        const fielders = bowlTeam.players.filter(p => p !== bowler);
        const keeper = bowlTeam.players.find(p => p.role === 'WK');
        const r = rng();
        if (r < 0.08) out.fielder = bowler.name;                       // caught and bowled
        else if (keeper && keeper !== bowler && r < 0.3) out.fielder = keeper.name;
        else out.fielder = fielders[Math.floor(rng() * fielders.length)].name;
      } else if (how === 'stumped') {
        const keeper = bowlTeam.players.find(p => p.role === 'WK');
        out.fielder = keeper ? keeper.name : null;
      } else if (how === 'runout') {
        out.fielder = bowlTeam.players[Math.floor(rng() * bowlTeam.players.length)].name;
      }
      if (how !== 'runout') inn.bowlers[inn.bowler].wkts += 1;
      bs.out = out;
      inn.wkts += 1;
      inn.fow.push({ wkt: inn.wkts, runs: inn.runs, batter: batter.name, overs: m.oversText(inn) });
      if (inn.nextIn < 11) {
        inn.striker = inn.nextIn++;
        inn.batters[inn.striker].batted = true;
      }
      return out;
    }

    function swapStrike(inn) {
      const t = inn.striker; inn.striker = inn.nonStriker; inn.nonStriker = t;
    }

    function afterBall(inn, ev) {
      if (!limited && !inn.at110 && inn.balls === 110 * bpo && m.cur < 2) inn.at110 = { runs: inn.runs, wkts: inn.wkts };
      // Chase complete?
      if (inn.target && inn.runs >= inn.target) return endInnings(inn, ev);
      if (inn.wkts >= 10) return endInnings(inn, ev);
      // FC: stumps on the final day.
      if (!limited && m.totalBalls >= matchBalls) return timeUp(inn, ev);
      if (ev.legal && inn.overBalls === bpo) {
        const bw = inn.bowlers[inn.bowler];
        if (inn.overRuns === 0) bw.maidens += 1;
        ev.endOfOver = true;
        inn.overBowlers.push(inn.bowler);
        inn.lastOverBowler = inn.bowler;
        inn.bowler = null;
        inn.overRuns = 0;
        inn.overBalls = 0;
        swapStrike(inn);
        if (limited && inn.balls >= overs * bpo) return endInnings(inn, ev);
        if (!limited) {
          const mayDeclare = !m.isHuman(inn.battingSide) && (inn.battingSide !== humanSide || m.autoDeclare);
          if (m.canDeclare() && mayDeclare && cpuShouldDeclare()) {
            inn.declared = true;
            ev.text += '. ' + teams[inn.battingSide].name + ' DECLARE';
            return endInnings(inn, ev);
          }
        }
      }
    }

    function finish(winner, by, margin) {
      const r = m.result = { winner, by, margin };
      const unit = margin === 1 ? by.replace(/s$/, '') : by;
      if (by === 'draw') r.text = 'MATCH DRAWN';
      else if (by === 'tie') r.text = 'MATCH TIED';
      else if (by === 'innings') r.text = teams[winner].name + ' WON BY AN INNINGS AND ' + margin + ' RUN' + (margin === 1 ? '' : 'S');
      else r.text = teams[winner].name + ' WON BY ' + margin + ' ' + unit.toUpperCase();
    }

    // FC: the last over of day four has been bowled.
    function timeUp(inn, ev) {
      inn.done = true;
      inn.bowler = null;
      if (!inn.at110) inn.at110 = { runs: inn.runs, wkts: inn.wkts };
      ev.endOfInnings = true;
      finish(null, 'draw', 0);
    }

    // `ev` is the ball that ended the innings (none for a declaration made between overs).
    function endInnings(inn, ev) {
      inn.done = true;
      inn.bowler = null;
      if (ev) ev.endOfInnings = true;
      if (!inn.at110) inn.at110 = { runs: inn.runs, wkts: inn.wkts };
      const n = m.innings.length;

      if (limited) {
        if (n === 1) return startInnings(inn.bowlingSide);
        const first = m.innings[0];
        if (inn.runs > first.runs) return finish(inn.battingSide, 'wickets', 10 - inn.wkts);
        if (inn.runs < first.runs) return finish(first.battingSide, 'runs', first.runs - inn.runs);
        return finish(null, 'tie', 0);
      }

      if (m.totalBalls >= matchBalls && !(inn.target && inn.runs >= inn.target)) return finish(null, 'draw', 0);
      if (n === 1) return startInnings(inn.bowlingSide);
      if (n === 2) {
        const lead = m.innings[0].runs - inn.runs;
        if (lead >= format.followOn) {
          m.pendingFollowOn = true;
          if (!m.isHuman(m.innings[0].battingSide)) cpuFollowOn();
          return;
        }
        return startInnings(m.innings[0].battingSide);
      }
      if (n === 3) {
        // If the side that has batted twice is still behind, they lose by an innings.
        const twice = inn.battingSide, other = 1 - twice;
        const behind = totalFor(other) - totalFor(twice);
        if (behind > 0 && !inn.declared) return finish(other, 'innings', behind);
        return startInnings(other);
      }
      // Fourth innings.
      if (inn.runs >= inn.target) return finish(inn.battingSide, 'wickets', 10 - inn.wkts);
      if (inn.wkts >= 10) {
        if (inn.runs === inn.target - 1) return finish(null, 'tie', 0);
        return finish(inn.bowlingSide, 'runs', inn.target - 1 - inn.runs);
      }
      return finish(null, 'draw', 0);
    }

    function runText(r, batter) {
      const n = batter.name;
      const lines = {
        0: ['NO RUN', 'DEFENDED BY ' + n, 'PLAYED AND MISSED', 'STRAIGHT TO THE FIELDER'],
        1: ['PUSHED AWAY FOR ONE', 'A QUICK SINGLE', 'WORKED OFF THE PADS FOR ONE'],
        2: ['TWO RUNS', 'GOOD RUNNING, THEY COME BACK FOR TWO'],
        3: ['THREE RUNS, STOPPED JUST SHORT'],
        4: ['FOUR! ' + n + ' FINDS THE GAP', 'CRACKING SHOT FOR FOUR', 'FOUR THROUGH THE COVERS'],
        6: ['SIX! RIGHT OUT OF THE GROUND', 'A HUGE SIX FROM ' + n],
      };
      const l = lines[r];
      return l[Math.floor(rng() * l.length)];
    }

    function wicketText(out, batter) {
      const n = batter.name;
      switch (out.how) {
        case 'bowled': return 'BOWLED HIM! ' + n + ' IS OUT';
        case 'lbw': return 'LBW! ' + n + ' HAS TO GO';
        case 'stumped': return 'STUMPED! ' + n + ' IS OUT';
        case 'runout': return 'RUN OUT! ' + n + ' IS SHORT';
        default: return 'CAUGHT! ' + n + ' OUT, CAUGHT BY ' + out.fielder;
      }
    }

    return m;
  }

  // Short dismissal text for the scorecard, e.g. "C SMITH B JONES".
  function howOut(out) {
    if (!out) return '';
    switch (out.how) {
      case 'bowled': return 'B ' + out.bowler;
      case 'lbw': return 'LBW B ' + out.bowler;
      case 'stumped': return 'ST ' + out.fielder + ' B ' + out.bowler;
      case 'runout': return 'RUN OUT (' + out.fielder + ')';
      default: return out.fielder === out.bowler ? 'C & B ' + out.bowler : 'C ' + out.fielder + ' B ' + out.bowler;
    }
  }

  CC.Match = { create, howOut, makeRng, FIELDS, AGGRESSION, FORMATS };
})(typeof window !== 'undefined' ? window : globalThis);
