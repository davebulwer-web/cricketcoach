// Scorecard screen: batting card, extras, fall of wickets and bowling figures
// for either innings of the current match.
(function () {
  const P = CC.pal;
  const F = CC.font;
  let shown = 0;

  CC.engine.register('scorecard', {
    enter(params) {
      const m = CC.game.match;
      shown = params.innings !== undefined ? params.innings : Math.max(0, m.cur);
    },

    update() {
      const m = CC.game.match;
      this.buttons = [CC.ui.button(214, 241, 100, 'RETURN', 'r', () => CC.engine.go('match'))];
      if (m.innings.length > 1) {
        this.buttons.push(CC.ui.button(6, 241, 120, 'NEXT INNINGS', 'i', () => { shown = (shown + 1) % m.innings.length; }));
      }
    },

    draw(ctx) {
      ctx.fillStyle = P.grassDark;
      ctx.fillRect(0, 0, 320, 256);
      const m = CC.game.match;
      const inn = m.innings[shown];
      if (!inn) {
        F.drawText(ctx, 'NO PLAY YET', 160, 120, { align: 'center', color: P.yellow });
        return;
      }
      const bat = m.teams[inn.battingSide], bowl = m.teams[inn.bowlingSide];

      F.drawText(ctx, bat.name, 4, 3, { color: P.yellow, shadow: P.black });
      const nth = m.innings.slice(0, shown + 1).filter(x => x.battingSide === inn.battingSide).length;
      const label = m.limited ? (shown ? '2ND' : '1ST') + ' INNINGS' : (nth === 1 ? '1ST' : '2ND') + ' INNINGS (' + (shown + 1) + ' OF ' + m.innings.length + ')';
      F.drawText(ctx, label, 316, 3, { align: 'right', color: P.yellow, shadow: P.black });

      let y = 14;
      bat.players.forEach((p, i) => {
        const b = inn.batters[i];
        F.drawText(ctx, p.name, 4, y, { color: P.cream });
        if (b.batted) {
          const status = b.out ? CC.Match.howOut(b.out) : 'NOT OUT';
          F.drawText(ctx, status, 78, y, { color: P.white });
          F.drawText(ctx, String(b.runs), 280, y, { align: 'right', color: P.white });
          F.drawText(ctx, '(' + b.balls + ')', 316, y, { align: 'right', color: P.greyLite });
        }
        y += 8;
      });

      y += 2;
      const ex = inn.extras;
      F.drawText(ctx, 'EXTRAS  (W ' + ex.wides + ', NB ' + ex.noballs + ')', 4, y, { color: P.cream });
      F.drawText(ctx, String(ex.wides + ex.noballs + ex.byes), 280, y, { align: 'right' });
      y += 10;
      F.drawText(ctx, 'TOTAL  (' + inn.wkts + ' WKTS' + (inn.declared ? ' DEC' : '') + ', ' + m.oversText(inn) + ' OVERS)', 4, y, { color: P.yellow });
      F.drawText(ctx, String(inn.runs), 280, y, { align: 'right', color: P.yellow });
      y += 12;

      // Fall of wickets, wrapped over as many lines as needed.
      F.drawText(ctx, 'FALL OF WICKETS', 4, y, { color: P.cream });
      y += 9;
      let line = '';
      inn.fow.forEach(f => {
        const part = f.wkt + '-' + f.runs + '  ';
        if ((line + part).length > 52) { F.drawText(ctx, line, 4, y); y += 9; line = ''; }
        line += part;
      });
      F.drawText(ctx, line || '-', 4, y);
      y += 12;

      F.drawText(ctx, 'BOWLING', 4, y, { color: P.cream });
      F.drawText(ctx, 'O   M   R   W', 316, y, { align: 'right', color: P.cream });
      y += 9;
      bowl.players.forEach((p, i) => {
        const s = inn.bowlers[i];
        if (!s.balls && !s.runs) return;
        F.drawText(ctx, p.name, 4, y);
        F.drawText(ctx, m.bowlerOvers(s), 244, y, { align: 'right' });
        F.drawText(ctx, String(s.maidens), 268, y, { align: 'right' });
        F.drawText(ctx, String(s.runs), 292, y, { align: 'right' });
        F.drawText(ctx, String(s.wkts), 316, y, { align: 'right' });
        y += 8;
      });

      if (m.result && shown === m.innings.length - 1) {
        F.drawText(ctx, m.result.text, 160, 231, { align: 'center', color: P.yellow, shadow: P.black });
      }
    },
  });
})();
