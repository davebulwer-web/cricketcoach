// Ball-by-ball limited-overs match simulation.
//
// Pure game logic with no drawing, so it can be tested on its own:
//   const m = CC.Match.create({ home, away, overs, humanSide: 0 });
//   m.doToss(); m.chooseToss(true /* bat first */);
//   while (!m.result) { if (m.needsBowler()) m.setBowler(i); m.bowlBall(); }
//
// The human captains one side (`humanSide`, an index into [home, away]).
// The computer makes the same choices for the other side.
(function (root) {
  const CC = root.CC = root.CC || {};

  const FIELDS = ['ATTACK', 'NORMAL', 'DEFEND'];
  const AGGRESSION = ['ATTACK', 'NORMAL', 'DEFEND'];

  // Base chance of each outcome on a single delivery, before modifiers.
  // Tuned so a 20-over innings averages roughly 150 runs for 6-7 wickets.
  const BASE = { dot: 0.35, 1: 0.35, 2: 0.08, 3: 0.012, 4: 0.115, 6: 0.04, W: 0.04, wide: 0.03, nb: 0.006 };

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
    const overs = opts.overs || 20;
    const bpo = opts.ballsPerOver || 6;
    const humanSide = opts.humanSide === undefined ? 0 : opts.humanSide;
    const rng = makeRng(opts.seed);
    const maxOversPerBowler = Math.ceil(overs / 5);

    const m = {
      teams, overs, ballsPerOver: bpo, humanSide, maxOversPerBowler,
      tossWinner: null,
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

    function startInnings(battingSide) {
      const inn = newInnings(battingSide);
      inn.batters[0].batted = inn.batters[1].batted = true;
      if (m.innings.length === 1) inn.target = m.innings[0].runs + 1;
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
    m.ballsLeft = function () { return overs * bpo - m.current().balls; };
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

    // --- Computer captain -------------------------------------------------

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
        if (oversDone < overs - 4 && used >= maxOversPerBowler - 1) score -= 15; // save a death over
        if (score > bestScore) { bestScore = score; best = i; }
      });
      return best;
    }

    function cpuField() {
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
      if (!m.humanBowling()) {
        if (m.needsBowler()) m.setBowler(cpuPickBowler());
        m.field = cpuField();
      }
      if (!m.humanBatting()) m.aggression = cpuAggression();
    };

    // Used when the human lets the computer choose (e.g. auto-play).
    m.suggestBowler = cpuPickBowler;

    // --- Playing a ball ---------------------------------------------------

    m.bowlBall = function () {
      if (m.result) return null;
      m.autoChoices();
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
      const d = (batter.bat * settled - effectiveBowl(bowler)) / 100;

      const w = Object.assign({}, BASE);
      const agg = AGG_MOD[m.aggression], fld = FIELD_MOD[m.field];
      for (const k in w) w[k] *= (agg[k] || 1) * (fld[k] || 1);
      w.W *= Math.exp(-2.2 * d);
      w[4] *= Math.exp(1.6 * d);
      w[6] *= Math.exp(2.2 * d);
      w.dot *= Math.exp(-0.8 * d);
      w.wide *= bowler.style ? 1 : 2;

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

    function effectiveBowl(p) {
      return p.style ? p.bowl : p.bowl * 0.7; // part-timers are easier to score off
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
      // Chase complete?
      if (inn.target && inn.runs >= inn.target) return endInnings(inn);
      if (inn.wkts >= 10) return endInnings(inn);
      if (ev.legal && inn.overBalls === bpo) {
        const bw = inn.bowlers[inn.bowler];
        if (inn.overRuns === 0) bw.maidens += 1;
        ev.endOfOver = true;
        inn.lastOverBowler = inn.bowler;
        inn.bowler = null;
        inn.overRuns = 0;
        inn.overBalls = 0;
        swapStrike(inn);
        if (inn.balls >= overs * bpo) return endInnings(inn);
      }
    }

    function endInnings(inn) {
      inn.done = true;
      inn.bowler = null;
      if (m.cur === 0) {
        startInnings(inn.bowlingSide);
        m.log[m.log.length - 1].endOfInnings = true;
        return;
      }
      const first = m.innings[0];
      m.log[m.log.length - 1].endOfInnings = true;
      if (inn.runs > first.runs) {
        m.result = { winner: inn.battingSide, by: 'wickets', margin: 10 - inn.wkts };
      } else if (inn.runs < first.runs) {
        m.result = { winner: first.battingSide, by: 'runs', margin: first.runs - inn.runs };
      } else {
        m.result = { winner: null, by: 'tie', margin: 0 };
      }
      const r = m.result;
      r.text = r.winner === null ? 'MATCH TIED'
        : teams[r.winner].name + ' WON BY ' + r.margin + ' ' + (r.margin === 1 ? r.by.replace(/s$/, '') : r.by).toUpperCase();
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

  CC.Match = { create, howOut, makeRng, FIELDS, AGGRESSION };
})(typeof window !== 'undefined' ? window : globalThis);
