// The island map: procedural pixel terrain with flowing lava, castles, bridges, dragons, creatures, decorations and the hero.
// The world is bigger than the screen: drag to look around, mouse wheel to zoom.
(function () {
  const WW = 520, WH = 300, M = 70;
  const { Raster, hex } = SPR;
  const rgb32 = h => { const [r, g, b] = hex(h); return (255 << 24) | (b << 16) | (g << 8) | r; };

  const C = {
    sea: ['#0c1830', '#10213d', '#15294a'].map(rgb32), shallow: rgb32('#1d3d62'), foam: rgb32('#8fcde3'), glint: rgb32('#5f9fc4'),
    rock: ['#2b1d2a', '#35233a', '#402b40', '#4b3344'].map(rgb32), rockHi: rgb32('#5e4152'),
    warm: ['#4a2230', '#5a2a30'].map(rgb32), crust: rgb32('#1a0e16'),
    cliff: ['#1f1522', '#171019', '#120b14'].map(rgb32), cliffLava: rgb32('#3a1a22'),
    moss: ['#23443a', '#2b5540', '#346747', '#3f7a4a', '#5a9650'].map(rgb32), mossHi: rgb32('#86c068'),
    flowers: ['#ff8ccf', '#ffd23a', '#b98bff', '#6fe3ff', '#ff7a5a'].map(rgb32),
    sand: [rgb32('#3d2c36'), rgb32('#4a3740')], sandHeal: [rgb32('#7a5a4a'), rgb32('#96725a')],
  };
  const LAVA = ['#4a0f12', '#6e1614', '#98241a', '#c4381c', '#e8561e', '#ff7e26', '#ffa838', '#ffd262', '#fff0a8', '#ffd262', '#ffa838', '#ff7e26', '#e8561e', '#c4381c', '#98241a', '#6e1614'].map(rgb32);

  // ── deterministic noise ──────────────────────────────────────────────
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, y) => vnoise(x / 18, y / 18) * 0.6 + vnoise(x / 7, y / 7) * 0.3 + vnoise(x / 3, y / 3) * 0.1;
  let seedRand = 1;
  const rnd = () => { seedRand = (seedRand * 16807) % 2147483647; return seedRand / 2147483647; };

  // ── geography (the old small map, scaled up 1.6x around the main island) ──
  const MAIN = { cx: 250, cy: 150, rx: 150, ry: 88 };
  const T = (x, y) => [Math.round(MAIN.cx + (x - 148) * 1.6), Math.round(MAIN.cy + (y - 80) * 1.6)];
  const ISLES = [
    { name: 'Fox Island', word: 'fox', cx: 462, cy: 52, rx: 46, ry: 28, bridge: [[372, 92], [428, 64]], boss: { name: 'Grumble', elem: 'leaf', hp: 8, time: 20 } },
    { name: 'Cat Island', word: 'cat', cx: 474, cy: 208, rx: 44, ry: 30, bridge: [[396, 180], [440, 198]], boss: { name: 'Sootwing', elem: 'shadow', hp: 10, time: 17 } },
    { name: 'Dragon Island', word: 'dragon', cx: 60, cy: 234, rx: 50, ry: 26, bridge: [[130, 208], [96, 226]], boss: { name: 'Blaze', elem: 'lava', hp: 12, time: 15 } },
    { name: 'Star Island', word: 'star', cx: 52, cy: 62, rx: 46, ry: 30, bridge: [[128, 98], [88, 76]], boss: { name: 'King Scorch', elem: 'gold', hp: 15, time: 13 } },
  ];
  const CASTLES = [T(88, 106), T(180, 62), T(198, 112)].map(([x, y]) => ({ x, y }));
  const [vx0, vy0] = T(124, 58), VOLCANO = { x: vx0, y: vy0 };
  const RIVERS = [
    [[120, 48], [108, 60], [92, 70], [74, 78], [58, 84], [44, 88]],
    [[128, 52], [140, 72], [146, 92], [140, 114], [138, 142]],
    [[130, 46], [150, 40], [170, 34], [192, 26], [206, 20]],
  ].map(R => R.map(p => T(p[0], p[1])));
  const field = (x, y, I) => 1 - Math.sqrt(((x - I.cx) / I.rx) ** 2 + ((y - I.cy) / I.ry) ** 2) + (fbm(x + I.cx, y) - 0.5) * 0.3;
  function landAt(x, y) {
    let best = field(x, y, MAIN), who = -1;
    ISLES.forEach((I, i) => { const f = field(x, y, I); if (f > best) { best = f; who = i; } });
    return { v: best, who };
  }
  function distSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
    return { d: Math.hypot(px - ax - t * dx, py - ay - t * dy), t };
  }
  function riverAt(x, y) {
    let best = 99, s = 0;
    RIVERS.forEach(R => {
      let acc = 0;
      for (let i = 0; i < R.length - 1; i++) {
        const [ax, ay] = R[i], [bx, by] = R[i + 1], len = Math.hypot(bx - ax, by - ay);
        const q = distSeg(x, y, ax, ay, bx, by);
        if (q.d < best) { best = q.d; s = acc + q.t * len; }
        acc += len;
      }
    });
    return { d: best, s };
  }
  // make sure bridge ends sit on land
  ISLES.forEach(I => {
    const pull = (p, T_) => { for (let k = 0; k < 60 && landAt(p[0], p[1]).v < 0.12; k++) { const d = Math.hypot(T_.cx - p[0], T_.cy - p[1]); p[0] += (T_.cx - p[0]) / d; p[1] += (T_.cy - p[1]) / d; } p[0] = Math.round(p[0]); p[1] = Math.round(p[1]); };
    pull(I.bridge[0], MAIN); pull(I.bridge[1], I);
  });

  // ── state for rendering ──────────────────────────────────────────────
  let disp, dctx, lcv, lctx, img, buf, base, LW = 0, LH = 0, OX = 0, OY = 0, SCALE = 1, VW = 0, VH = 0, zoom = 0;
  let lavaPix = null, lavaPhase = null, foamPix = null, glintPix = [], glow = null, landWho = null, landV = null;
  const cam = { x: 0, y: 0, tx: 0, ty: 0, manual: 0, set: false };
  const objects = [];
  let hovered = null, t = 0, pointer = null;
  const hooks = {};
  const [hx0, hy0] = T(114, 94);
  const hero = { x: hx0, y: hy0, path: [], onArrive: null, frame: 0, ft: 0, flip: false, where: -1, busy: 0, bob: 0 };
  const creatures = [];
  const bridgeAnim = [0, 0, 0, 0];
  const markers = [];
  const visitors = [];
  let nextVisit = 18;
  // placing a decoration: { k, onPlace(x, y, isle) }
  let place = null;

  let glob = 0;
  function heal(x, y) {
    const S = ST.S;
    let h = 0;
    CASTLES.forEach((c, i) => {
      const L = S.castles[i]; if (!L) return;
      const r = 16 + L * 21, d = Math.hypot(x - c.x, (y - c.y) * 1.3);
      h = Math.max(h, 1 - d / r);
    });
    ISLES.forEach((I, i) => {
      const is = S.isles[i]; if (!is.won) return;
      const r = 18 + is.castle * 14, d = Math.hypot(x - I.cx, (y - I.cy) * 1.2);
      h = Math.max(h, 1 - d / r);
    });
    return Math.max(h * 1.6, glob * 0.9 - 0.25);
  }

  // ── bake static terrain ──────────────────────────────────────────────
  function bake() {
    const N = LW * LH;
    glob = ST.progress() / 100;   // the whole island greens up as you go
    base = new Uint32Array(N);
    const lava = [], phase = [], foam = [];
    landWho = new Int8Array(N).fill(-2); landV = new Float32Array(N);
    for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
      const wx = x - OX, wy = y - OY, i = y * LW + x;
      const L = landAt(wx, wy); landV[i] = L.v; landWho[i] = L.v > 0 ? L.who : -2;
    }
    const isLand = (x, y) => x >= 0 && y >= 0 && x < LW && y < LH && landWho[y * LW + x] !== -2;
    for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
      const wx = x - OX, wy = y - OY, i = y * LW + x, n = hash(wx, wy), f = fbm(wx * 1.7, wy * 1.7);
      if (!isLand(x, y)) {
        // cliffs hang below land edges (the 2.5D look)
        let cliff = 0;
        for (let k = 1; k <= 5; k++) if (isLand(x, y - k)) { cliff = k; break; }
        if (cliff) {
          const r = landWho[(y - cliff) * LW + x] === -1 ? riverAt(wx, wy - cliff) : { d: 99 };
          base[i] = r.d < 3 ? (cliff < 3 ? LAVA[6] : C.cliffLava) : C.cliff[Math.min(2, (cliff - 1) >> 1)];
          if (r.d < 3 && cliff < 4) { lava.push(i); phase.push(r.s * 0.5 + cliff * 2); }
          continue;
        }
        const v = landV[i];
        if (v > -0.06) { base[i] = C.shallow; if (v > -0.035 || (v > -0.05 && n > 0.6)) foam.push(i); continue; }
        base[i] = C.sea[f > 0.62 ? 2 : f > 0.45 ? 1 : 0];
        if (n > 0.9975) glintPix.push(i);
        continue;
      }
      const v = landV[i], who = landWho[i];
      const H = heal(wx, wy) + (f - 0.5) * 0.5;
      const healed = H > 0.35;
      const r = who === -1 ? riverAt(wx, wy) : { d: 99, s: 0 };
      const rw = 2.4 + vnoise(wx / 6, wy / 6) * 1.8;
      const dv = Math.hypot(wx - VOLCANO.x, (wy - VOLCANO.y) * 1.4);
      if (r.d < rw && dv > 10) { base[i] = LAVA[8]; lava.push(i); phase.push(r.s * 0.55 + n * 1.5); continue; }
      if (r.d < rw + 1 && dv > 10) { base[i] = C.crust; continue; }
      if (v < 0.06) { base[i] = healed ? C.sandHeal[n > 0.5 ? 1 : 0] : C.sand[n > 0.5 ? 1 : 0]; continue; }
      if (healed) {
        const k = Math.min(4, Math.floor((f * 0.8 + (H - 0.35) * 0.9) * 5));
        base[i] = C.moss[Math.max(0, k)];
        if (n > 0.975) base[i] = C.flowers[Math.floor(hash(wy, wx) * 5)];
        else if (n > 0.94) base[i] = C.mossHi;
      } else {
        const warm = r.d < rw + 5;
        const k = Math.min(3, Math.floor(f * 4.2));
        base[i] = warm ? C.warm[n > 0.5 ? 1 : 0] : C.rock[Math.max(0, k)];
        if (!warm && n > 0.97) base[i] = C.rockHi;
      }
      if (!isLand(x, y - 1)) base[i] = healed ? C.mossHi : C.rockHi;
    }
    lavaPix = Int32Array.from(lava); lavaPhase = Float32Array.from(phase); foamPix = Int32Array.from(foam);
    // warm glow around lava, dithered so it stays pixel-crisp
    glow = SPR.cv(LW, LH);
    const g = glow.getContext('2d'), gd = g.createImageData(LW, LH), gp = new Uint32Array(gd.data.buffer);
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const dist = new Float32Array(N).fill(99);
    lava.forEach(i => (dist[i] = 0));
    for (let y = 1; y < LH - 1; y++) for (let x = 1; x < LW - 1; x++) {
      const i = y * LW + x;
      dist[i] = Math.min(dist[i], dist[i - 1] + 1, dist[i + 1] + 1, dist[i - LW] + 1, dist[i + LW] + 1, dist[i - LW - 1] + 1.4, dist[i + LW + 1] + 1.4);
    }
    for (let y = LH - 2; y > 0; y--) for (let x = LW - 2; x > 0; x--) {
      const i = y * LW + x;
      dist[i] = Math.min(dist[i], dist[i + 1] + 1, dist[i + LW] + 1, dist[i + LW - 1] + 1.4, dist[i - LW + 1] + 1.4);
    }
    for (let i = 0; i < N; i++) {
      const d = dist[i]; if (d === 0 || d > 9) continue;
      const lvl = (1 - d / 9) * 16, bx = (i % LW) & 3, by = ((i / LW) | 0) & 3;
      if (lvl > bayer[by * 4 + bx]) gp[i] = (255 << 24) | (20 << 16) | (70 << 8) | 200;
    }
    g.putImageData(gd, 0, 0);
    buildObjects();
  }

  // ── sprites made at runtime ─────────────────────────────────────────
  const spriteCache = {};
  // st = { roof, wall, flag } colour names
  function castleSprite(level, st, frame) {
    const roof = ST.COLORS[st.roof] || st.roof, flagC = ST.COLORS[st.flag] || roof, [wc, wd, wl] = ST.WALLS[st.wall] || ST.WALLS.gray;
    const key = level + roof + wc + flagC + frame;
    if (spriteCache[key]) return spriteCache[key];
    const r = new Raster(32, 34), win = level >= 2 ? '#ffd262' : '#1a1020';
    const wall = (x, y, w, h) => { r.rect(x, y, w, h, wc); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { if ((j % 3 === 2) || ((i + (Math.floor(j / 3) % 2) * 2) % 4 === 0 && j % 3 !== 2)) r.set(x + i, y + j, wd); } r.rect(x, y, w, 1, wl); };
    const tower = (x, y, w, h, hasRoof) => {
      wall(x, y, w, h);
      if (hasRoof) { r.tri(x - 1.5, y, x + w + 1.5, y, x + w / 2, y - w * 1.1, roof); r.line(x + w / 2, y - w * 1.1, x + w / 2 - 1, y - 1, '#ffffff33'); }
      else for (let i = 0; i < w; i += 2) r.rect(x + i, y - 2, 1, 2, wc);
      r.rect(x + (w >> 1) - 1, y + 3, 2, 3, win);
    };
    if (level === 0) {
      wall(4, 20, 24, 12);
      for (let i = 4; i < 28; i++) { const cut = Math.floor(hash(i, 7) * 5); for (let j = 0; j < cut; j++) r.set(i, 20 + j, null); }
      wall(6, 12, 6, 12); for (let i = 6; i < 12; i++) for (let j = 0; j < Math.floor(hash(i, 3) * 6); j++) r.set(i, 12 + j, null);
      r.rect(14, 26, 4, 6, '#1a1020');
      [[2, 31], [29, 31], [26, 30], [3, 30]].forEach(([x, y]) => r.rect(x, y, 2, 2, wd));
    } else {
      wall(4, 20, 24, 12);
      for (let i = 4; i < 28; i += 2) r.rect(i, 18, 1, 2, wc);
      r.rect(14, 25, 4, 7, '#5a3a2a'); r.rect(15, 25, 2, 1, '#8a5a34');
      tower(3, 12, 7, 20, level >= 2);
      if (level >= 2) tower(22, 12, 7, 20, true);
      else { wall(22, 16, 7, 16); for (let i = 22; i < 29; i += 2) r.rect(i, 14, 1, 2, wc); }
      if (level >= 3) tower(12, 6, 8, 14, true);
    }
    r.outline();
    const c = r.canvas(), x = c.getContext('2d');
    if (level >= 1) { // a waving flag on the highest tower
      const [px, top, bottom] = level >= 3 ? [16, 0, 6] : level === 2 ? [6, 0, 5] : [6, 4, 10];
      x.fillStyle = '#1a1020'; x.fillRect(px, top, 1, bottom - top);
      x.fillStyle = flagC; const w = frame ? [3, 4, 4, 3] : [4, 4, 3, 3];
      w.forEach((len, j) => x.fillRect(px + 1, top + j, len, 1));
    }
    spriteCache[key] = c;
    return c;
  }
  function treeSprite(healed, v) {
    const key = 'tree' + healed + v;
    if (spriteCache[key]) return spriteCache[key];
    const r = new Raster(14, 18);
    r.rect(6, 10, 2, 8, healed ? '#5a3a2a' : '#2a1a22');
    if (healed) {
      const leaf = ['#ff8a2a', '#e8561e', '#ffc048'], pick = (x, y) => leaf[(hash(x + v, y) * 3) | 0];
      r.ellipse(7, 7, 6, 5.5, null, (x, y, d) => d > 0.7 && y > 7 ? '#c4381c' : pick(x, y));
      r.set(4, 4, '#fff0a8'); r.set(9, 6, '#fff0a8');
    } else {
      r.line(7, 12, 3, 6, '#2a1a22'); r.line(7, 11, 11, 5, '#2a1a22'); r.line(7, 9, 7, 3, '#2a1a22'); r.line(4, 7, 2, 7, '#2a1a22');
    }
    const c = r.outline().canvas();
    spriteCache[key] = c;
    return c;
  }
  function volcanoSprite() {
    if (spriteCache.volc) return spriteCache.volc;
    const r = new Raster(50, 30), cx = 25;
    for (let y = 4; y < 30; y++) {
      const hw = 5 + (y - 4) * 0.8;
      for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
        const u = (x - cx) / hw, n = hash(x, y);
        r.set(x, y, u < -0.35 ? (n > 0.8 ? '#5e4152' : '#4b3344') : u > 0.4 ? '#2b1d2a' : (n > 0.85 ? '#4b3344' : '#35233a'));
      }
    }
    r.ellipse(cx, 5, 6, 2.2, '#1a0e16');
    const c = r.outline().canvas();
    spriteCache.volc = c;
    return c;
  }
  function signSprite() {
    if (spriteCache.sign) return spriteCache.sign;
    const r = new Raster(12, 14);
    r.rect(5, 6, 2, 8, '#5a3a2a'); r.rect(1, 1, 10, 6, '#8a5a34'); r.rect(2, 2, 8, 4, '#b07a44');
    r.rect(3, 3, 6, 1, '#5a3a2a'); r.rect(3, 5, 4, 1, '#5a3a2a');
    const c = r.outline().canvas();
    spriteCache.sign = c;
    return c;
  }
  const emo = (pic, size) => SPR.pixEmoji(pic, size || 14);
  const BOSS_PAL = {
    leaf: { body: '#4a8a3a', belly: '#e8d08a', dark: '#2f5a2a', wing: '#8a3a3a', spike: '#ffd23a', horn: '#f4f1ea', snout: '#6aa84a' },
    shadow: { body: '#4a3a6a', belly: '#9a86c8', dark: '#2a1f4a', wing: '#6a2a5a', spike: '#ff7ad9', horn: '#e8e4ff', snout: '#5a4a7a' },
    lava: { body: '#b02e18', belly: '#ffd262', dark: '#6e1614', wing: '#4a1a1a', spike: '#fff0a8', horn: '#2b1d2a', snout: '#c4481c' },
    gold: { body: '#2b1d2a', belly: '#ffd23a', dark: '#120a14', wing: '#8a1a2a', spike: '#ffd23a', horn: '#ffd23a', snout: '#402b40' },
  };
  // a small flying dragon for the map (the full-size one lives in the battle screen)
  function mapDragon(i, frame) {
    const key = 'md' + i + frame;
    if (spriteCache[key]) return spriteCache[key];
    const p = BOSS_PAL[ISLES[i].boss.elem], r = new Raster(28, 22), wy = frame ? 5 : 0;
    r.tri(11, 11, 1, 1 + wy, 4, 14, p.wing); r.tri(17, 11, 27, 1 + wy, 24, 14, p.wing);
    r.line(11, 11, 1, 1 + wy, p.dark); r.line(17, 11, 27, 1 + wy, p.dark);
    r.ellipse(20, 17, 5, 2, p.body); r.tri(23, 15, 27, 13, 26, 18, p.spike);
    r.ellipse(14, 15, 6, 5, p.body, (x, y, d) => d > .6 && y > 15 ? p.dark : p.body);
    r.ellipse(14, 16.5, 3, 3, p.belly);
    r.ellipse(14, 7, 5, 4.2, p.body); r.ellipse(14, 9.2, 3.2, 2, p.snout);
    r.tri(10, 5, 8, 0, 12, 3, p.horn); r.tri(18, 5, 20, 0, 16, 3, p.horn);
    r.set(12, 6, '#fff1a8'); r.set(16, 6, '#fff1a8'); r.line(11, 5, 12, 5, '#1a1020'); r.line(16, 5, 17, 5, '#1a1020');
    r.line(12, 10, 16, 10, '#1a1020');
    const c = r.outline().canvas();
    spriteCache[key] = c;
    return c;
  }

  function buildObjects() {
    objects.length = 0;
    const S = ST.S;
    seedRand = 7;
    // decorative trees, spread over the big island
    for (let k = 0, placed = 0; k < 900 && placed < 46; k++) {
      const x = MAIN.cx - MAIN.rx + rnd() * MAIN.rx * 2, y = MAIN.cy - MAIN.ry + rnd() * MAIN.ry * 2;
      const L = landAt(x, y);
      if (L.v < 0.12 || L.who !== -1) continue;
      if (riverAt(x, y).d < 8 || Math.hypot(x - VOLCANO.x, y - VOLCANO.y) < 34) continue;
      if (CASTLES.some(c => Math.hypot(x - c.x, y - c.y) < 30)) continue;
      if (ISLES.some(I => Math.hypot(x - I.bridge[0][0], y - I.bridge[0][1]) < 16)) continue;
      if (objects.some(o => Math.hypot(x - o.x, y - o.y) < 14)) continue;
      if (Math.hypot(x - hero.x, y - hero.y) < 14) continue;
      const v = placed++;
      objects.push({ type: 'tree', x: Math.round(x), y: Math.round(y), v, label: 'tree' });
    }
    ISLES.forEach((I, i) => {
      for (let k = 0; k < 6; k++) {
        const a = k * 1.1 + i, x = Math.round(I.cx + Math.cos(a) * I.rx * 0.62), y = Math.round(I.cy + Math.sin(a) * I.ry * 0.5 + 4);
        if (landAt(x, y).v > 0.15 && Math.abs(x - I.cx) > 14) objects.push({ type: 'tree', x, y, v: 40 + i * 6 + k, isle: i, label: 'tree' });
      }
    });
    objects.push({ type: 'volcano', x: VOLCANO.x, y: VOLCANO.y + 12, label: 'volcano' });
    CASTLES.forEach((c, i) => objects.push({ type: 'castle', i, x: c.x, y: c.y, label: 'castle' }));
    ISLES.forEach((I, i) => {
      objects.push({ type: 'isle', i, x: I.cx, y: I.cy + 6, label: I.name });
      if (!S.bridges[i]) objects.push({ type: 'sign', i, x: I.bridge[0][0] + 5, y: I.bridge[0][1] + 2, label: 'bridge' });
    });
    S.decor.forEach((d, i) => {
      const D = ST.DECOR[d.k]; if (!D || D.walk) return;
      const old = decorFx[i] && decorFx[i].k === d.k ? decorFx[i] : { k: d.k, next: 8 + Math.random() * 30, sur: 0 };
      decorFx[i] = old;
      objects.push({ type: 'decor', i, k: d.k, x: d.x, y: d.y, label: D.word, fx: old });
    });
  }
  const decorFx = [];

  // ── hero movement ────────────────────────────────────────────────────
  function goTo(x, y, isle, cb) {
    const path = [];
    const here = hero.where;
    if (here !== isle) {
      if (here >= 0) { const B = ISLES[here].bridge; path.push(B[1].slice(), B[0].slice()); }
      if (isle >= 0) { const B = ISLES[isle].bridge; path.push(B[0].slice(), B[1].slice()); }
    }
    path.push([x, y]);
    hero.path = path; hero.onArrive = cb; hero.target = isle;
    cam.manual = 0;
  }
  function updateHero(dt) {
    if (hero.path.length) {
      const [tx, ty] = hero.path[0], dx = tx - hero.x, dy = ty - hero.y, d = Math.hypot(dx, dy);
      const sp = 62 * dt;
      if (d <= sp) { hero.x = tx; hero.y = ty; hero.path.shift(); if (!hero.path.length) { hero.where = hero.target; const cb = hero.onArrive; hero.onArrive = null; cb && cb(); } }
      else { hero.x += dx / d * sp; hero.y += dy / d * sp; if (Math.abs(dx) > 0.3) hero.flip = dx < 0; }
      hero.ft += dt; if (hero.ft > 0.14) { hero.ft = 0; hero.frame ^= 1; }
      // keep the hero on screen while walking, unless Gur is looking around
      if (performance.now() - cam.manual > 1500) {
        const [sx, sy] = toScreen(hero.x, hero.y), W = innerWidth, H = innerHeight;
        if (sx < W * 0.2 || sx > W * 0.8 || sy < H * 0.25 || sy > H * 0.72) centerOn(hero.x, hero.y);
      }
    } else { hero.frame = 0; }
  }

  // ── creatures (and walking decorations) ─────────────────────────────
  function syncCreatures() {
    const S = ST.S;
    const want = S.creatures.map((c, idx) => ({ ...c, idx }));
    ISLES.forEach((I, i) => {
      if (!S.isles[i].won) return;
      const kind = ['fox', 'cat', 'dragon', 'fox'][i], elem = i === 3 ? 'star' : 'plain';
      for (let k = 0; k < 1 + S.isles[i].castle; k++) want.push({ kind: i === 3 ? ['fox', 'cat', 'dragon'][k % 3] : kind, elem, home: i, idx: 'i' + i + k, name: kind });
    });
    S.decor.forEach((d, i) => { const D = ST.DECOR[d.k]; if (D && D.walk) want.push({ pic: D.pic, name: D.word, home: d.isle === undefined ? -1 : d.isle, idx: 'd' + i + d.k, decor: i, x: d.x, y: d.y }); });
    const keep = [];
    want.forEach(w => {
      let c = creatures.find(c => c.idx === w.idx);
      if (!c) {
        const home = w.home !== undefined ? w.home : -1, p = w.x !== undefined ? [w.x, w.y] : randomLand(home);
        c = { idx: w.idx, kind: w.kind, elem: w.elem, name: w.name, home, x: p[0], y: p[1], tx: p[0], ty: p[1], wait: Math.random() * 3, frame: 0, ft: 0, flip: false, hop: 0 };
      }
      c.kind = w.kind; c.elem = w.elem; c.name = w.name; c.pic = w.pic; c.decor = w.decor;
      keep.push(c);
    });
    creatures.length = 0; creatures.push(...keep);
  }
  function okSpot(x, y, home) {
    const L = landAt(x, y);
    if (L.v < 0.12 || L.who !== home) return false;
    if (home === -1) return !CASTLES.some(c => Math.abs(x - c.x) < 18 && y > c.y - 34 && y < c.y + 6) && riverAt(x, y).d > 5 && Math.hypot(x - VOLCANO.x, y - VOLCANO.y) > 26;
    const I = ISLES[home]; return !(Math.abs(x - I.cx) < 18 && y > I.cy - 28 && y < I.cy + 10);
  }
  function randomLand(home) {
    const I = home === -1 ? MAIN : ISLES[home];
    for (let k = 0; k < 80; k++) {
      const x = I.cx + (Math.random() * 2 - 1) * I.rx * 0.8, y = I.cy + (Math.random() * 2 - 1) * I.ry * 0.7;
      if (okSpot(x, y, home)) return [x, y];
    }
    return [I.cx, I.cy];
  }
  function updateCreatures(dt) {
    creatures.forEach(c => {
      if (c.wait > 0) { c.wait -= dt; c.frame = 0; return; }
      const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
      if (d < 0.6) { c.wait = 1 + Math.random() * 4; const p = randomLand(c.home); c.tx = p[0]; c.ty = p[1]; if (Math.hypot(c.tx - c.x, c.ty - c.y) > 50) { c.tx = c.x + (c.tx - c.x) * 0.4; c.ty = c.y + (c.ty - c.y) * 0.4; } return; }
      const sp = (c.pic ? 9 : 12) * dt;
      c.x += dx / d * sp; c.y += dy / d * sp; c.flip = dx < 0;
      c.ft += dt; if (c.ft > 0.18) { c.ft = 0; c.frame ^= 1; }
    });
  }

  // ── surprise visitors: a whale, a boat, a balloon, butterflies. Tap them for gems! ──
  const VISIT = {
    whale: { pic: '🐳', word: 'whale' }, boat: { pic: '⛵', word: 'boat' }, balloon: { pic: '🎈', word: 'balloon' },
    butterfly: { pic: '🦋', word: 'butterfly' }, bird: { pic: '🐦', word: 'bird' },
  };
  function seaSpot() {
    for (let k = 0; k < 60; k++) {
      const x = -30 + Math.random() * (WW + 60), y = -30 + Math.random() * (WH + 60);
      if (landAt(x, y).v < -0.15 && landAt(x + 10, y).v < -0.15 && landAt(x - 10, y).v < -0.15) return [x, y];
    }
    return null;
  }
  function spawnVisitor() {
    const prog = ST.progress(), r = Math.random();
    let v = null;
    if (r < 0.3) { const p = seaSpot(); if (p) v = { k: 'whale', x: p[0], y: p[1], vx: 0, vy: 0, life: 9, max: 9 }; }
    else if (r < 0.55) { const right = Math.random() < 0.5, y = Math.random() < 0.5 ? -18 : WH + 14; v = { k: 'boat', x: right ? -40 : WW + 40, y, vx: right ? 9 : -9, vy: 0, life: 70, max: 70 }; }
    else if (r < 0.78) { const right = Math.random() < 0.5; v = { k: 'balloon', x: right ? -30 : WW + 30, y: 30 + Math.random() * 160, vx: right ? 7 : -7, vy: -0.6, life: 85, max: 85 }; }
    else if (prog > 8) { const p = randomLand(-1); v = { k: Math.random() < 0.6 ? 'butterfly' : 'bird', x: p[0], y: p[1] - 6, vx: 0, vy: 0, life: 14, max: 14, ox: p[0], oy: p[1] - 6 }; }
    if (v) { Object.assign(v, VISIT[v.k]); visitors.push(v); }
  }
  function updateVisitors(dt) {
    nextVisit -= dt;
    if (nextVisit <= 0) { nextVisit = 22 + Math.random() * 35; if (visitors.length < 3) spawnVisitor(); }
    for (let i = visitors.length - 1; i >= 0; i--) {
      const v = visitors[i];
      v.life -= dt; if (v.life <= 0) { visitors.splice(i, 1); continue; }
      if (v.k === 'butterfly' || v.k === 'bird') { const a = (v.max - v.life); v.x = v.ox + Math.sin(a * 0.9) * 14; v.y = v.oy + Math.sin(a * 1.7) * 5 - (v.k === 'bird' && v.life < 3 ? (3 - v.life) * 30 : 0); v.flip = Math.cos(a * 0.9) < 0; }
      else { v.x += v.vx * dt; v.y += v.vy * dt + (v.k === 'balloon' ? Math.sin(t * 1.3 + i) * 0.05 : 0); v.flip = v.vx < 0; }
      if (v.k === 'whale' && Math.random() < 0.05 && v.life > 1.5 && v.max - v.life > 1) for (let k = 0; k < 6; k++) spawn('spark', v.x + 2, v.y - 12, (Math.random() - .5) * 14, -30 - Math.random() * 18, 0.7, Math.random() < .5 ? '#ffffff' : '#8fcde3');
    }
  }
  function catchVisitor(v) {
    const i = visitors.indexOf(v); if (i >= 0) visitors.splice(i, 1);
    burst(v.x, v.y - 6, 30, ['#ffd262', '#ffffff', '#6fe3ff'], 34);
  }
  function drawVisitors() {
    visitors.forEach(v => {
      const c = emo(v.pic, v.k === 'butterfly' || v.k === 'bird' ? 10 : 14);
      let y = v.y - c.height, clip = c.height;
      if (v.k === 'whale') { // rises out of the water, then dives again
        const a = v.max - v.life, k = Math.min(1, a / 1.2, v.life / 1.2);
        clip = Math.max(2, Math.round(c.height * (0.4 + 0.6 * k)));
        lctx.fillStyle = 'rgba(143,205,227,.55)'; lctx.fillRect(Math.round(v.x - 9 + OX), Math.round(v.y + OY), 18, 1);
      }
      if (v.k === 'balloon' || v.k === 'boat') shadow(v.x, v.k === 'balloon' ? v.y + 26 : v.y + 1, 8);
      const x = Math.round(v.x - c.width / 2 + OX), yy = Math.round(y + OY + (c.height - clip));
      if (v.flip) { lctx.save(); lctx.translate(x + c.width, yy); lctx.scale(-1, 1); lctx.drawImage(c, 0, 0, c.width, clip, 0, 0, c.width, clip); lctx.restore(); }
      else lctx.drawImage(c, 0, 0, c.width, clip, x, yy, c.width, clip);
    });
  }

  // ── particles (pooled) ───────────────────────────────────────────────
  const P = [];
  for (let i = 0; i < 700; i++) P.push({ on: false });
  function spawn(type, x, y, vx, vy, life, col) {
    for (const p of P) if (!p.on) { p.on = true; p.type = type; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.col = col; return p; }
  }
  const EMBER = ['#fff0a8', '#ffd262', '#ff7e26', '#c4381c', '#6e1614'];
  const SMOKE = ['#5e5a74', '#4b4660', '#3a3548'];
  function burst(x, y, n, cols, speed) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = (0.4 + Math.random()) * (speed || 30); spawn('spark', x, y, Math.cos(a) * s, Math.sin(a) * s - 10, 0.5 + Math.random() * 0.6, cols[(Math.random() * cols.length) | 0]); }
  }
  function updateParticles(dt) {
    const S = ST.S, prog = ST.progress();
    if (lavaPix && lavaPix.length && Math.random() < 0.7) {
      const i = lavaPix[(Math.random() * lavaPix.length) | 0];
      spawn('ember', i % LW - OX, ((i / LW) | 0) - OY, (Math.random() - 0.5) * 4, -6 - Math.random() * 8, 1 + Math.random() * 1.5);
    }
    const smokeRate = 0.2 * (1 - prog / 130);
    if (Math.random() < smokeRate) spawn('smoke', VOLCANO.x + (Math.random() - 0.5) * 6, VOLCANO.y - 10, 2 + Math.random() * 3, -7 - Math.random() * 4, 3 + Math.random() * 2);
    if (Math.random() < 0.3) spawn('ember', VOLCANO.x + (Math.random() - 0.5) * 8, VOLCANO.y - 9, (Math.random() - 0.5) * 8, -12 - Math.random() * 10, 1.2);
    CASTLES.forEach((c, i) => { if (!S.castles[i] && Math.random() < 0.06) spawn('smoke', c.x + (Math.random() - 0.5) * 12, c.y - 14, 1 + Math.random() * 2, -5 - Math.random() * 3, 2.5); });
    ISLES.forEach((I, i) => { if (S.bridges[i] && !S.isles[i].won && Math.random() < 0.08) spawn('smoke', I.cx + (Math.random() - 0.5) * I.rx, I.cy + (Math.random() - 0.5) * 8, 1, -4, 2.5); });
    if (prog > 5 && Math.random() < 0.06 + prog / 500) { const p = randomLand(-1); if (heal(p[0], p[1]) > 0.4) spawn('fly', p[0], p[1], 0, -2, 2.5 + Math.random() * 2); }
    // decorations doing their thing
    objects.forEach(o => {
      if (o.type !== 'decor') return;
      const D = ST.DECOR[o.k], F = o.fx;
      F.next -= dt; if (F.next <= 0) { F.next = 15 + Math.random() * 45; F.sur = 2.2; }
      if (F.sur > 0) F.sur -= dt;
      const on = F.sur > 0, x = o.x, y = o.y;
      if (D.fx === 'water' && Math.random() < (on ? 0.9 : 0.25)) spawn('spark', x + (Math.random() - .5) * 3, y - 12, (Math.random() - .5) * (on ? 26 : 10), -18 - Math.random() * (on ? 40 : 12), 0.7, Math.random() < .5 ? '#ffffff' : '#6fe3ff');
      if (D.fx === 'glow' && Math.random() < (on ? 0.7 : 0.08)) spawn('ember', x + (Math.random() - .5) * 8, y - 8, (Math.random() - .5) * 6, -8 - Math.random() * 8, 1.1);
      if (D.fx === 'snow' && Math.random() < (on ? 0.8 : 0.1)) spawn('spark', x + (Math.random() - .5) * 26, y - 22, 0, 6, 1.6, '#ffffff');
      if ((D.fx === 'wink' || D.fx === 'sparkle') && Math.random() < (on ? 0.6 : 0.05)) spawn('spark', x + (Math.random() - .5) * 12, y - 6 - Math.random() * 10, 0, -8, 0.6, D.fx === 'sparkle' ? ['#ff4a5a', '#ffd23a', '#5ad06a', '#4aa8ff', '#b98bff'][(Math.random() * 5) | 0] : '#fff5c0');
      if (D.fx === 'lights' && Math.random() < (on ? 0.8 : 0.2)) spawn('spark', x + (Math.random() - .5) * 12, y - 4 - Math.random() * 12, 0, 0, 0.35, ['#ffd23a', '#ff8ccf', '#6fe3ff', '#3fd08a'][(Math.random() * 4) | 0]);
      if (D.fx === 'visitor' && on && Math.random() < 0.4) spawn('spark', x + (Math.random() - .5) * 6, y - 12, (Math.random() - .5) * 8, -14, 0.9, '#ff8ccf');
    });
    for (const p of P) {
      if (!p.on) continue;
      p.life -= dt; if (p.life <= 0) { p.on = false; continue; }
      if (p.type === 'spark') p.vy += 60 * dt;
      if (p.type === 'fly') { p.vx = Math.sin(t * 3 + p.x) * 4; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  function drawParticles() {
    for (const p of P) {
      if (!p.on) continue;
      const k = 1 - p.life / p.max, x = Math.round(p.x + OX), y = Math.round(p.y + OY);
      if (p.type === 'ember') { lctx.fillStyle = EMBER[Math.min(4, (k * 5) | 0)]; lctx.fillRect(x, y, 1, 1); }
      else if (p.type === 'smoke') { if (k > 0.7 && (x + y + (t * 30 | 0)) & 1) continue; const s = k < 0.3 ? 2 : 3; lctx.fillStyle = SMOKE[Math.min(2, (k * 3) | 0)]; lctx.fillRect(x, y, s, s); }
      else if (p.type === 'fly') { if (Math.sin(t * 8 + p.x * 3) > -0.2) { lctx.fillStyle = '#e8ff8a'; lctx.fillRect(x, y, 1, 1); } }
      else { lctx.fillStyle = p.col; lctx.fillRect(x, y, 1, 1); if (k < 0.3) lctx.fillRect(x, y + 1, 1, 1); }
    }
  }

  // ── cloud shadows drifting over the map ──────────────────────────────
  const clouds = [];
  function makeClouds() {
    seedRand = 99;
    for (let k = 0; k < 7; k++) {
      const r = new Raster(60, 26);
      for (let j = 0; j < 5; j++) r.ellipse(12 + rnd() * 36, 10 + rnd() * 6, 8 + rnd() * 8, 5 + rnd() * 4, '#000');
      clouds.push({ c: r.canvas(), x: rnd() * 700 - 60, y: rnd() * 380, s: 2 + rnd() * 2 });
    }
  }

  // ── main draw ────────────────────────────────────────────────────────
  function draw(dt) {
    t += dt;
    if (!buf) return;
    buf.set(base);
    const step = (t * 7) | 0, n = LAVA.length;
    for (let k = 0; k < lavaPix.length; k++) buf[lavaPix[k]] = LAVA[((Math.floor(lavaPhase[k] - step) % n) + n) % n];
    for (let k = 0; k < foamPix.length; k++) { const i = foamPix[k]; if (Math.sin(t * 1.6 + (i % 97) * 0.7 + ((i / LW) | 0) * 0.4) > 0.1) buf[i] = C.foam; }
    for (let k = 0; k < glintPix.length; k++) if (Math.sin(t * 2 + k * 1.3) > 0.85) buf[glintPix[k]] = C.glint;
    lctx.putImageData(img, 0, 0);
    lctx.globalAlpha = 0.25 + Math.sin(t * 2) * 0.06; lctx.globalCompositeOperation = 'lighter';
    lctx.drawImage(glow, 0, 0);
    lctx.globalAlpha = 1; lctx.globalCompositeOperation = 'source-over';

    const S = ST.S;
    ISLES.forEach((I, i) => {
      const [a, b] = I.bridge;
      if (S.bridges[i]) { bridgeAnim[i] = Math.min(1, bridgeAnim[i] + dt * 0.6); drawBridge(a, b, bridgeAnim[i]); }
      else drawGhostBridge(a, b, ST.bridgeOpen(i));
    });

    const list = objects.slice();
    creatures.forEach(c => list.push({ type: 'cre', c, y: c.y }));
    list.push({ type: 'hero', y: hero.y });
    list.sort((p, q) => p.y - q.y);
    list.forEach(o => drawObj(o));
    drawVisitors();
    drawParticles();
    lctx.globalAlpha = 0.14;
    clouds.forEach(cl => { cl.x += cl.s * dt; if (cl.x > LW + 60) cl.x = -70; lctx.drawImage(cl.c, Math.round(cl.x), Math.round(cl.y)); });
    lctx.globalAlpha = 1;
    drawMarkers();
    drawPlacing();
    // camera: ease towards its target, then copy the visible part to the screen
    const e = Math.min(1, dt * 6);
    cam.x += (cam.tx - cam.x) * e; cam.y += (cam.ty - cam.y) * e;
    const cx = Math.round(cam.x), cy = Math.round(cam.y);
    dctx.imageSmoothingEnabled = false;
    dctx.fillStyle = '#0c1830'; dctx.fillRect(0, 0, disp.width, disp.height);
    const sx = Math.max(0, cx), sy = Math.max(0, cy), sw = Math.min(LW - sx, VW - (sx - cx)), sh = Math.min(LH - sy, VH - (sy - cy));
    if (sw > 0 && sh > 0) dctx.drawImage(lcv, sx, sy, sw, sh, (sx - cx) * SCALE, (sy - cy) * SCALE, sw * SCALE, sh * SCALE);
  }

  function drawBridge(a, b, prog) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
    const steps = Math.floor(len * prog);
    for (let s = 0; s <= steps; s++) {
      const x = a[0] + dx * s / len + OX, y = a[1] + dy * s / len + OY;
      for (let w = -2; w <= 2; w++) {
        lctx.fillStyle = s % 3 === 0 ? '#5a3a2a' : (w === -2 ? '#c89a5a' : '#a0703c');
        lctx.fillRect(Math.round(x + nx * w), Math.round(y + ny * w), 1, 1);
      }
      lctx.fillStyle = '#2a1a1a'; lctx.fillRect(Math.round(x + nx * 3), Math.round(y + ny * 3 + 1), 1, 1); lctx.fillRect(Math.round(x - nx * 3), Math.round(y - ny * 3 + 1), 1, 1);
      if (s % 8 === 0) { lctx.fillStyle = '#5a3a2a'; lctx.fillRect(Math.round(x + nx * 3), Math.round(y + ny * 3 - 2), 1, 3); lctx.fillRect(Math.round(x - nx * 3), Math.round(y - ny * 3 - 2), 1, 3); }
    }
    if (prog < 1 && Math.random() < 0.5) { const x = a[0] + dx * steps / len, y = a[1] + dy * steps / len; burst(x, y, 2, ['#ffd262', '#ffffff'], 20); }
  }
  function drawGhostBridge(a, b, open) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    for (let s = 0; s <= len; s += 3) {
      if (open && ((s / 3) | 0) % 2 === ((t * 3) | 0) % 2) continue;
      lctx.fillStyle = open ? '#ffd26288' : '#9a96b044'; lctx.fillRect(Math.round(a[0] + dx * s / len + OX), Math.round(a[1] + dy * s / len + OY), 1, 1);
    }
  }
  function shadow(x, y, w) { lctx.fillStyle = 'rgba(10,6,14,0.45)'; lctx.fillRect(Math.round(x - w / 2 + OX), Math.round(y + OY), w, 1); lctx.fillRect(Math.round(x - w / 2 + 1 + OX), Math.round(y + 1 + OY), w - 2, 1); }
  function blit(c, x, y, flip) {
    x = Math.round(x + OX); y = Math.round(y + OY);
    if (flip) { lctx.save(); lctx.translate(x + c.width, y); lctx.scale(-1, 1); lctx.drawImage(c, 0, 0); lctx.restore(); }
    else lctx.drawImage(c, x, y);
  }
  function drawDecor(k, x, y, F, ghost) {
    const D = ST.DECOR[k], c = emo(D.pic);
    let w = c.width, h = c.height, dy = 0, dx = 0;
    if (F && F.sur > 0) {
      const a = 2.2 - F.sur;
      if (D.fx === 'grow') { const s = 1 + Math.sin(Math.min(1, a / 2) * Math.PI) * 0.7; w = Math.round(c.width * s); h = Math.round(c.height * s); }
      if (D.fx === 'wink' || D.fx === 'visitor') dy = -Math.round(Math.abs(Math.sin(a * 9)) * 2);
      if (D.fx === 'fly') dy = -Math.round(Math.sin(a / 2.2 * Math.PI) * 30), dx = Math.round(Math.sin(a * 3) * 6);
    }
    if (D.fx === 'fly') dy -= 3 + Math.round(Math.sin(t * 2 + x) * 2);
    if (!ghost) shadow(x, y, 10);
    lctx.drawImage(c, Math.round(x - w / 2 + OX + dx), Math.round(y - h + 1 + OY + dy), w, h);
  }
  function drawObj(o) {
    const S = ST.S;
    if (o.type === 'tree') {
      const healed = o.isle !== undefined ? S.isles[o.isle].won : heal(o.x, o.y) > 0.3;
      const c = treeSprite(healed, o.v % 3);
      shadow(o.x, o.y, 8); blit(c, o.x - 7, o.y - 17);
    } else if (o.type === 'decor') {
      if (place && place.moving === o.i) return;
      drawDecor(o.k, o.x, o.y, o.fx);
    } else if (o.type === 'volcano') {
      const c = volcanoSprite(); blit(c, VOLCANO.x - 25, VOLCANO.y - 14);
      const n = LAVA.length, step = (t * 6) | 0;
      for (let i = -4; i <= 4; i++) { const col = LAVA[(((i * 2 - step) % n) + n) % n]; lctx.fillStyle = '#' + (col & 0xffffff).toString(16).padStart(6, '0').replace(/(..)(..)(..)/, '$3$2$1'); lctx.fillRect(VOLCANO.x + i + OX, VOLCANO.y - 10 + OY, 1, 2); }
    } else if (o.type === 'castle') {
      const L = S.castles[o.i], c = castleSprite(L, S.styles.castles[o.i], (t * 3 | 0) % 2);
      shadow(o.x, o.y, 26); blit(c, o.x - 16, o.y - 33);
      if (hooks.castleReady && hooks.castleReady(o.i)) marker(o.x, o.y - 38, 'hammer');
    } else if (o.type === 'sign') {
      if (S.bridges[o.i]) return;
      blit(signSprite(), o.x - 6, o.y - 13);
      marker(o.x, o.y - 18, 'lock');
    } else if (o.type === 'isle') {
      const I = ISLES[o.i], st = S.isles[o.i];
      if (!st.won) {
        const dc = mapDragon(o.i, (t * 5 | 0) % 2), bob = Math.round(Math.sin(t * 2 + o.i) * 2);
        const x = I.cx - 14 + Math.round(Math.sin(t * 0.7 + o.i) * 9), y = I.cy - 24 + bob;
        shadow(x + 14, I.cy - 1, 16);
        blit(dc, x, y, Math.cos(t * 0.7 + o.i) < 0);
        if (S.bridges[o.i]) marker(I.cx, I.cy - 30, 'sword');
      } else {
        const c = castleSprite(st.castle, S.styles.isles[o.i], (t * 3 | 0) % 2);
        shadow(I.cx, I.cy + 6, 24); blit(c, I.cx - 16, I.cy - 27);
        if (hooks.isleReady && hooks.isleReady(o.i)) marker(I.cx, I.cy - 32, 'hammer');
      }
    } else if (o.type === 'cre') {
      const c = o.c;
      if (c.pic) { if (place && place.moving === c.decor) return; const s = emo(c.pic); shadow(c.x, c.y, 10); blit(s, c.x - s.width / 2, c.y - s.height + 1 - (c.frame ? 1 : 0), !c.flip); if (Math.random() < 0.05) spawn('spark', c.x, c.y - 10, 0, -8, 0.6, ['#ff8ccf', '#fff5c0', '#6fe3ff'][(Math.random() * 3) | 0]); return; }
      const s = SPR.creature(c.kind, c.elem, c.frame);
      shadow(c.x, c.y, 10); blit(s, c.x - 8, c.y - s.height + 1, c.flip);
      if (c.elem === 'lava' && Math.random() < 0.05) spawn('ember', c.x, c.y - 10, 0, -8, 0.8);
      if (['gold', 'sun', 'crystal', 'rainbow', 'comet'].includes(c.elem) && Math.random() < 0.06) spawn('spark', c.x + (Math.random() - .5) * 8, c.y - 8, 0, -10, 0.5, c.elem === 'crystal' ? '#6fe3ff' : '#fff5c0');
    } else if (o.type === 'hero') {
      const lv = S.heroLv[S.hero], c = SPR.hero(S.hero, lv, hero.frame);
      const bob = hero.path.length ? 0 : (Math.sin(t * 3) > 0.6 ? -1 : 0);
      shadow(hero.x, hero.y, 10);
      if (hero.busy > 0) { hero.busy -= 1 / 60; blit(c, hero.x - 10, hero.y - 23 - (((t * 8) | 0) % 2), hero.flip); }
      else blit(c, hero.x - 10, hero.y - 23 + bob, hero.flip);
      if (lv >= 5 && Math.random() < 0.1) spawn('spark', hero.x + (Math.random() - .5) * 12, hero.y - 10 - Math.random() * 10, 0, -6, 0.6, '#fff5c0');
    }
  }

  // bouncing icons over things you can do
  const ICONS = {
    hammer: ['..kkk..', '.kyyyk.', '.kyyyk.', '..kbk..', '..kbk..', '..kbk..', '...k...'],
    lock: ['.kkk.', 'k...k', 'kkkkk', 'kyyyk', 'kykyk', 'kkkkk'],
    sword: ['....k', '...kw', '..kw.', 'kkw..', '.kk..', 'k.k..'],
  };
  const iconC = {};
  function marker(x, y, kind) { markers.push([x, y, kind]); }
  function drawMarkers() {
    markers.forEach(([x, y, kind]) => {
      if (!iconC[kind]) iconC[kind] = SPR.ascii(ICONS[kind], { y: kind === 'lock' ? '#9a96b0' : '#ffd262', b: '#8a5a34', w: '#ffffff' });
      const c = iconC[kind], b = Math.round(Math.abs(Math.sin(t * 4 + x)) * -3);
      lctx.drawImage(c, Math.round(x - c.width / 2 + OX), Math.round(y + b + OY - c.height));
    });
    markers.length = 0;
  }

  // ── placing decorations ─────────────────────────────────────────────
  function spotFor(x, y) {
    const L = landAt(x, y), S = ST.S;
    if (L.v < 0.07) return null;
    if (L.who >= 0 && !S.isles[L.who].won) return null;
    if (L.who === -1 && (riverAt(x, y).d < 4.5 || Math.hypot(x - VOLCANO.x, (y - VOLCANO.y) * 1.4) < 20)) return null;
    if (L.who === -1 && CASTLES.some(c => Math.abs(x - c.x) < 15 && y > c.y - 6 && y < c.y + 8)) return null;
    if (L.who >= 0) { const I = ISLES[L.who]; if (Math.abs(x - I.cx) < 15 && y > I.cy - 2 && y < I.cy + 12) return null; }
    return { isle: L.who };
  }
  function drawPlacing() {
    if (!place || !pointer) return;
    const [x, y] = toWorld(pointer[0], pointer[1]), ok = spotFor(x, y);
    lctx.globalAlpha = ok ? 0.85 : 0.35;
    drawDecor(place.k, Math.round(x), Math.round(y), null, true);
    lctx.globalAlpha = 1;
    lctx.fillStyle = ok ? '#3fd08a' : '#e0383a';
    lctx.fillRect(Math.round(x - 5 + OX), Math.round(y + 2 + OY), 10, 1);
  }
  function startPlace(k, onPlace, moving) { place = { k, onPlace, moving }; }
  function stopPlace() { place = null; }

  // ── camera ───────────────────────────────────────────────────────────
  const pads = () => [80 / SCALE, 150 / SCALE];
  const clampV = (v, lo, hi) => lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));
  function clampCam() {
    const [top, bot] = pads();
    cam.tx = clampV(cam.tx, OX - 24, OX + WW + 24 - VW);
    cam.ty = clampV(cam.ty, OY - 24 - top, OY + WH + 24 - VH + bot);
  }
  function centerOn(wx, wy, now) {
    const [top, bot] = pads();
    cam.tx = wx + OX - VW / 2; cam.ty = wy + OY - (top + (VH - top - bot) / 2);
    clampCam();
    if (now) { cam.x = cam.tx; cam.y = cam.ty; }
  }
  // is this world point comfortably on screen?
  function onScreen(wx, wy) { const [sx, sy] = toScreen(wx, wy); return sx > 60 && sx < innerWidth - 60 && sy > 110 && sy < innerHeight - 170; }
  function focus(wx, wy) { if (!onScreen(wx, wy)) centerOn(wx, wy); }

  // ── resize / setup ───────────────────────────────────────────────────
  function resize() {
    const W = window.innerWidth, H = window.innerHeight;
    const keep = VW ? toWorld(W / 2, H / 2) : null;
    const fit = Math.max(1, Math.floor(Math.min(W / 320, (H - 196) / 146)));
    SCALE = Math.max(1, fit + zoom);
    VW = Math.ceil(W / SCALE); VH = Math.ceil(H / SCALE);
    disp.width = VW * SCALE; disp.height = VH * SCALE;
    disp.style.width = disp.width + 'px'; disp.style.height = disp.height + 'px';
    LW = Math.max(WW + 2 * M, VW); LH = Math.max(WH + 2 * M, VH);
    OX = Math.floor((LW - WW) / 2); OY = Math.floor((LH - WH) / 2);
    lcv.width = LW; lcv.height = LH;
    img = lctx.createImageData(LW, LH); buf = new Uint32Array(img.data.buffer);
    glintPix = [];
    bake();
    if (!cam.set) { cam.set = true; centerOn(hero.x, hero.y - 10, true); }
    else if (keep) { const [top, bot] = pads(); cam.tx = keep[0] + OX - VW / 2; cam.ty = keep[1] + OY - VH / 2; clampCam(); cam.x = cam.tx; cam.y = cam.ty; }
    else { clampCam(); cam.x = cam.tx; cam.y = cam.ty; }
  }
  function init(canvas) {
    disp = canvas; dctx = disp.getContext('2d');
    canvas.style.touchAction = 'none';
    lcv = SPR.cv(1, 1); lctx = lcv.getContext('2d');
    makeClouds();
    resize();
    window.addEventListener('resize', resize);
    let down = null, dragged = false;
    canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, cx: cam.tx, cy: cam.ty, id: e.pointerId }; dragged = false; pointer = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointermove', e => {
      pointer = [e.clientX, e.clientY];
      if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!dragged && Math.hypot(dx, dy) > 9) { dragged = true; try { canvas.setPointerCapture(down.id); } catch (er) { } hooks.hover && hooks.hover(null); }
        if (dragged) { cam.tx = down.cx - dx / SCALE; cam.ty = down.cy - dy / SCALE; clampCam(); cam.x = cam.tx; cam.y = cam.ty; cam.manual = performance.now(); canvas.style.cursor = 'grabbing'; return; }
      }
      const o = pickAt(e.clientX, e.clientY); hovered = o; canvas.style.cursor = place ? 'crosshair' : o ? 'pointer' : 'grab';
      if (!place) hooks.hover && hooks.hover(o, e.clientX, e.clientY);
    });
    const up = e => {
      if (down && !dragged) clickAt(e.clientX, e.clientY);
      down = null; dragged = false; canvas.style.cursor = place ? 'crosshair' : 'grab';
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', () => { down = null; dragged = false; });
    canvas.addEventListener('pointerleave', () => { hovered = null; hooks.hover && hooks.hover(null); });
    let wheelT = 0;
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const now = performance.now(); if (now - wheelT < 180) return; wheelT = now;
      const nz = Math.max(-2, Math.min(1, zoom + (e.deltaY < 0 ? 1 : -1)));
      const fit = Math.max(1, Math.floor(Math.min(innerWidth / 320, (innerHeight - 196) / 146)));
      if (nz === zoom || fit + nz < 1) return;
      zoom = nz; resize();
    }, { passive: false });
    syncCreatures();
  }
  function clickAt(sx, sy) {
    const [x, y] = toWorld(sx, sy);
    if (place) {
      const ok = spotFor(x, y);
      if (!ok) { AUD.sfx('bad'); return; }
      const p = place; place.onPlace(Math.round(x), Math.round(y), ok.isle);
      if (place === p) place = null;
      return;
    }
    const o = pickAt(sx, sy);
    if (o && hooks.click) hooks.click(o); else if (!o) walkTo(x, y);
  }
  function toWorld(sx, sy) { return [sx / SCALE + Math.round(cam.x) - OX, sy / SCALE + Math.round(cam.y) - OY]; }
  function toScreen(wx, wy) { return [(wx + OX - Math.round(cam.x)) * SCALE, (wy + OY - Math.round(cam.y)) * SCALE]; }
  function walkTo(x, y) {
    const L = landAt(x, y);
    if (L.v < 0.05) return;
    if (L.who >= 0 && !ST.S.bridges[L.who]) return;
    goTo(x, y, L.who, null);
  }
  function pickAt(sx, sy) {
    const [x, y] = toWorld(sx, sy), S = ST.S;
    for (const v of visitors) if (Math.abs(x - v.x) < 10 && y > v.y - 16 && y < v.y + 4) return { type: 'visitor', v };
    for (const c of creatures) if (Math.abs(x - c.x) < 8 && y > c.y - 14 && y < c.y + 2) return { type: 'cre', c };
    let best = null;
    for (const o of objects) {
      let hit = false;
      if (o.type === 'castle') hit = Math.abs(x - o.x) < 15 && y > o.y - 34 && y < o.y + 2;
      else if (o.type === 'decor') hit = Math.abs(x - o.x) < 8 && y > o.y - 15 && y < o.y + 2;
      else if (o.type === 'sign') hit = !S.bridges[o.i] && Math.abs(x - o.x) < 8 && y > o.y - 16 && y < o.y + 3;
      else if (o.type === 'isle') { const I = ISLES[o.i]; hit = ((x - I.cx) / I.rx) ** 2 + ((y - I.cy) / I.ry) ** 2 < 1 || (!S.isles[o.i].won && Math.abs(x - I.cx) < 16 && y > I.cy - 28 && y < I.cy); }
      else if (o.type === 'volcano') hit = Math.abs(x - VOLCANO.x) < 16 && y > VOLCANO.y - 14 && y < VOLCANO.y + 12;
      else if (o.type === 'tree') hit = o.isle === undefined && Math.abs(x - o.x) < 5 && y > o.y - 16 && y < o.y + 1;
      if (hit && (!best || o.y > best.y || best.type === 'isle')) { if (!(best && o.type === 'isle')) best = o; }
    }
    if (!best && Math.hypot(x - hero.x, y - hero.y + 10) < 9) return { type: 'hero' };
    return best;
  }
  // a decoration's little surprise, right now (when tapped)
  function surprise(i) { const o = objects.find(o => o.type === 'decor' && o.i === i); if (o) o.fx.sur = 2.2; }

  function refresh() { resize(); syncCreatures(); }

  window.WORLD = {
    init, draw, update(dt) { updateHero(dt); updateCreatures(dt); updateVisitors(dt); updateParticles(dt); }, refresh, hooks, hero, goTo, ISLES, CASTLES, MAIN,
    toScreen, toWorld, burst, spawn, syncCreatures, creatures, get scale() { return SCALE; }, bridgeAnim, centerOn, focus, onScreen,
    startPlace, stopPlace, spotFor, get placing() { return place; }, catchVisitor, castleSprite, surprise, rebuild: buildObjects, visitors, spawnVisitor,
  };
})();
