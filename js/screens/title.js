// Title screen.
(function () {
  const P = CC.pal;
  const F = CC.font;
  let t = 0;

  CC.engine.register('title', {
    enter() {
      t = 0;
      const cont = CC.ui.button(100, 136, 120, 'CONTINUE CAREER', 'c', () => {
        if (CC.Career.load()) { CC.game.mode = 'career'; CC.engine.go('office'); }
      });
      cont.disabled = !CC.Career.hasSave();
      this.buttons = [
        CC.ui.button(100, 120, 120, 'NEW CAREER', 'Enter', () => { CC.Career.begin(); CC.engine.go('county'); }),
        cont,
        CC.ui.button(100, 152, 120, 'QUICK MATCH', 'q', () => CC.game.quickMatch()),
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
      CC.sprites.draw(ctx, 'players', 'bat_swing', 36, 180, { tint: CC.counties[13].colour, scale: 3 });
      CC.sprites.draw(ctx, 'players', 'bowl_run1', 236, 180, { tint: CC.counties[17].colour, scale: 3 });

      F.drawText(ctx, CC.config.title, 160, 40, { scale: 3, align: 'center', color: P.yellow, shadow: P.darkRed });
      F.drawText(ctx, 'COUNTY CRICKET MANAGEMENT', 160, 76, { align: 'center', color: P.cream });
      if (Math.floor(t * 2) % 2 === 0) {
        F.drawText(ctx, 'CHOOSE AN OPTION', 160, 100, { align: 'center', color: P.white });
      }
      F.drawText(ctx, 'ALL PLAYERS ARE FICTIONAL', 160, 245, { align: 'center', color: P.cream });
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
