// Choose the format for a quick match.
(function () {
  const P = CC.pal;
  const F = CC.font;

  const CHOICES = [
    ['T20', 'T20', '20 OVERS A SIDE, 4 OVERS PER BOWLER'],
    ['OD50', '50 OVERS', '50 OVERS A SIDE, 10 OVERS PER BOWLER'],
    ['FC', 'FOUR-DAY', 'TWO INNINGS EACH, DECLARATIONS, FOLLOW-ON'],
  ];

  CC.engine.register('format', {
    enter() {
      this.buttons = CHOICES.map(([f, label], i) => CC.ui.button(90, 70 + i * 36, 140, label, String(i + 1), () => CC.game.quickMatch(f)));
      this.buttons.push(CC.ui.button(8, 238, 70, 'BACK', 'Escape', () => CC.engine.go('title')));
    },

    draw(ctx) {
      ctx.fillStyle = P.grassDark;
      ctx.fillRect(0, 0, 320, 256);
      F.drawText(ctx, 'QUICK MATCH', 160, 10, { align: 'center', color: P.yellow, scale: 2, shadow: P.black });
      F.drawText(ctx, 'CHOOSE THE FORMAT', 160, 40, { align: 'center', color: P.cream });
      CHOICES.forEach(([, , info], i) => F.drawText(ctx, info, 160, 86 + i * 36, { align: 'center', color: P.greyLite }));
      F.drawText(ctx, 'IN A FOUR-DAY GAME USE SIM TO SKIP AHEAD', 160, 196, { align: 'center', color: P.cream });
      F.drawText(ctx, 'A SESSION, A DAY OR AN INNINGS AT A TIME', 160, 206, { align: 'center', color: P.cream });
    },
  });
})();
