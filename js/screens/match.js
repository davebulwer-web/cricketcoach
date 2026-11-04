// Match screen: runs a single limited-overs match using CC.Match.
//
// States:
//   toss    - who won the toss, and the bat/bowl choice
//   bowler  - the human picks a bowler for the next over
//   play    - balls are bowled one at a time (or automatically)
//   break   - innings break
//   result  - match over
(function () {
  const P = CC.pal;
  const F = CC.font;
  const ui = CC.ui;

  const BALL_TIME = 0.35;   // seconds for the ball to reach the batter
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

  function newMatch() {
    m = CC.Match.create({
      home: CC.game.home, away: CC.game.away,
      overs: CC.config.oversPerInnings, ballsPerOver: CC.config.ballsPerOver, humanSide: 0,
    });
    CC.game.match = m;
    m.doToss();
    state = 'toss';
    auto = false;
    anim = null;
    pendingBreak = false;
    comment = m.teams[m.tossWinner].name + ' WIN THE TOSS';
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
    const ev = m.bowlBall();
    if (!ev) return;
    anim = { t: 0, ev };
  }

  function finishBall() {
    const ev = anim.ev;
    anim = null;
    wait = AUTO_PAUSE;
    if (ev.endOfInnings) {
      auto = false;
      if (m.result) { state = 'result'; comment = m.result.text; return; }
      state = 'break';
      return;
    }
    if (ev.endOfOver) comment = 'END OF OVER ' + (ev.over + 1) + '. ' + ev.text;
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
      const inn = m.current();

      ui.bar(ctx, 2, 2, 156, 'SCORE:', inn ? m.battingTeam().name + ' ' + inn.runs + '-' + inn.wkts : '');
      ui.bar(ctx, 162, 2, 156, 'BATSMAN:', inn ? m.battingTeam().players[inn.striker].name : '');

      drawOverview(ctx, 2, 16, 156, 190);
      drawPitchView(ctx, 162, 16, 156, 190);

      ui.bar(ctx, 2, 209, 316, '');
      F.drawText(ctx, comment, 160, 211, { align: 'center', color: P.white });
      drawStatus(ctx);

      if (state === 'toss') drawToss(ctx);
      else if (state === 'bowler') drawBowlerPicker(ctx);
      else if (state === 'break') drawBreak(ctx);
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
        const label = (n + 1) + ' ' + pad(p.name, 12) + pad(p.style || '-', 5) + pad(String(p.bowl), 3) + ' ' + m.bowlerOvers(s) + '-' + s.maidens + '-' + s.runs + '-' + s.wkts;
        const btn = ui.button(30, 44 + n * 14, 260, label, String(n + 1), () => { m.setBowler(i); state = 'play'; });
        btn.align = 'left';
        b.push(btn);
      });
      b.push(ui.button(30, 192, 125, 'COMPUTER PICK', 'c', () => { m.setBowler(m.suggestBowler()); state = 'play'; }));
      b.push(ui.button(165, 192, 125, 'SCORECARD', 's', () => CC.engine.go('scorecard')));
      return b;
    }
    if (state === 'break') {
      b.push(ui.button(60, 150, 96, 'SCORECARD', 's', () => CC.engine.go('scorecard', { innings: 0 })));
      b.push(ui.button(164, 150, 96, 'CONTINUE', 'Enter', () => { comment = 'SECOND INNINGS'; startPlay(); }));
      return b;
    }
    if (state === 'result') {
      b.push(ui.button(60, 150, 96, 'SCORECARD', 's', () => CC.engine.go('scorecard')));
      b.push(ui.button(164, 150, 96, 'NEW MATCH', 'Enter', () => CC.engine.go('teamsheet')));
      return b;
    }
    // Normal play.
    const busy = !!anim;
    const ball = ui.button(2, 224, 46, 'BALL', ' ', bowl);
    ball.disabled = busy || auto;
    b.push(ball);
    b.push(ui.button(50, 224, 62, auto ? 'AUTO ON' : 'AUTO OFF', 'a', () => { auto = !auto; wait = 0; }));
    if (m.humanBowling()) {
      b.push(ui.button(114, 224, 92, 'FIELD ' + short(m.field), 'f', () => m.setField(NEXT_SETTING[m.field])));
    } else {
      b.push(ui.button(114, 224, 92, 'BAT ' + short(m.aggression), 'f', () => m.setAggression(NEXT_SETTING[m.aggression])));
    }
    b.push(ui.button(208, 224, 58, 'CARD', 's', () => { auto = false; CC.engine.go('scorecard'); }));
    b.push(ui.button(268, 224, 50, 'QUIT', 'Escape', () => { auto = false; CC.engine.go('title'); }));
    return b;
  }

  function short(s) { return s === 'NORMAL' ? 'NORM' : s === 'ATTACK' ? 'ATT' : 'DEF'; }
  function pad(s, n) { s = String(s); return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); }

  // ------------------------------------------------------------- main view

  function drawStatus(ctx) {
    const inn = m.current();
    if (!inn) return;
    let s = 'OVERS ' + m.oversText() + '/' + m.overs + '  RR ' + m.runRate().toFixed(2);
    if (inn.target) {
      const need = Math.max(0, inn.target - inn.runs);
      s += '  NEED ' + need + ' OFF ' + m.ballsLeft();
    }
    F.drawText(ctx, s, 160, 243, { align: 'center', color: P.cream });
  }

  // Top-down view of the whole ground with fielder positions and the ball.
  function drawOverview(ctx, x, y, w, h) {
    ui.panel(ctx, x, y, w, h, P.grassDark);
    F.drawText(ctx, 'OVERVIEW', x + w / 2, y + 4, { align: 'center', color: P.yellow });
    const cx = x + w / 2, cy = y + 92, r = 66;
    ctx.fillStyle = P.grass;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // Pixel-style boundary rope.
    ctx.fillStyle = P.white;
    for (let a = 0; a < 360; a += 3) {
      const rad = a * Math.PI / 180;
      ctx.fillRect(Math.round(cx + Math.cos(rad) * r), Math.round(cy + Math.sin(rad) * r), 1, 1);
    }
    ctx.fillStyle = P.pitch;
    ctx.fillRect(cx - 2, cy - 12, 4, 24);

    const inn = m.current();
    if (inn) {
      // Fielders.
      ctx.fillStyle = m.bowlingTeam().colour || P.white;
      FIELD_POSITIONS[m.field].forEach(([fx, fy]) => {
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

    if (inn) {
      F.drawText(ctx, 'FIELD: ' + m.field, x + 4, y + h - 21, { color: P.cream });
      F.drawText(ctx, 'BATS:  ' + m.aggression, x + 4, y + h - 11, { color: P.cream });
    }
  }

  // Close-up of the pitch: batter at the top, bowler running in from below.
  function drawPitchView(ctx, x, y, w, h) {
    ui.panel(ctx, x, y, w, h, P.grass);
    for (let i = 0; i < h - 2; i += 8) {
      ctx.fillStyle = (i / 8) % 2 ? P.grass : P.grassLite;
      ctx.fillRect(x + 1, y + 1 + i, w - 2, Math.min(8, h - 2 - i));
    }
    const px = x + w / 2 - 20;
    const top = y + 18, bottom = y + h - 46;
    ctx.fillStyle = P.pitch;
    ctx.fillRect(px, top, 40, bottom - top);
    ctx.fillStyle = P.white;
    ctx.fillRect(px - 6, top + 14, 52, 1);
    ctx.fillRect(px - 6, bottom - 14, 52, 1);
    // Stumps at both ends.
    ctx.fillStyle = P.cream;
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(px + 16 + i * 3, top + 4, 2, 10);
      ctx.fillRect(px + 16 + i * 3, bottom - 14, 2, 10);
    }

    const inn = m.current();
    if (!inn) return;
    const batTeam = m.battingTeam(), bowlTeam = m.bowlingTeam();

    // Placeholder figures (replaced by sprites in step 3).
    drawFigure(ctx, px + 10, top + 4, batTeam.colour);                 // striker
    drawFigure(ctx, px + 28, bottom - 18, batTeam.colour);             // non-striker
    const runUp = anim ? Math.min(1, anim.t / BALL_TIME) : 0;
    drawFigure(ctx, px + 20, bottom + 8 - Math.round(runUp * 10), bowlTeam.colour); // bowler

    // The delivery travelling down the pitch.
    if (anim && anim.t < BALL_TIME) {
      const k = anim.t / BALL_TIME;
      const bx = px + 20 + (anim.ev.outcome === 'wide' ? 22 * k : 0);
      const by = bottom - 8 - (bottom - top - 18) * k;
      ctx.fillStyle = P.red;
      ctx.fillRect(Math.round(bx), Math.round(by), 2, 2);
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

  function drawFigure(ctx, x, y, colour) {
    ctx.fillStyle = P.cream;      // head
    ctx.fillRect(x + 1, y, 3, 3);
    ctx.fillStyle = P.white;      // body
    ctx.fillRect(x, y + 3, 5, 4);
    ctx.fillStyle = colour;       // cap/trim
    ctx.fillRect(x + 1, y, 3, 1);
    ctx.fillStyle = P.white;      // legs
    ctx.fillRect(x, y + 7, 2, 3);
    ctx.fillRect(x + 3, y + 7, 2, 3);
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
    F.drawText(ctx, 'MAX ' + m.maxOversPerBowler + ' OVERS EACH, NOT TWO IN A ROW', 160, 178, { align: 'center', color: P.greyLite });
  }

  function drawBreak(ctx) {
    const first = m.innings[0];
    box(ctx, 30, 70, 260, 100, 'INNINGS BREAK');
    F.drawText(ctx, m.teams[first.battingSide].name + ' ' + first.runs + '-' + first.wkts + ' (' + m.oversText(first) + ' OV)', 160, 94, { align: 'center' });
    F.drawText(ctx, m.teams[1 - first.battingSide].name + ' NEED ' + (first.runs + 1) + ' TO WIN', 160, 110, { align: 'center', color: P.cream });
    F.drawText(ctx, 'FROM ' + m.overs + ' OVERS', 160, 122, { align: 'center', color: P.cream });
  }

  function drawResult(ctx) {
    box(ctx, 20, 60, 280, 116, 'MATCH RESULT');
    const won = m.result.winner === m.humanSide;
    F.drawText(ctx, m.result.winner === null ? 'A TIE!' : won ? 'YOU WIN!' : 'YOU LOSE', 160, 80, { align: 'center', scale: 2, color: won ? P.yellow : P.white, shadow: P.black });
    F.drawText(ctx, m.result.text, 160, 104, { align: 'center' });
    m.innings.forEach((inn, i) => {
      F.drawText(ctx, m.teams[inn.battingSide].name + ' ' + inn.runs + '-' + inn.wkts + ' (' + m.oversText(inn) + ')', 160, 118 + i * 10, { align: 'center', color: P.cream });
    });
  }
})();
