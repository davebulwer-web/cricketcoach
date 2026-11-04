// Loads the art in assets/ and draws sprites from it.
//
// Every image the game uses is listed in SHEETS below. To swap in your own
// art, replace a PNG with one of the same size and frame layout; the frame
// names here say what each cell is for (see assets/README.md).
(function () {
  const SHEETS = {
    // 16x24 frames in one row, with a second row of team-colour masks:
    // white pixels in the mask row are tinted with the team's colour.
    players: {
      src: 'assets/players.png', fw: 16, fh: 24, mask: true,
      frames: ['bat_stance', 'bat_swing', 'bowl_run1', 'bowl_run2', 'bowl_release', 'keeper', 'fielder'],
    },
    // 16x16 frames in one row.
    props: {
      src: 'assets/props.png', fw: 16, fh: 16,
      frames: ['stumps', 'stumps_broken', 'ball'],
    },
    // Whole-image backgrounds.
    pitch: { src: 'assets/pitch.png' },    // 154x188, inside of the pitch panel
    ground: { src: 'assets/ground.png' },  // 133x133, overview of the ground
  };

  const images = {};
  const tintCache = {};

  // Load every sheet, then call done(). Missing files are reported in the
  // console and drawn as magenta boxes, so the game still runs.
  function load(done) {
    const names = Object.keys(SHEETS);
    let left = names.length;
    names.forEach(name => {
      const img = new Image();
      img.onload = () => { images[name] = img; if (--left === 0) done(); };
      img.onerror = () => { console.error('Could not load ' + SHEETS[name].src); if (--left === 0) done(); };
      img.src = SHEETS[name].src;
    });
  }

  function frameIndex(sheet, frame) {
    const i = SHEETS[sheet].frames.indexOf(frame);
    if (i < 0) throw new Error('Unknown frame ' + sheet + '.' + frame);
    return i;
  }

  // Build (once) a canvas holding the frame with its team colour applied.
  function tinted(sheet, frame, colour) {
    const key = sheet + '.' + frame + '.' + colour;
    if (tintCache[key]) return tintCache[key];
    const s = SHEETS[sheet], img = images[sheet], i = frameIndex(sheet, frame);
    const c = document.createElement('canvas');
    c.width = s.fw; c.height = s.fh;
    const g = c.getContext('2d');
    // Colour the mask, then lay it over the base frame. Uses compositing
    // only (no pixel reads) so it also works when opened from disk.
    g.drawImage(img, i * s.fw, s.fh, s.fw, s.fh, 0, 0, s.fw, s.fh);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = colour;
    g.fillRect(0, 0, s.fw, s.fh);
    g.globalCompositeOperation = 'destination-over';
    g.drawImage(img, i * s.fw, 0, s.fw, s.fh, 0, 0, s.fw, s.fh);
    tintCache[key] = c;
    return c;
  }

  // draw(ctx, 'players', 'bat_stance', x, y, { tint: '#d02020', scale: 2 })
  // draw(ctx, 'pitch', null, x, y) for whole-image backgrounds.
  function draw(ctx, sheet, frame, x, y, opts) {
    opts = opts || {};
    const s = SHEETS[sheet], img = images[sheet], k = opts.scale || 1;
    x = Math.round(x); y = Math.round(y);
    if (!img) {
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(x, y, (s.fw || 16) * k, (s.fh || 16) * k);
      return;
    }
    if (!s.frames) { ctx.drawImage(img, x, y, img.width * k, img.height * k); return; }
    if (s.mask && opts.tint) {
      ctx.drawImage(tinted(sheet, frame, opts.tint), x, y, s.fw * k, s.fh * k);
      return;
    }
    const i = frameIndex(sheet, frame);
    ctx.drawImage(img, i * s.fw, 0, s.fw, s.fh, x, y, s.fw * k, s.fh * k);
  }

  CC.sprites = { SHEETS, load, draw };
})();
