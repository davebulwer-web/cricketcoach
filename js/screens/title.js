// Title screen.
(function () {
  const P = CC.pal;
  const F = CC.font;
  let t = 0;

  CC.engine.register('title', {
    enter() {
      t = 0;
      this.buttons = [
        CC.ui.button(110, 150, 100, 'PLAY MATCH', 'Enter', () => CC.engine.go('teamsheet')),
      ];
    },

    update(dt) { t += dt; },

    draw(ctx) {
      // Sky and ground.
      ctx.fillStyle = P.navy;
      ctx.fillRect(0, 0, 320, 256);
      ctx.fillStyle = P.grassDark;
      ctx.fillRect(0, 176, 320, 80);
      for (let x = 0; x < 320; x += 16) {
        ctx.fillStyle = (x / 16) % 2 ? P.grass : P.grassDark;
        ctx.fillRect(x, 176, 16, 80);
      }
      // Pitch strip in perspective-ish blocks.
      ctx.fillStyle = P.pitch;
      ctx.fillRect(140, 176, 40, 80);
      drawStumps(ctx, 156, 186);
      drawStumps(ctx, 156, 222);
      CC.sprites.draw(ctx, 'players', 'bat_swing', 36, 180, { tint: CC.teams[0].colour, scale: 3 });
      CC.sprites.draw(ctx, 'players', 'bowl_run1', 236, 180, { tint: CC.teams[1].colour, scale: 3 });

      F.drawText(ctx, CC.config.title, 160, 40, { scale: 3, align: 'center', color: P.yellow, shadow: P.darkRed });
      F.drawText(ctx, 'A RETRO CRICKET CAPTAIN GAME', 160, 80, { align: 'center', color: P.cream });
      F.drawText(ctx, CC.config.oversPerInnings + ' OVER LIMITED OVERS MATCH', 160, 100, { align: 'center', color: P.greyLite });

      if (Math.floor(t * 2) % 2 === 0) {
        F.drawText(ctx, 'PRESS ENTER OR TAP PLAY', 160, 130, { align: 'center', color: P.white });
      }
      F.drawText(ctx, 'PROOF OF CONCEPT', 160, 245, { align: 'center', color: P.cream });
    },
  });

  function drawStumps(ctx, x, y) {
    ctx.fillStyle = P.cream;
    ctx.fillRect(x, y, 2, 10);
    ctx.fillRect(x + 3, y, 2, 10);
    ctx.fillRect(x + 6, y, 2, 10);
    ctx.fillStyle = P.orange;
    ctx.fillRect(x, y - 1, 8, 1);
  }
})();
