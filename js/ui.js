// Shared drawing helpers for panels, bars and buttons.
(function () {
  const P = CC.pal;
  const F = CC.font;

  // A button: { x, y, w, h, label, key, action }. `key` is an optional keyboard shortcut.
  // Optional extras: align: 'left', disabled: true.
  function button(x, y, w, label, key, action) {
    return { x, y, w, h: 13, label, key, action };
  }

  function hit(b, x, y) {
    return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  }

  function drawButton(ctx, b, mouse) {
    const over = hit(b, mouse.x, mouse.y);
    bevel(ctx, b.x, b.y, b.w, b.h, b.disabled ? P.greyDark : over ? P.red : P.blue);
    const color = b.disabled ? P.grey : over ? P.yellow : P.white;
    if (b.align === 'left') F.drawText(ctx, b.label, b.x + 4, b.y + 3, { color });
    else F.drawText(ctx, b.label, b.x + Math.floor(b.w / 2), b.y + 3, { align: 'center', color });
  }

  // Raised box with a light top-left edge and dark bottom-right edge.
  function bevel(ctx, x, y, w, h, fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x + w - 1, y, 1, h);
  }

  // A labelled info bar like "SCORE: 0 FOR 0".
  function bar(ctx, x, y, w, label, value) {
    bevel(ctx, x, y, w, 11, P.navy);
    F.drawText(ctx, label, x + 3, y + 2, { color: P.yellow });
    if (value !== undefined) {
      F.drawText(ctx, value, x + w - 4, y + 2, { color: P.white, align: 'right' });
    }
  }

  function panel(ctx, x, y, w, h, fill) {
    ctx.fillStyle = P.black;
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    bevel(ctx, x, y, w, h, fill || P.grassDark);
  }

  CC.ui = { button, hit, drawButton, bevel, bar, panel };
})();
