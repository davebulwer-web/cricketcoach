// Built-in 5x7 bitmap font so text is always crisp and needs no font files.
// Each glyph is 7 rows; each row is a 5-bit number (bit 4 = leftmost pixel).
// Lower-case letters are drawn as capitals, in keeping with the retro look.
(function () {
  const G = {
    'A': [14,17,17,31,17,17,17], 'B': [30,17,17,30,17,17,30], 'C': [14,17,16,16,16,17,14],
    'D': [30,17,17,17,17,17,30], 'E': [31,16,16,30,16,16,31], 'F': [31,16,16,30,16,16,16],
    'G': [14,17,16,23,17,17,15], 'H': [17,17,17,31,17,17,17], 'I': [14,4,4,4,4,4,14],
    'J': [7,2,2,2,2,18,12],      'K': [17,18,20,24,20,18,17], 'L': [16,16,16,16,16,16,31],
    'M': [17,27,21,21,17,17,17], 'N': [17,17,25,21,19,17,17], 'O': [14,17,17,17,17,17,14],
    'P': [30,17,17,30,16,16,16], 'Q': [14,17,17,17,21,18,13], 'R': [30,17,17,30,20,18,17],
    'S': [15,16,16,14,1,1,30],   'T': [31,4,4,4,4,4,4],       'U': [17,17,17,17,17,17,14],
    'V': [17,17,17,17,17,10,4],  'W': [17,17,17,21,21,21,10], 'X': [17,17,10,4,10,17,17],
    'Y': [17,17,10,4,4,4,4],     'Z': [31,1,2,4,8,16,31],
    '0': [14,17,19,21,25,17,14], '1': [4,12,4,4,4,4,14],      '2': [14,17,1,2,4,8,31],
    '3': [31,2,4,2,1,17,14],     '4': [2,6,10,18,31,2,2],     '5': [31,16,30,1,1,17,14],
    '6': [6,8,16,30,17,17,14],   '7': [31,1,2,4,8,8,8],       '8': [14,17,17,14,17,17,14],
    '9': [14,17,17,15,1,2,12],
    ' ': [0,0,0,0,0,0,0],        '.': [0,0,0,0,0,12,12],      ',': [0,0,0,0,12,4,8],
    ':': [0,12,12,0,12,12,0],    '-': [0,0,0,31,0,0,0],       '!': [4,4,4,4,4,0,4],
    '?': [14,17,1,2,4,0,4],      "'": [4,4,8,0,0,0,0],        '/': [1,1,2,4,8,16,16],
    '(': [2,4,8,8,8,4,2],        ')': [8,4,2,2,2,4,8],        '+': [0,4,4,31,4,4,0],
    '=': [0,0,31,0,31,0,0],      '*': [0,4,21,14,21,4,0],     '>': [8,4,2,1,2,4,8],
    '<': [2,4,8,16,8,4,2],       '#': [10,10,31,10,31,10,10], '%': [24,25,2,4,8,19,3],
    '&': [12,18,20,8,21,18,13],
  };

  const ADVANCE = 6;   // 5px glyph + 1px gap
  const LINE = 9;

  // Draw text at (x, y). opts: { color, scale, align: 'left'|'center'|'right', shadow }
  function drawText(ctx, text, x, y, opts) {
    opts = opts || {};
    const s = opts.scale || 1;
    const str = String(text).toUpperCase();
    const w = textWidth(str, s);
    if (opts.align === 'center') x -= Math.floor(w / 2);
    else if (opts.align === 'right') x -= w;
    if (opts.shadow) drawRaw(ctx, str, x + s, y + s, opts.shadow, s);
    drawRaw(ctx, str, x, y, opts.color || CC.pal.white, s);
    return w;
  }

  function drawRaw(ctx, str, x, y, color, s) {
    ctx.fillStyle = color;
    for (let i = 0; i < str.length; i++) {
      const g = G[str[i]] || G['?'];
      for (let row = 0; row < 7; row++) {
        const bits = g[row];
        if (!bits) continue;
        for (let col = 0; col < 5; col++) {
          if (bits & (16 >> col)) ctx.fillRect(x + (i * ADVANCE + col) * s, y + row * s, s, s);
        }
      }
    }
  }

  function textWidth(text, scale) {
    const n = String(text).length;
    return n ? (n * ADVANCE - 1) * (scale || 1) : 0;
  }

  CC.font = { drawText, textWidth, ADVANCE, LINE };
})();
