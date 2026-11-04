// Generates the placeholder pixel art in assets/ as PNG files.
//
//   node tools/make-placeholder-art.js
//
// This is only needed to rebuild the placeholders. To use your own art, just
// replace the PNGs in assets/ with files of the same size and layout
// (see assets/README.md). No code changes are needed.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'assets');

// ------------------------------------------------------------------ palette
// '.' is transparent. 'c' marks team-colour pixels: drawn light grey in the
// sprite row and white in the mask row, so the game can tint them per team.
const COLOURS = {
  k: [24, 24, 24],      // outline / boots
  w: [240, 240, 232],   // whites
  W: [200, 200, 192],   // whites shadow
  s: [232, 176, 128],   // skin
  h: [96, 56, 24],      // hair
  b: [216, 184, 112],   // bat
  B: [160, 120, 64],    // bat edge
  g: [248, 248, 248],   // gloves
  p: [248, 248, 240],   // pads
  P: [208, 208, 200],   // pad straps
  c: [176, 176, 176],   // team colour (tinted at runtime)
  y: [240, 232, 200],   // stumps
  o: [240, 144, 48],    // bails
  r: [208, 32, 32],     // ball
  R: [128, 16, 16],     // ball shade
};

// -------------------------------------------------------- player sprites
// Each frame is 16 x 24. Batters and the keeper face the camera; the bowler
// is seen from behind, running towards the batter.
const PLAYER_FRAMES = {
  bat_stance: [
    '......cccc......',
    '.....cccccc.....',
    '......ssss......',
    '......ssss......',
    '.......ss.......',
    '.....wwwwww.....',
    '....wwwwwwww....',
    '....ww.ww.ww....',
    '....ww.ww.ww....',
    '....ss.ww.ggg...',
    '.......ww...b...',
    '......wwww..b...',
    '......wwww..b...',
    '.....wwwwww.B...',
    '.....ww..ww.b...',
    '.....pp..pp.b...',
    '.....pP..pP.b...',
    '.....pp..pp.b...',
    '.....pp..pp.B...',
    '.....pP..pP.b...',
    '.....pp..pp.....',
    '.....pp..pp.....',
    '.....kk..kk.....',
    '....kkk..kkk....',
  ],
  bat_swing: [
    '......cccc....b.',
    '.....cccccc..bb.',
    '......ssss..bB..',
    '......ssss.bb...',
    '.......ss.gg....',
    '.....wwwwwgg....',
    '....wwwwwww.....',
    '....ww.ww.......',
    '....ww.ww.......',
    '....ss.ww.......',
    '.......ww.......',
    '......wwww......',
    '......wwww......',
    '.....wwwwww.....',
    '.....ww..ww.....',
    '.....pp...pp....',
    '.....pP...pP....',
    '....pp....pp....',
    '....pp....pp....',
    '....pP.....pP...',
    '....pp.....pp...',
    '....pp.....pp...',
    '....kk.....kk...',
    '...kkk.....kkk..',
  ],
  bowl_run1: [
    '................',
    '......cccc......',
    '......cccc......',
    '......hhhh......',
    '......hhhh......',
    '.......ss.......',
    '.....wwwwww.....',
    '....wwwwwwww....',
    '...ww.wwww.ww...',
    '...ww.wwww.ww...',
    '...s..wwww..s...',
    '......wwww......',
    '......wwww......',
    '.....wwwwww.....',
    '.....ww..ww.....',
    '....ww....ww....',
    '....ww.....ww...',
    '...ww......ww...',
    '...ww.......ww..',
    '...ww.......ww..',
    '..ww.........k..',
    '..ww............',
    '.kkk............',
    '................',
  ],
  bowl_run2: [
    '................',
    '......cccc......',
    '......cccc......',
    '......hhhh......',
    '......hhhh......',
    '.......ss.......',
    '.....wwwwww.....',
    '....wwwwwwww....',
    '...ww.wwww.ww...',
    '...ww.wwww.ww...',
    '...s..wwww..s...',
    '......wwww......',
    '......wwww......',
    '.....wwwwww.....',
    '.....ww..ww.....',
    '.....ww...ww....',
    '....ww.....ww...',
    '....ww.....ww...',
    '...ww.......ww..',
    '...ww.......ww..',
    '...k........ww..',
    '............ww..',
    '............kkk.',
    '................',
  ],
  bowl_release: [
    '..........ss....',
    '......cccc.w....',
    '......ccccww....',
    '......hhhhw.....',
    '......hhhhw.....',
    '.......ssw......',
    '.....wwwwww.....',
    '....wwwwwww.....',
    '...ww.wwww......',
    '...ww.wwww......',
    '...s..wwww......',
    '......wwww......',
    '......wwww......',
    '.....wwwwww.....',
    '.....ww..ww.....',
    '.....ww..ww.....',
    '.....ww..ww.....',
    '.....ww..ww.....',
    '.....ww..ww.....',
    '.....ww..ww.....',
    '.....ww..ww.....',
    '.....ww..ww.....',
    '.....kk..kk.....',
    '....kkk..kkk....',
  ],
  keeper: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......cccc......',
    '.....cccccc.....',
    '......ssss......',
    '......ssss......',
    '.......ss.......',
    '....wwwwwwww....',
    '...wwwwwwwwww...',
    '..gg.wwwwww.gg..',
    '..gg.wwwwww.gg..',
    '.....wwwwww.....',
    '....pwwwwwwp....',
    '...pp......pp...',
    '...pP......pP...',
    '...pp......pp...',
    '...pp......pp...',
    '...pp......pp...',
    '..kkk......kkk..',
    '................',
  ],
  fielder: [
    '......cccc......',
    '.....cccccc.....',
    '......ssss......',
    '......ssss......',
    '.......ss.......',
    '.....wwwwww.....',
    '....wwwwwwww....',
    '....ww.ww.ww....',
    '....ww.ww.ww....',
    '....s..ww..s....',
    '.......ww.......',
    '......wwww......',
    '......wwww......',
    '.....wwwwww.....',
    '.....ww..ww.....',
    '.....ww..ww.....',
    '.....ww..ww.....',
    '.....ww..ww.....',
    '.....ww..ww.....',
    '.....ww..ww.....',
    '.....ww..ww.....',
    '.....ww..ww.....',
    '.....kk..kk.....',
    '....kkk..kkk....',
  ],
};

