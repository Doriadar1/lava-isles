// Screen-space juice: pixel confetti, sparkle bursts, gems flying to the counter.
(function () {
  const c = document.getElementById('fx'), x = c.getContext('2d');
  const P = [], flyers = [];
  for (let i = 0; i < 700; i++) P.push({ on: false });
  function size() { c.width = innerWidth; c.height = innerHeight; }
  size(); addEventListener('resize', size);
  const CONF = ['#ffd23a', '#ff7e26', '#3fd08a', '#6fe3ff', '#ff8ccf', '#b98bff', '#ffffff'];
  function spawn(px, py, vx, vy, life, col, sz, grav) {
    for (const p of P) if (!p.on) { Object.assign(p, { on: true, x: px, y: py, vx, vy, life, max: life, col, sz, grav }); return; }
  }
  const center = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const FX = {
    burst(px, py, n, cols, speed) {
      cols = cols || CONF; speed = speed || 420;
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = (0.3 + Math.random()) * speed; spawn(px, py, Math.cos(a) * s, Math.sin(a) * s - speed * .3, 0.7 + Math.random() * 0.6, cols[(Math.random() * cols.length) | 0], Math.random() < .3 ? 10 : 6, 900); }
    },
    burstEl(el, n, cols, speed) { const [a, b] = center(el); FX.burst(a, b, n, cols, speed); },
    confetti(n) { for (let i = 0; i < (n || 160); i++) spawn(Math.random() * c.width, -20 - Math.random() * 200, (Math.random() - .5) * 200, 100 + Math.random() * 200, 3 + Math.random() * 2, CONF[(Math.random() * CONF.length) | 0], 8, 60); },
    sparkle(el) { const r = el.getBoundingClientRect(); for (let i = 0; i < 18; i++) spawn(r.left + Math.random() * r.width, r.top + Math.random() * r.height, 0, -40 - Math.random() * 60, 0.6 + Math.random() * .5, Math.random() < .5 ? '#fff5c0' : '#ffd23a', 6, -20); },
    // gems fly from an element to the gem counter, one "ding" each
    gems(fromEl, n, onEach) {
      const [sx, sy] = Array.isArray(fromEl) ? fromEl : fromEl ? center(fromEl) : [innerWidth / 2, innerHeight / 2];
      const tgt = document.querySelector('#gems .gi');
      const [tx, ty] = tgt ? center(tgt) : [40, 40];
      const img = SPR.pixEmoji('💎', 14);
      for (let i = 0; i < n; i++) flyers.push({ sx: sx + (Math.random() - .5) * 60, sy: sy + (Math.random() - .5) * 40, tx, ty, t: -i * 0.06, img, onEach });
    },
  };
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    x.clearRect(0, 0, c.width, c.height);
    for (const p of P) {
      if (!p.on) continue;
      p.life -= dt; if (p.life <= 0) { p.on = false; continue; }
      p.vy += p.grav * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life < p.max * 0.3 && ((now / 60) | 0) % 2) continue;
      x.fillStyle = p.col; x.fillRect(Math.round(p.x / 2) * 2, Math.round(p.y / 2) * 2, p.sz, p.sz);
    }
    x.imageSmoothingEnabled = false;
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i]; f.t += dt * 1.6;
      if (f.t < 0) continue;
      if (f.t >= 1) { flyers.splice(i, 1); AUD.sfx('coin'); f.onEach && f.onEach(); continue; }
      const k = f.t * f.t * (3 - 2 * f.t), mx = (f.sx + f.tx) / 2, my = Math.min(f.sy, f.ty) - 160;
      const px = (1 - k) * (1 - k) * f.sx + 2 * (1 - k) * k * mx + k * k * f.tx, py = (1 - k) * (1 - k) * f.sy + 2 * (1 - k) * k * my + k * k * f.ty;
      x.drawImage(f.img, Math.round(px - 24), Math.round(py - 24), 48, 48);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  window.FX = FX;
})();
