// Team sheet: shows both XIs before the match.
(function () {
  const P = CC.pal;
  const F = CC.font;

  CC.engine.register('teamsheet', {
    enter() {
      this.buttons = [
        CC.ui.button(8, 238, 70, 'BACK', 'Escape', () => CC.game.exit()),
        CC.ui.button(222, 238, 90, 'START', 'Enter', () => CC.engine.go('match', { newMatch: true })),
      ];
    },

    draw(ctx) {
      ctx.fillStyle = P.grassDark;
      ctx.fillRect(0, 0, 320, 256);
      F.drawText(ctx, 'TEAM SHEETS', 160, 6, { align: 'center', color: P.yellow, scale: 2, shadow: P.black });
      F.drawText(ctx, CC.Match.FORMATS[CC.game.format].name + ' MATCH', 160, 236, { align: 'center', color: P.cream });

      drawTeam(ctx, CC.game.home, 4, 28, 'YOUR TEAM');
      drawTeam(ctx, CC.game.away, 163, 28, 'OPPONENTS');
    },
  });

  function drawTeam(ctx, team, x, y, caption) {
    CC.ui.panel(ctx, x, y, 153, 200, P.grass);
    F.drawText(ctx, caption, x + 4, y + 4, { color: P.cream });
    F.drawText(ctx, team.name, x + 4, y + 14, { color: P.yellow });
    F.drawText(ctx, 'BT BW', x + 149, y + 30, { align: 'right', color: P.cream });
    team.players.forEach((p, i) => {
      const row = y + 42 + i * 13;
      F.drawText(ctx, p.name, x + 4, row, { color: P.white });
      F.drawText(ctx, p.role, x + 86, row, { color: P.greyLite });
      F.drawText(ctx, pad(p.bat) + ' ' + pad(p.bowl), x + 149, row, { align: 'right', color: P.white });
    });
  }

  function pad(n) { return (n < 10 ? ' ' : '') + n; }
})();