// ------------------------------------------------------------ prop sprites
// Each frame is 16 x 16.
const PROP_FRAMES = {
  stumps: [
    '................',
    '................',
    '................',
    '.....oooooo.....',
    '.....y.y.y......',
    '.....y.y.y......',
    '.....y.y.y......',
    '.....y.y.y......',
    '.....y.y.y......',
    '.....y.y.y......',
    '.....y.y.y......',
    '.....y.y.y......',
    '.....y.y.y......',
    '.....y.y.y......',
    '.....y.y.y......',
    '................',
  ],
  stumps_broken: [
    '..oo.........o..',
    '.............o..',
    '................',
    '................',
    '...y............',
    '....y..y...y....',
    '....y..y..y.....',
    '.....y.y..y.....',
    '.....y.y.y......',
    '.....y.y.y......',
    '.....y.y.y......',
    '.....y.y.y......',
    '.....y.y.y......',
    '.....y.y.y......',
    '.....y.y.y......',
    '................',
  ],
  ball: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......rr.......',
    '......rrrr......',
    '......rrRr......',
    '.......RR.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
};

// ------------------------------------------------------------------- image
function image(w, h) {
  return { w, h, data: new Uint8Array(w * h * 4) };
}
function set(img, x, y, rgb, a) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const i = (y * img.w + x) * 4;
  img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = a === undefined ? 255 : a;
}
function rect(img, x, y, w, h, rgb) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(img, x + i, y + j, rgb);
}

