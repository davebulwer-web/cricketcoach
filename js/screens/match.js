// Match screen: runs a T20, 50-over or four-day match using CC.Match.
// CC.game.format picks the format.
//
// States:
//   toss    - who won the toss, and the bat/bowl choice
//   bowler  - the human picks a bowler for the next over
//   play    - balls are bowled one at a time (or automatically)
//   sim     - menu to simulate ahead (and, in four-day games, declare)
//   break   - between innings (and the follow-on decision)
//   result  - match over
(function () {
  const P = CC.pal;
  const F = CC.font;
  const ui = CC.ui;

  const RUN_TIME = 0.35;    // seconds for the bowler's run-up
  const BALL_TIME = 0.7;    // seconds until the ball reaches the batter (includes run-up)
  const HIT_TIME = 0.55;    // seconds for the ball to travel in the overview
  const AUTO_PAUSE = 0.35;  // pause between balls in auto mode

  // Fielding positions as fractions of the boundary radius, relative to the
  // centre of the ground. Negative y is behind the batter.
  const FIELD_POSITIONS = {
    ATTACK: [[0, -0.36], [0.1, -0.42], [0.17, -0.4], [0.24, -0.37], [0.33, -0.28], [-0.15, -0.2],
             [0.45, -0.08], [0.4, 0.25], [0.15, 0.5], [-0.4, 0.2], [0, 0.28]],
    NORMAL: [[0, -0.36], [0.12, -0.4], [0.55, -0.15], [0.5, 0.2], [0.2, 0.55], [-0.2, 0.55],
             [-0.5, 0.15], [-0.55, -0.15], [-0.5, -0.7], [0.5, -0.7], [0, 0.28]],
    DEFEND: [[0, -0.36], [0.55, -0.72], [0.85, -0.1], [0.7, 0.5], [0.25, 0.85], [-0.25, 0.85],
             [-0.75, 0.45], [-0.85, -0.15], [-0.55, -0.72], [0.35, 0.15], [0, 0.28]],
  };
  const NEXT_SETTING = { NORMAL: 'ATTACK', ATTACK: 'DEFEND', DEFEND: 'NORMAL' };

  let m = null;             // the CC.Match in progress
  let state = 'toss';
  let auto = false;
  let anim = null;          // { t, ev } while a ball is being animated
  let wait = 0;             // auto-play pause timer
  let comment = '';
  let pendingBreak = false; // innings ended on the last ball
  let shown = null;         // match state as it was before the ball being animated
  let resumeAuto = false;   // auto-play was on when the innings ended
  let lastDay = 1;          // four-day games: to announce the close of play

  function newMatch() {
    const format = CC.game.format || 'T20';
    m = CC.Match.create({
      home: CC.game.home, away: CC.game.away, format,
      overs: format === 'T20' ? CC.config.oversPerInnings : undefined,
      ballsPerOver: CC.config.ballsPerOver, humanSide: 0,
    });
    lastDay = 1;
    CC.game.match = m;
    m.doToss();
    state = 'toss';
    auto = false;
    anim = null;
    pendingBreak = false;
    comment = m.teams[m.tossWinner].name + ' WIN THE TOSS';
    if (!m.limited && m.rainOvers[0]) comment = 'RAIN DELAY: ' + m.rainOvers[0] + ' OVERS LOST TODAY';
    if (m.tossWinner !== m.humanSide) {
      const bat = m.chooseToss();
      comment += ' AND ' + (bat === m.tossWinner ? 'BAT' : 'BOWL');
    }
  }

  function startPlay() {
    state = 'play';
    checkBowler();
  }

  // Before each over the human picks a bowler if they are fielding.
  function checkBowler() {
    if (m.result) { state = 'result'; auto = false; return; }
    if (m.humanBowling() && m.needsBowler()) {
      state = 'bowler';
    }
  }

  function bowl() {
    if (anim || state !== 'play') return;
    // Remember the state before this ball so the scoreboard only changes
    // once the ball reaches the batter.
    m.autoChoices();
    shown = { inn: structuredClone(m.current()), field: m.field, aggression: m.aggression };
    const ev = m.bowlBall();
    if (!ev) return;
    anim = { t: 0, ev };
  }

  function finishBall() {
    const ev = anim.ev;
    anim = null;
    wait = AUTO_PAUSE;
    if (ev.endOfInnings) {
      resumeAuto = auto;
      auto = false;
      afterInnings();
      return;
    }
    if (ev.endOfOver) comment = 'END OF OVER ' + (ev.over + 1) + '. ' + ev.text;
    newDayComment();
    checkBowler();
  }

  function afterInnings() {
    if (m.result) { state = 'result'; auto = false; comment = m.result.text; return; }
    state = 'break';
  }

  // Four-day games: announce stumps and any rain when the day changes.
  function newDayComment() {
    const c = m.clock();
    if (!c || c.day === lastDay) return;
    lastDay = c.day;
    comment = 'STUMPS. DAY ' + c.day + (c.rain ? ': RAIN COSTS ' + c.rain + ' OVERS' : ' BEGINS');
  }

  // Let the computer play both sides up to a point, then hand back control.
  function simulate(until) {
    const startInn = m.cur;
    const c0 = m.clock();
    let balls = 0;
    const changed = mm => mm.cur !== startInn || mm.pendingFollowOn;
    const stop = {
      over: mm => changed(mm) || (balls > 0 && mm.needsBowler()),
      session: mm => changed(mm) || (balls > 0 && (mm.clock().day !== c0.day || mm.clock().session !== c0.session)),
      day: mm => balls > 0 && mm.clock().day !== c0.day,
      innings: changed,
      match: () => false,
    }[until];
    m.simulate(mm => { if (stop(mm)) return true; balls++; return false; }, { declare: until === 'match' });
    anim = null;
    auto = false;
    if (m.result) { afterInnings(); return; }
    const before = comment;
    newDayComment();
    if (m.cur !== startInn || m.pendingFollowOn) {
      state = 'break';
      return;
    }
    if (comment === before) {
      const c = m.clock();
      comment = c ? 'PLAY RESUMES: DAY ' + c.day + ', SESSION ' + c.session : 'PLAY RESUMES AFTER ' + m.oversText() + ' OVERS';
    }
    state = 'play';
    checkBowler();
  }

  CC.engine.register('match', {
    enter(params) {
      if (params.newMatch || !m) newMatch();
    },

    update(dt) {
      dt *= CC.config.animSpeed || 1;
      if (anim) {
        anim.t += dt;
        if (anim.t >= BALL_TIME && !anim.commented) { comment = anim.ev.text; anim.commented = true; }
        if (anim.t >= BALL_TIME + HIT_TIME) finishBall();
      } else if (auto && state === 'play') {
        wait -= dt;
        if (wait <= 0) bowl();
      }
      this.buttons = buildButtons();
    },

    draw(ctx) {
      ctx.fillStyle = P.greyDark;
      ctx.fillRect(0, 0, 320, 256);
      const v = view();

      ui.bar(ctx, 2, 2, 156, 'SCORE:', v ? v.batTeam.name + ' ' + v.inn.runs + '-' + v.inn.wkts : '');
      ui.bar(ctx, 162, 2, 156, 'BATSMAN:', v ? v.batTeam.players[v.inn.striker].name : '');

      drawOverview(ctx, 2, 16, 156, 190);
      drawPitchView(ctx, 162, 16, 156, 190);

      ui.bar(ctx, 2, 209, 316, '');
      F.drawText(ctx, comment, 160, 211, { align: 'center', color: P.white });
      drawStatus(ctx);

      if (state === 'toss') drawToss(ctx);
      else if (state === 'bowler') drawBowlerPicker(ctx);
      else if (state === 'break') drawBreak(ctx);
      else if (state === 'sim') box(ctx, 70, 26, 180, m.limited ? 106 : 160, 'SIMULATE');
      else if (state === 'result') drawResult(ctx);
    },
  });

  // ---------------------------------------------------------------- buttons

  function buildButtons() {
    const b = [];
    if (state === 'toss') {
      if (m.innings.length === 0) {
        b.push(ui.button(70, 150, 80, 'BAT', 'b', () => { m.chooseToss(true); comment = 'YOU CHOSE TO BAT'; startPlay(); }));
        b.push(ui.button(170, 150, 80, 'BOWL', 'w', () => { m.chooseToss(false); comment = 'YOU CHOSE TO BOWL'; startPlay(); }));
      } else {
        b.push(ui.button(110, 150, 100, 'CONTINUE', 'Enter', startPlay));
      }
      return b;
    }
    if (state === 'bowler') {
      const inn = m.current();
      const team = m.bowlingTeam();
      const eligible = m.eligibleBowlers();
      // List proper bowlers first, then part-timers.
      eligible.sort((a, c) => (team.players[c].style ? 1 : 0) - (team.players[a].style ? 1 : 0) || team.players[c].bowl - team.players[a].bowl);
      eligible.slice(0, 9).forEach((i, n) => {
        const p = team.players[i], s = inn.bowlers[i];
        const tired = !m.limited && m.recentOvers(i) >= 5 ? '!' : ' ';
        const label = (n + 1) + ' ' + pad(p.name, 12) + pad(p.style || '-', 5) + pad(String(p.bowl), 3) + tired + m.bowlerOvers(s) + '-' + s.maidens + '-' + s.runs + '-' + s.wkts;
        const btn = ui.button(30, 44 + n * 14, 260, label, String(n + 1), () => { m.setBowler(i); state = 'play'; });
        btn.align = 'left';
        b.push(btn);
      });
      b.push(ui.button(30, 192, 125, 'COMPUTER PICK', 'c', () => { m.setBowler(m.suggestBowler()); state = 'play'; }));
      b.push(ui.button(165, 192, 125, 'SCORECARD', 's', () => CC.engine.go('scorecard')));
      return b;
    }
    if (state === 'break') {
      const done = m.cur - (m.pendingFollowOn ? 0 : 1);
      b.push(ui.button(36, 168, 76, 'SCORECARD', 's', () => CC.engine.go('scorecard', { innings: Math.max(0, done) })));
      if (m.pendingFollowOn && m.isHuman(m.innings[0].battingSide)) {
        b.push(ui.button(118, 168, 80, 'ENFORCE', 'e', () => { m.chooseFollowOn(true); }));
        b.push(ui.button(204, 168, 80, 'BAT AGAIN', 'b', () => { m.chooseFollowOn(false); }));
      } else {
        b.push(ui.button(208, 168, 76, 'CONTINUE', 'Enter', () => { comment = inningsName(m.cur).toUpperCase(); auto = resumeAuto; wait = 0; startPlay(); }));
      }
      return b;
    }
    if (state === 'sim') {
      const opts = m.limited
        ? [['TO END OF OVER', 'over'], ['TO END OF INNINGS', 'innings'], ['TO END OF MATCH', 'match']]
        : [['TO END OF OVER', 'over'], ['TO END OF SESSION', 'session'], ['TO CLOSE OF PLAY', 'day'], ['TO END OF INNINGS', 'innings'], ['TO END OF MATCH', 'match']];
      opts.forEach(([label, until], i) => b.push(ui.button(90, 50 + i * 16, 140, label, String(i + 1), () => simulate(until))));
      let y = 50 + opts.length * 16 + 6;
      if (m.canDeclare() && m.humanBatting()) {
        b.push(ui.button(90, y, 140, 'DECLARE INNINGS', 'd', () => { m.declare(); comment = m.battingTeam().name + ' DECLARE'; afterDeclare(); }));
        y += 16;
      }
      b.push(ui.button(90, y + 4, 140, 'CANCEL', 'Escape', () => { state = 'play'; checkBowler(); }));
      return b;
    }
    if (state === 'result') {
      b.push(ui.button(60, 150, 96, 'SCORECARD', 's', () => CC.engine.go('scorecard')));
      b.push(ui.button(164, 150, 96, CC.game.mode === 'career' ? 'CONTINUE' : 'NEW MATCH', 'Enter', () => CC.game.afterMatch()));
      return b;
    }
    // Normal play.
    const busy = !!anim;
    const ball = ui.button(2, 224, 38, 'BALL', ' ', bowl);
    ball.disabled = busy || auto;
    b.push(ball);
    b.push(ui.button(42, 224, 56, auto ? 'AUTO ON' : 'AUTO OFF', 'a', () => { auto = !auto; wait = 0; }));
    if (m.humanBowling()) {
      b.push(ui.button(100, 224, 76, 'FIELD ' + short(m.field), 'f', () => m.setField(NEXT_SETTING[m.field])));
    } else {
      b.push(ui.button(100, 224, 76, 'BAT ' + short(m.aggression), 'f', () => m.setAggression(NEXT_SETTING[m.aggression])));
    }
    const sim = ui.button(178, 224, 36, 'SIM', 'm', () => { auto = false; state = 'sim'; });
    sim.disabled = busy;
    b.push(sim);
    b.push(ui.button(216, 224, 46, 'CARD', 's', () => { auto = false; CC.engine.go('scorecard'); }));
    b.push(ui.button(264, 224, 54, 'QUIT', 'Escape', () => { auto = false; CC.game.exit(); }));
    return b;
  }

  function short(s) { return s === 'NORMAL' ? 'NORM' : s === 'ATTACK' ? 'ATT' : 'DEF'; }

  function afterDeclare() {
    resumeAuto = false;
    afterInnings();
  }

  // "Surrey 2nd innings" style name for innings i.
  function inningsName(i) {
    const inn = m.innings[i];
    if (!inn) return '';
    const nth = m.innings.slice(0, i + 1).filter(x => x.battingSide === inn.battingSide).length;
    return m.teams[inn.battingSide].name + ' ' + (nth === 1 ? '1ST' : '2ND') + ' INNINGS';
  }
  // What the screen shows: the state before the current ball until it reaches
  // the batter, and the live state otherwise.
  function view() {
    const live = !(anim && anim.t < BALL_TIME && shown);
    let inn = live ? m.current() : shown.inn;
    // Keep showing a finished innings until its last ball has played out.
    if (live && anim && anim.ev.endOfInnings) inn = m.innings[anim.ev.innings];
    if (!inn) return null;
    return {
      inn,
      batTeam: m.teams[inn.battingSide],
      bowlTeam: m.teams[inn.bowlingSide],
      field: live ? m.field : shown.field,
      aggression: live ? m.aggression : shown.aggression,
    };
  }

  function pad(s, n) { s = String(s); return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); }

  // ------------------------------------------------------------- main view

  function drawStatus(ctx) {
    const v = view();
    if (!v) return;
    const inn = v.inn;
    let s;
    if (m.limited) {
      s = 'OVERS ' + m.oversText(inn) + '/' + m.overs + '  RR ' + m.runRate(inn).toFixed(2);
      if (inn.target) {
        const need = Math.max(0, inn.target - inn.runs);
        s += '  NEED ' + need + ' OFF ' + (m.overs * m.ballsPerOver - inn.balls);
      }
    } else {
      const c = m.clock();
      s = 'DAY ' + c.day + ' S' + c.session + '  OV ' + m.oversText(inn);
      if (inn.target) {
        s += '  NEED ' + Math.max(0, inn.target - inn.runs) + ', ' + Math.ceil(m.ballsLeft() / m.ballsPerOver) + ' OV LEFT';
      } else if (m.cur > 0) {
        const lead = m.totalFor(inn.battingSide) - m.totalFor(inn.bowlingSide);
        s += lead >= 0 ? '  LEAD ' + lead : '  TRAIL ' + -lead;
      } else {
        s += '  RR ' + m.runRate(inn).toFixed(2);
      }
    }
    F.drawText(ctx, s, 160, 243, { align: 'center', color: P.cream });
  }

  // Top-down view of the whole ground with fielder positions and the ball.
  function drawOverview(ctx, x, y, w, h) {
    ui.panel(ctx, x, y, w, h, P.grassDark);
    F.drawText(ctx, 'OVERVIEW', x + w / 2, y + 4, { align: 'center', color: P.yellow });
    const cx = x + w / 2, cy = y + 92, r = 66;
    CC.sprites.draw(ctx, 'ground', null, cx - 66, cy - 66);

    const v = view();
    if (v) {
      // Fielders in the bowling side's colour.
      ctx.fillStyle = v.bowlTeam.colour || P.white;
      FIELD_POSITIONS[v.field].forEach(([fx, fy]) => {
        ctx.fillRect(Math.round(cx + fx * r) - 1, Math.round(cy + fy * r) - 1, 3, 3);
      });
      // Batters.
      ctx.fillStyle = P.white;
      ctx.fillRect(cx - 1, cy - 14, 3, 3);
      ctx.fillRect(cx + 3, cy + 10, 3, 3);
    }

    // The ball after it is hit.
    if (anim && anim.t > BALL_TIME) {
      const ev = anim.ev;
      const k = Math.min(1, (anim.t - BALL_TIME) / HIT_TIME);
      const dist = ev.wicket && ev.wicket.how !== 'caught' ? 0
        : ev.outcome === 'wide' ? 0.3
        : ev.wicket ? 0.5
        : { 0: 0.15, 1: 0.35, 2: 0.6, 3: 0.8, 4: 1.0, 6: 1.1 }[ev.runs] || 0.3;
      const ang = ev.outcome === 'wide' ? -Math.PI / 2 : ev.shot;
      const bx = cx + Math.cos(ang) * dist * r * k;
      const by = cy - 12 + Math.sin(ang) * dist * r * k;
      ctx.fillStyle = P.red;
      ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 2, 2);
    }

    if (v) {
      F.drawText(ctx, 'FIELD: ' + v.field, x + 4, y + h - 21, { color: P.cream });
      F.drawText(ctx, 'BATS:  ' + v.aggression, x + 4, y + h - 11, { color: P.cream });
    }
  }

  // Where things stand in the pitch view, relative to the panel's top-left.
  // These line up with the creases drawn in assets/pitch.png.
  const PITCH = {
    keeper:     { x: 70, y: 8 },
    stumpsTop:  { x: 71, y: 29 },
    striker:    { x: 62, y: 27 },
    stumpsBot:  { x: 71, y: 121 },
    nonStriker: { x: 90, y: 109 },
    bowlStart:  { x: 72, y: 137 },  // start of the run-up
    bowlEnd:    { x: 72, y: 117 },  // point of delivery
    ballFrom:   { x: 80, y: 118 },
    ballTo:     { x: 78, y: 42 },
  };

  // Close-up of the pitch: batter at the top, bowler running in from below.
  function drawPitchView(ctx, x, y, w, h) {
    ui.panel(ctx, x, y, w, h, P.grass);
    CC.sprites.draw(ctx, 'pitch', null, x + 1, y + 1);

    const v = view();
    if (!v) return;
    const inn = v.inn, batTeam = v.batTeam, bowlTeam = v.bowlTeam;
    const bat = { tint: batTeam.colour }, bowl = { tint: bowlTeam.colour };
    const t = anim ? anim.t : 0;
    const ev = anim && anim.ev;
    const at = (pos, dx, dy) => [x + pos.x + (dx || 0), y + pos.y + (dy || 0)];
    const draw = (sheet, frame, pos, opts) => CC.sprites.draw(ctx, sheet, frame, pos[0], pos[1], opts);

    // Far end: keeper, stumps, striker.
    draw('players', 'keeper', at(PITCH.keeper), bowl);
    const bowled = ev && ev.wicket && ev.wicket.how === 'bowled' && t >= BALL_TIME;
    draw('props', bowled ? 'stumps_broken' : 'stumps', at(PITCH.stumpsTop));
    const swings = ev && t >= BALL_TIME - 0.05 && (ev.runs > 0 || (ev.wicket && ev.wicket.how === 'caught'));
    draw('players', swings ? 'bat_swing' : 'bat_stance', at(PITCH.striker), bat);

    // Near end: stumps, non-striker, bowler.
    draw('props', 'stumps', at(PITCH.stumpsBot));
    draw('players', 'fielder', at(PITCH.nonStriker), bat);
    let frame = 'bowl_run1', by = PITCH.bowlStart.y;
    if (anim) {
      const run = Math.min(1, t / RUN_TIME);
      by = PITCH.bowlStart.y + (PITCH.bowlEnd.y - PITCH.bowlStart.y) * run;
      frame = t >= RUN_TIME ? 'bowl_release' : Math.floor(t / 0.08) % 2 ? 'bowl_run2' : 'bowl_run1';
    }
    draw('players', frame, [x + PITCH.bowlStart.x, y + by], bowl);

    // The delivery travelling down the pitch.
    if (anim && t >= RUN_TIME && t < BALL_TIME) {
      const k = (t - RUN_TIME) / (BALL_TIME - RUN_TIME);
      const bx = PITCH.ballFrom.x + (PITCH.ballTo.x - PITCH.ballFrom.x) * k + (ev.outcome === 'wide' ? 24 * k : 0);
      const bly = PITCH.ballFrom.y + (PITCH.ballTo.y - PITCH.ballFrom.y) * k;
      CC.sprites.draw(ctx, 'props', 'ball', x + bx - 8, y + bly - 8);
    }

    // Bowler and batter figures.
    if (inn.bowler !== null) {
      const s = inn.bowlers[inn.bowler];
      F.drawText(ctx, bowlTeam.players[inn.bowler].name, x + 4, y + 4, { color: P.yellow, shadow: P.black });
      F.drawText(ctx, m.bowlerOvers(s) + '-' + s.maidens + '-' + s.runs + '-' + s.wkts, x + w - 4, y + 4, { align: 'right', color: P.white, shadow: P.black });
    }
    const bl = (i, star) => batTeam.players[i].name + (star ? '*' : ' ') + ' ' + inn.batters[i].runs + '(' + inn.batters[i].balls + ')';
    F.drawText(ctx, bl(inn.striker, true), x + 4, y + h - 21, { color: P.white, shadow: P.black });
    F.drawText(ctx, bl(inn.nonStriker, false), x + 4, y + h - 11, { color: P.cream, shadow: P.black });
  }

  // --------------------------------------------------------------- overlays

  function box(ctx, x, y, w, h, title) {
    ui.panel(ctx, x, y, w, h, P.navy);
    if (title) F.drawText(ctx, title, x + w / 2, y + 6, { align: 'center', color: P.yellow, shadow: P.black });
  }

  function drawToss(ctx) {
    box(ctx, 40, 70, 240, 100, 'THE TOSS');
    F.drawText(ctx, m.teams[m.tossWinner].name + ' WIN THE TOSS', 160, 96, { align: 'center' });
    if (m.innings.length === 0) {
      F.drawText(ctx, 'WILL YOU BAT OR BOWL?', 160, 112, { align: 'center', color: P.cream });
    } else {
      F.drawText(ctx, 'AND CHOOSE TO ' + (m.current().battingSide === m.tossWinner ? 'BAT' : 'BOWL'), 160, 112, { align: 'center', color: P.cream });
    }
  }

  function drawBowlerPicker(ctx) {
    const inn = m.current();
    const over = Math.floor(inn.balls / m.ballsPerOver) + 1;
    box(ctx, 24, 14, 272, 196, 'CHOOSE BOWLER FOR OVER ' + over);
    F.drawText(ctx, '  NAME        TYPE SKL O-M-R-W', 34, 33, { color: P.cream });
    F.drawText(ctx, m.limited ? 'MAX ' + m.maxOversPerBowler + ' OVERS EACH, NOT TWO IN A ROW' : 'NOT TWO IN A ROW.  ! = TIRED', 160, 178, { align: 'center', color: P.greyLite });
  }

  function inningsLine(inn) {
    return m.teams[inn.battingSide].name + ' ' + inn.runs + '-' + inn.wkts + (inn.declared ? ' DEC' : '') + ' (' + m.oversText(inn) + ' OV)';
  }

  function drawBreak(ctx) {
    box(ctx, 30, 50, 260, 140, 'INNINGS BREAK');
    const finished = m.innings.filter(i => i.done);
    finished.forEach((inn, i) => F.drawText(ctx, inningsLine(inn), 160, 70 + i * 11, { align: 'center' }));
    const y = 70 + finished.length * 11 + 8;
    const line = (t, k) => F.drawText(ctx, t, 160, y + k * 11, { align: 'center', color: P.cream });
    if (m.pendingFollowOn) {
      const a = m.innings[0].battingSide;
      line(m.teams[a].name + ' LEAD BY ' + (m.innings[0].runs - m.innings[1].runs), 0);
      line(m.isHuman(a) ? 'ENFORCE THE FOLLOW-ON?' : 'DECIDING ON THE FOLLOW-ON', 1);
      return;
    }
    const inn = m.current();
    const bat = m.teams[inn.battingSide].name;
    if (inn.target) {
      line(bat + ' NEED ' + inn.target + ' TO WIN', 0);
      line(m.limited ? 'FROM ' + m.overs + ' OVERS' : 'WITH ' + Math.ceil(m.ballsLeft() / m.ballsPerOver) + ' OVERS LEFT IN THE MATCH', 1);
    } else {
      if (m.followOn && m.cur === 2) line(bat + ' FOLLOW ON', 0);
      const lead = m.totalFor(inn.battingSide) - m.totalFor(inn.bowlingSide);
      line(bat + (lead >= 0 ? ' LEAD BY ' + lead : ' TRAIL BY ' + -lead), m.followOn && m.cur === 2 ? 1 : 0);
    }
  }

  function drawResult(ctx) {
    box(ctx, 20, 40, 280, 140, 'MATCH RESULT');
    const r = m.result;
    const won = r.winner === m.humanSide;
    const head = r.by === 'draw' ? 'DRAWN' : r.winner === null ? 'A TIE!' : won ? 'YOU WIN!' : 'YOU LOSE';
    F.drawText(ctx, head, 160, 58, { align: 'center', scale: 2, color: won ? P.yellow : P.white, shadow: P.black });
    F.drawText(ctx, r.text, 160, 80, { align: 'center' });
    m.innings.forEach((inn, i) => {
      F.drawText(ctx, inningsLine(inn), 160, 96 + i * 11, { align: 'center', color: P.cream });
    });
  }
})();
