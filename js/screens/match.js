// Match screen. Step 1 lays out the panels; the match engine arrives in step 2.
(function () {
  const P = CC.pal;
  const F = CC.font;

  CC.engine.register('match', {
    enter() {
      this.buttons = [
        CC.ui.button(4, 226, 96, 'SCORECARD', 's', () => CC.engine.go('scorecard')),
        CC.ui.button(228, 226, 88, 'QUIT', 'Escape', () => CC.engine.go('title')),
      ];
    },

    draw(ctx) {
      ctx.fillStyle = P.greyDark;
      ctx.fillRect(0, 0, 320, 256);

      CC.ui.bar(ctx, 2, 2, 156, 'SCORE:', '0 FOR 0');
      CC.ui.bar(ctx, 162, 2, 156, 'BATSMAN:', CC.game.home.players[0].name);

      drawOverview(ctx, 2, 16, 156, 190);
      drawPitchView(ctx, 162, 16, 156, 190);

      CC.ui.bar(ctx, 2, 209, 316, 'COMMENT:', 'MATCH ENGINE ARRIVES IN STEP 2');
    },
  });

  // Top-down view of the whole ground with fielder positions.
  function drawOverview(ctx, x, y, w, h) {
    CC.ui.panel(ctx, x, y, w, h, P.grassDark);
    F.drawText(ctx, 'OVERVIEW', x + w / 2, y + 4, { align: 'center', color: P.yellow });
    const cx = x + w / 2, cy = y + h / 2 + 6, r = 70;
    ctx.fillStyle = P.grass;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = P.white;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Pitch strip.
    ctx.fillStyle = P.pitch;
    ctx.fillRect(cx - 2, cy - 12, 4, 24);
    // Placeholder fielding positions (normal field), relative to the centre.
    const field = [[0, -18], [-14, 6], [18, -20], [-40, -30], [40, -24], [-50, 20],
                   [46, 24], [-10, 50], [24, 52], [0, 16], [8, -30]];
    ctx.fillStyle = P.white;
    field.forEach(([fx, fy]) => ctx.fillRect(cx + fx - 1, cy + fy - 1, 2, 2));
  }

  // Close-up of the pitch from behind the bowler.
  function drawPitchView(ctx, x, y, w, h) {
    CC.ui.panel(ctx, x, y, w, h, P.grass);
    for (let i = 0; i < h - 2; i += 8) {
      ctx.fillStyle = (i / 8) % 2 ? P.grass : P.grassLite;
      ctx.fillRect(x + 1, y + 1 + i, w - 2, Math.min(8, h - 2 - i));
    }
    const px = x + w / 2 - 20;
    ctx.fillStyle = P.pitch;
    ctx.fillRect(px, y + 10, 40, h - 20);
    ctx.fillStyle = P.white;
    ctx.fillRect(px - 6, y + 30, 52, 1);
    ctx.fillRect(px - 6, y + h - 40, 52, 1);
    // Stumps at the batting end.
    ctx.fillStyle = P.cream;
    for (let i = 0; i < 3; i++) ctx.fillRect(px + 16 + i * 3, y + 20, 2, 10);
  }
})();