// Sprite sheet: one row of frames, plus (optionally) a second row holding the
// team-colour mask for each frame.
function sheet(frames, fw, fh, withMask) {
  const names = Object.keys(frames);
  const img = image(fw * names.length, fh * (withMask ? 2 : 1));
  names.forEach((name, f) => {
    const rows = frames[name];
    if (rows.length !== fh) throw new Error(name + ' has ' + rows.length + ' rows, expected ' + fh);
    rows.forEach((row, y) => {
      if (row.length !== fw) throw new Error(name + ' row ' + y + ' is ' + row.length + ' wide');
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const rgb = COLOURS[ch];
        if (!rgb) throw new Error('Unknown colour ' + ch + ' in ' + name);
        set(img, f * fw + x, y, rgb);
        if (withMask && ch === 'c') set(img, f * fw + x, fh + y, [255, 255, 255]);
      });
    });
  });
  return { img, names };
}

// Pitch close-up background, 154 x 188 (the inside of the pitch panel).
// Coordinates here must match PITCH in js/screens/match.js.
function pitchBackground() {
  const W = 154, H = 188;
  const img = image(W, H);
  const light = [64, 176, 64], dark = [32, 144, 32], strip = [200, 176, 112], worn = [176, 152, 96], white = [255, 255, 255];
  for (let y = 0; y < H; y++) rect(img, 0, y, W, 1, Math.floor(y / 8) % 2 ? dark : light);
  const sx = 57, sw = 40, top = 21, bottom = 149;
  rect(img, sx, top, sw, bottom - top, strip);
  // Worn patches where the bowlers land and the batters stand.
  rect(img, sx + 12, top + 18, 16, 10, worn);
  rect(img, sx + 14, bottom - 30, 12, 8, worn);
  // Bowling creases (in line with the stumps) and popping creases.
  rect(img, sx - 2, top + 22, sw + 4, 1, white);
  rect(img, sx - 8, top + 30, sw + 16, 1, white);
  rect(img, sx - 2, bottom - 14, sw + 4, 1, white);
  rect(img, sx - 8, bottom - 22, sw + 16, 1, white);
  // Return creases.
  rect(img, sx + 2, top + 22, 1, 12, white);
  rect(img, sx + sw - 3, top + 22, 1, 12, white);
  rect(img, sx + 2, bottom - 26, 1, 12, white);
  rect(img, sx + sw - 3, bottom - 26, 1, 12, white);
  return img;
}

// Top-down ground for the overview, 133 x 133 with a transparent outside.
function groundOverview() {
  const S = 133, c = 66, r = 66;
  const img = image(S, S);
  const grass = [32, 144, 32], grass2 = [40, 160, 40], rope = [255, 255, 255], strip = [200, 176, 112], ring = [64, 176, 64];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - c, y - c);
    if (d <= r) set(img, x, y, Math.floor((x + 4) / 10) % 2 ? grass : grass2);
  }
  // Boundary rope (dotted) and the 30-yard circle.
  for (let a = 0; a < 360; a += 3) {
    const t = a * Math.PI / 180;
    set(img, Math.round(c + Math.cos(t) * r), Math.round(c + Math.sin(t) * r), rope);
  }
  for (let a = 0; a < 360; a += 6) {
    const t = a * Math.PI / 180;
    set(img, Math.round(c + Math.cos(t) * 30), Math.round(c + Math.sin(t) * 30), ring);
  }
  rect(img, c - 2, c - 12, 4, 24, strip);
  return img;
}

// ---------------------------------------------------------------- PNG out
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(img) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0); ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((img.w * 4 + 1) * img.h);
  for (let y = 0; y < img.h; y++) {
    raw[y * (img.w * 4 + 1)] = 0;
    Buffer.from(img.data.buffer, y * img.w * 4, img.w * 4).copy(raw, y * (img.w * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
function write(name, img) {
  fs.writeFileSync(path.join(OUT, name), png(img));
  console.log('wrote assets/' + name, img.w + 'x' + img.h);
}

const players = sheet(PLAYER_FRAMES, 16, 24, true);
const props = sheet(PROP_FRAMES, 16, 16, false);
write('players.png', players.img);
write('props.png', props.img);
write('pitch.png', pitchBackground());
write('ground.png', groundOverview());
console.log('player frames:', players.names.join(', '));
console.log('prop frames:', props.names.join(', '));
