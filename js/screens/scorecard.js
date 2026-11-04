// Scorecard screen. Shows the batting side's innings and the bowling figures.
(function () {
  const P = CC.pal;
  const F = CC.font;

  CC.engine.register('scorecard', {
    enter() {
      this.buttons = [
        CC.ui.button(110, 240, 100, 'RETURN', 'r', () => CC.engine.go('match')),
      ];
    },

    draw(ctx) {
      ctx.fillStyle = P.grassDark;
      ctx.fillRect(0, 0, 320, 256);
      const bat = CC.game.home, bowl = CC.game.away;

      F.drawText(ctx, 'LIMITED OVERS MATCH', 160, 4, { align: 'center', color: P.white, shadow: P.black });
      F.drawText(ctx, bat.name, 4, 18, { color: P.yellow });
      F.drawText(ctx, '1ST INNINGS', 316, 18, { align: 'right', color: P.yellow });

      bat.players.forEach((p, i) => {
        const y = 28 + i * 9;
        F.drawText(ctx, p.name, 4, y, { color: P.cream });
        F.drawText(ctx, i < 2 ? 'NOT OUT' : '', 100, y, { color: P.white });
        if (i < 2) F.drawText(ctx, '0', 316, y, { align: 'right', color: P.white });
      });

      let y = 28 + 11 * 9 + 2;
      F.drawText(ctx, 'EXTRAS', 4, y, { color: P.cream });
      F.drawText(ctx, '0', 316, y, { align: 'right' });
      y += 10;
      F.drawText(ctx, 'FROM 0 OVERS AND 0 BALLS     TOTAL 0 FOR 0', 4, y, { color: P.yellow });
      y += 12;
      F.drawText(ctx, 'BOWLER         O   M   R   W', 4, y, { color: P.cream });
      y += 10;
      bowl.players.filter(p => p.style).slice(0, 5).forEach(p => {
        F.drawText(ctx, p.name, 4, y, { color: P.white });
        F.drawText(ctx, '0   0   0   0', 166, y, { align: 'right', color: P.white });
        y += 9;
      });
    },
  });
})();
