// Core engine: canvas scaling, main loop, input, and the screen manager.
//
// A screen is an object with any of these optional methods:
//   enter(params)   called when the screen becomes active
//   update(dt)      called every frame, dt in seconds
//   draw(ctx)       called every frame after update
//   onKey(key)      called on key presses (key is KeyboardEvent.key)
//   onClick(x, y)   called on clicks/taps, in native 320x256 coordinates
// and may set `this.buttons` to an array of CC.ui buttons, which the engine
// draws, highlights and clicks automatically.
(function () {
  const W = CC.config.width;
  const H = CC.config.height;

  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const screens = {};
  let current = null;
  let currentName = '';
  const mouse = { x: -1, y: -1 };

  // Scale the canvas by the largest whole number that fits, so pixels stay square.
  // On very small screens fall back to a fractional fit.
  function resize() {
    const fit = Math.min(window.innerWidth / W, window.innerHeight / H);
    const scale = fit >= 1 ? Math.floor(fit) : fit;
    canvas.style.width = Math.floor(W * scale) + 'px';
    canvas.style.height = Math.floor(H * scale) + 'px';
  }

  function toNative(evt) {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.floor((evt.clientX - r.left) * W / r.width),
      y: Math.floor((evt.clientY - r.top) * H / r.height),
    };
  }

  function register(name, screen) { screens[name] = screen; }

  function go(name, params) {
    const next = screens[name];
    if (!next) throw new Error('Unknown screen: ' + name);
    current = next;
    currentName = name;
    current.buttons = [];
    if (current.enter) current.enter(params || {});
  }

  function frame(dt) {
    if (!current) return;
    if (current.update) current.update(dt);
    ctx.fillStyle = CC.pal.black;
    ctx.fillRect(0, 0, W, H);
    if (current.draw) current.draw(ctx);
    if (current.buttons) current.buttons.forEach(b => CC.ui.drawButton(ctx, b, mouse));
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    frame(dt);
    requestAnimationFrame(loop);
  }

  canvas.addEventListener('pointermove', e => {
    const p = toNative(e);
    mouse.x = p.x; mouse.y = p.y;
    const over = current && current.buttons && current.buttons.some(b => CC.ui.hit(b, p.x, p.y));
    canvas.style.cursor = over ? 'pointer' : 'default';
  });
  canvas.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1; });
  canvas.addEventListener('pointerdown', e => {
    if (!current) return;
    const p = toNative(e);
    mouse.x = p.x; mouse.y = p.y;
    const btn = (current.buttons || []).find(b => CC.ui.hit(b, p.x, p.y));
    if (btn) { btn.action(); return; }
    if (current.onClick) current.onClick(p.x, p.y);
  });
  window.addEventListener('keydown', e => {
    if (!current) return;
    const key = e.key;
    const btn = (current.buttons || []).find(b => b.key && b.key.toLowerCase() === key.toLowerCase());
    if (btn) { e.preventDefault(); btn.action(); return; }
    if (current.onKey) current.onKey(key);
  });
  window.addEventListener('resize', resize);

  function start(firstScreen) {
    resize();
    go(firstScreen);
    requestAnimationFrame(loop);
  }

  CC.engine = {
    W, H, ctx, canvas, register, go, start,
    get screenName() { return currentName; },
  };
})();
