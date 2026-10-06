// Pixel-art toolkit: ASCII sprites, procedural raster shapes, emoji → pixel-art converter.
(function () {
  const OUT = '#1a1020';
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };

  // ── ASCII sprite → canvas ────────────────────────────────────────────
  function ascii(rows, pal, w) {
    w = w || Math.max(...rows.map(r => r.length));
    const c = cv(w, rows.length), x = c.getContext('2d');
    rows.forEach((r, j) => {
      for (let i = 0; i < w; i++) {
        const ch = r[i];
        if (!ch || ch === '.' || ch === ' ') continue;
        const col = ch === 'k' ? (pal.k || OUT) : pal[ch];
        if (!col) continue;
        x.fillStyle = col; x.fillRect(i, j, 1, 1);
      }
    });
    return c;
  }

  // ── tiny raster for procedural sprites (auto outline) ───────────────
  class Raster {
    constructor(w, h) { this.w = w; this.h = h; this.p = new Array(w * h).fill(null); }
    set(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y * this.w + x] = c; }
    get(x, y) { return (x >= 0 && y >= 0 && x < this.w && y < this.h) ? this.p[y * this.w + x] : null; }
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
    ellipse(cx, cy, rx, ry, c, fn) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2;
          if (d <= 1) this.set(x, y, fn ? fn(x, y, d) : c);
        }
    }
    tri(ax, ay, bx, by, cx2, cy2, c) {
      const minx = Math.floor(Math.min(ax, bx, cx2)), maxx = Math.ceil(Math.max(ax, bx, cx2));
      const miny = Math.floor(Math.min(ay, by, cy2)), maxy = Math.ceil(Math.max(ay, by, cy2));
      const s = (px, py, x1, y1, x2, y2) => (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
        const px = x + .5, py = y + .5;
        const d1 = s(px, py, ax, ay, bx, by), d2 = s(px, py, bx, by, cx2, cy2), d3 = s(px, py, cx2, cy2, ax, ay);
        const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
        if (!(neg && pos)) this.set(x, y, c);
      }
    }
    line(x0, y0, x1, y1, c) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0 || 1;
      for (let i = 0; i <= n; i++) this.set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c);
    }
    outline(c) {
      const add = [];
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x + 1, y) || this.get(x - 1, y) || this.get(x, y + 1) || this.get(x, y - 1)) add.push(x, y);
      }
      for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], c || OUT);
      return this;
    }
    canvas() {
      const c = cv(this.w, this.h), x = c.getContext('2d');
      for (let i = 0; i < this.p.length; i++) if (this.p[i]) { x.fillStyle = this.p[i]; x.fillRect(i % this.w, (i / this.w) | 0, 1, 1); }
      return c;
    }
  }

  // ── emoji → crisp pixel sprite ───────────────────────────────────────
  const emojiCache = {};
  function pixEmoji(ch, size) {
    size = size || 20;
    const key = ch + '|' + size;
    if (emojiCache[key]) return emojiCache[key];
    const S = size * 6, big = cv(S, S), b = big.getContext('2d');
    b.textAlign = 'center'; b.textBaseline = 'middle';
    b.font = `${Math.floor(S * 0.82)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    b.fillText(ch, S / 2, S / 2 + S * 0.04);
    // two-step downsample keeps colours clean
    const mid = cv(size * 2, size * 2), m = mid.getContext('2d');
    m.imageSmoothingEnabled = true; m.imageSmoothingQuality = 'high';
    m.drawImage(big, 0, 0, size * 2, size * 2);
    const sm = cv(size, size), s = sm.getContext('2d');
    s.imageSmoothingEnabled = true; s.imageSmoothingQuality = 'high';
    s.drawImage(mid, 0, 0, size, size);
    const d = s.getImageData(0, 0, size, size), px = d.data;
    const r = new Raster(size + 2, size + 2);
    for (let i = 0; i < size * size; i++) {
      const a = px[i * 4 + 3];
      if (a < 100) continue;
      // un-premultiply edge pixels, then posterize a touch so it reads as pixel art
      const k = 255 / a, q = v => Math.min(255, Math.round(Math.min(255, v * k) / 12) * 12);
      const R = q(px[i * 4]), G = q(px[i * 4 + 1]), B = q(px[i * 4 + 2]);
      r.set((i % size) + 1, ((i / size) | 0) + 1, `rgb(${R},${G},${B})`);
    }
    r.outline(OUT);
    const out = r.canvas();
    emojiCache[key] = out;
    return out;
  }

  // paint blob for colour words
  function blob(col, size) {
    size = size || 20;
    const r = new Raster(size + 2, size + 2), [R, G, B] = hex(col);
    const lite = `rgb(${Math.min(255, R + 70)},${Math.min(255, G + 70)},${Math.min(255, B + 70)})`;
    const dark = `rgb(${R * .65 | 0},${G * .65 | 0},${B * .65 | 0})`;
    const c = size / 2 + 1;
    r.ellipse(c, c + 1, size * .42, size * .36, col, (x, y, d) => (y > c + size * .1 && d > .45) ? dark : col);
    r.ellipse(c - size * .32, c + size * .3, size * .1, size * .1, col);
    r.ellipse(c + size * .36, c - size * .18, size * .08, size * .08, col);
    r.ellipse(c + size * .18, c + size * .38, size * .09, size * .07, dark);
    r.ellipse(c - size * .14, c - size * .12, size * .1, size * .06, lite);
    return r.outline().canvas();
  }

  // gold coins in a neat pattern for number words
  const DOTS = { 1: [[.5, .5]], 2: [[.3, .5], [.7, .5]], 3: [[.5, .25], [.28, .72], [.72, .72]], 4: [[.3, .3], [.7, .3], [.3, .7], [.7, .7]],
    5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]], 6: [[.3, .2], [.7, .2], [.3, .5], [.7, .5], [.3, .8], [.7, .8]] };
  function dots(n, size) {
    size = size || 20;
    const r = new Raster(size + 2, size + 2);
    let pts = DOTS[n];
    if (!pts) { pts = []; const cols = n > 8 ? 4 : 3; for (let i = 0; i < n; i++) pts.push([(i % cols + .5) / cols, (Math.floor(i / cols) + .5) / Math.ceil(n / cols)]); }
    const rad = n === 1 ? size * .3 : n === 2 ? size * .18 : n > 6 ? size * .09 : size * .12;
    pts.forEach(([u, v]) => {
      const x = 1 + u * size, y = 1 + v * size;
      r.ellipse(x, y, rad + .6, rad + .6, '#c98a1c');
      r.ellipse(x - .4, y - .4, rad, rad, '#ffd23a');
      r.set(x - rad * .4, y - rad * .5, '#fff5c0');
    });
    return r.outline().canvas();
  }

  function picFor(pic, size) {
    if (pic.startsWith('c:')) return blob(pic.slice(2), size);
    if (pic.startsWith('n:')) return dots(+pic.slice(2), size);
    return pixEmoji(pic, size);
  }

  const urlCache = new WeakMap();
  function url(c) { if (!urlCache.has(c)) urlCache.set(c, c.toDataURL()); return urlCache.get(c); }
  // <img> for a sprite, scaled by an integer factor
  function img(c, scale, cls) {
    const i = new Image();
    i.src = url(c); i.width = c.width * scale; i.height = c.height * scale;
    i.className = 'px ' + (cls || ''); i.draggable = false;
    return i;
  }

  // ── heroes ───────────────────────────────────────────────────────────
  const HERO_ART = {
    fox: [
      '...kk......kk...',
      '..koik....kiok..',
      '..kooikkkkiook..',
      '.kooooooooooook.',
      '.koooeooooeoook.',
      '.koowwwoowwwook.',
      '..kowwwnnwwwok..',
      '...kkwwwwwwkk.b.',
      '..kccssssssk.kbk',
      '.kccslsssslsk.b.',
      '.kccsssssssskhhh',
      '.kccsssyysssk.h.',
      '..kcsssssssk....',
      '..kckssssssk....',
      '...kssk..kssk...',
      '...kook..kook...',
      '..kkkk....kkkk..',
    ],
    cat: [
      '........kk......',
      '.......kppk.....',
      '......kpppk.....',
      '.....kppypk.....',
      '....kppppppk....',
      '..kkpppppppppk..',
      '.kppppppppppppk.',
      '..kkkkkkkkkkkk.m',
      '..kggggggggggkmm',
      '..kgeggggggegk.t',
      '..kgwwgnngwwgk.t',
      '...kgwwwwwwgk..t',
      '..kkccccccccckkt',
      '.kcccccccccccckt',
      '.kcyccccccccyckt',
      '..kcccccccccck.t',
      '...kgk....kgk..t',
      '...kkk....kkk...',
    ],
    dragon: [
      '..k.........k...',
      '.kdk.......kdk..',
      '..kgk.....kgk...',
      '...kggggggggk...',
      '..kggggggggggk..',
      '.kggegggggeggk..',
      '.kggwwggggwwgk..',
      '..kggggnngggk...',
      'kk.kggggggggk.kk',
      'kck.kbbbbbbk.kck',
      'kcckgbbbbbbgkcck',
      '.kckgbbbbbbgkck.',
      '..kkgbbbbbbgkk..',
      '...kggggggggk.kk',
      '...kggk..kggkkgk',
      '...kggk..kggk.k.',
      '..kkkk....kkkk..',
    ],
  };
  const HERO_LEGS = {
    fox: ['...kssk.kssk....', '..kook...kook...', '.kkkk...kkkk....'],
    cat: ['..kgk......kgk..', '..kkk......kkk..'],
    dragon: ['..kggk....kggk..', '..kggk....kggk..', '.kkkk......kkkk.'],
  };
  // cape / robe / wing colour climbs with hero level
  const LEVEL_COL = ['#3a64c8', '#2f9e6a', '#c23a5a', '#8a4fd8', '#e0a01c'];
  const HEROES = {
    fox: { name: 'Flint', title: 'the Fox Knight', pal: { o: '#e8742a', i: '#ffb3a8', w: '#fff4e0', e: '#1a1020', n: '#1a1020', s: '#aab4c8', l: '#eef4ff', y: '#ffd23a', b: '#dfe8f5', h: '#8a5a34' } },
    cat: { name: 'Luna', title: 'the Cat Wizard', pal: { p: '#5a3a9a', y: '#ffd23a', g: '#9a9ab0', e: '#3fd06a', n: '#ff8ccf', w: '#f4f1ea', m: '#6fe3ff', t: '#8a5a34' } },
    dragon: { name: 'Pip', title: 'the Little Dragon', pal: { d: '#f4f1ea', g: '#3fb58a', e: '#1a1020', w: '#bff2dc', n: '#1f6a50', b: '#ffe08a' } },
  };
  const heroCache = {};
  function hero(id, level, frame) {
    const key = id + level + '|' + frame;
    if (heroCache[key]) return heroCache[key];
    const H = HEROES[id], pal = Object.assign({}, H.pal);
    const lc = LEVEL_COL[Math.min(level, 5) - 1];
    if (id === 'fox') pal.c = lc;
    if (id === 'cat') { pal.c = lc; }
    if (id === 'dragon') pal.c = lc;
    let rows = HERO_ART[id].slice();
    if (frame === 1) { const L = HERO_LEGS[id]; rows = rows.slice(0, rows.length - L.length).concat(L); }
    const base = ascii(rows, pal, 16);
    // crown from level 4, golden sparkle trim at level 5
    const c = cv(20, 24), x = c.getContext('2d');
    x.drawImage(base, 2, 5);
    if (level >= 4) {
      const cr = ascii(['k.k.k', 'kykyk', 'kyyyk', 'kkkkk'], { y: '#ffd23a' });
      x.drawImage(cr, id === 'cat' ? 3 : 8, id === 'cat' ? 6 : 2);
    }
    if (level >= 5) { x.fillStyle = '#fff5c0'; [[1, 10], [18, 12], [0, 20], [19, 4]].forEach(([a, b]) => x.fillRect(a, b, 1, 1)); }
    heroCache[key] = c;
    return c;
  }

  // ── small creatures (fox / cat / dragon) in element variants ─────────
  const CRE = {
    fox: ['..k.........k...', '.kik.......kik..', '.kiak.....kaik..', '.kaaakkkkkaaak..', 'kaaaaaaaaaaaaak.', 'kaakeaaaaakeaak.', 'kaakwaaaaakwaak.', 'kbbbaaannaaabbbk', '.kbbbbbbbbbbbk..', '..kkaaaaaaakk.k.', '...kabbbbbak.kak', '...kabbbbbakkaak', '...kaakkkaakaabk', '...kkk...kkkkkk.'],
    cat: ['.k..........k...', 'kak........kak..', 'kiak......kaik..', 'kaaakkkkkkaaak..', 'kaaaaaaaaaaaak..', 'kaakeaaaakeaak..', 'kaakwaaaakwaak..', 'kbbaaaanaaaabbk.', '.kbbbbnbnbbbbk..', '..kkaaaaaaakk..k', '...kaabbbaak.kak', '...kaabbbaakkak.', '...kaakkkaakak..', '...kkk...kkkk...'],
    dragon: ['...k.......k....', '..kck.....kck...', '..kaakkkkkaak...', '.kaaaaaaaaaaak..', 'kaaaaaaaaaaaaak.', 'kaakeaaaaakeaak.', 'kaakwaaaaakwaak.', 'kaaaaanaanaaaak.', '.kaabbbbbbbaak..', 'kk.kkaaaaakk.kk.', 'kcckabbbbbakcck.', '.kcckbbbbbkcck.k', '..kkaabbbaakkkak', '...kaak.kaakaak.', '...kkk...kkkkk..'],
  };
  const ELEM = {
    plain: { a: '#e8742a', b: '#fff4e0', c: '#ffb3a8', e: '#1a1020', i: '#ffb3a8', n: '#1a1020' },
    lava: { a: '#e0482a', b: '#ffd23a', c: '#ff8a1c', e: '#fff1a8', i: '#ffd23a', n: '#3b0d0d' },
    moon: { a: '#8a86c8', b: '#e8e4ff', c: '#b98bff', e: '#6fe3ff', i: '#e8e4ff', n: '#2a1f4a' },
    star: { a: '#ffd23a', b: '#fff5c0', c: '#ff9ad9', e: '#1a1020', i: '#fff5c0', n: '#8a5a1c' },
    steam: { a: '#4fb8c8', b: '#e0fbff', c: '#9ae8f0', e: '#1a1020', i: '#e0fbff', n: '#1f4a5a' },
    shadow: { a: '#4a3a6a', b: '#b98bff', c: '#ff7ad9', e: '#ff4a6a', i: '#b98bff', n: '#120a1a' },
    leaf: { a: '#5aa84a', b: '#e8ffd0', c: '#ffd23a', e: '#1a1020', i: '#e8ffd0', n: '#1f4a2a' },
    gold: { a: '#e0a01c', b: '#fff5c0', c: '#ffffff', e: '#1a1020', i: '#fff5c0', n: '#6a3a0a' },
    ice: { a: '#9ad8f0', b: '#ffffff', c: '#6fb8e8', e: '#1a3a6a', i: '#e0f8ff', n: '#2a5a8a' },
    flower: { a: '#ff9ac8', b: '#fff4f8', c: '#7ad86a', e: '#1a1020', i: '#ffe0ee', n: '#a83a6a' },
    cloud: { a: '#e8ecf8', b: '#ffffff', c: '#a8b4d8', e: '#3a4a8a', i: '#c8d4f0', n: '#5a6a9a' },
    rainbow: { a: '#ff0000', b: '#ffffff', c: '#ffd23a', e: '#1a1020', i: '#ffe0f0', n: '#1a1020' },
    crystal: { a: '#b48af0', b: '#f0e4ff', c: '#6fe3ff', e: '#ffffff', i: '#e0d0ff', n: '#4a2a8a' },
    comet: { a: '#3a4a9a', b: '#ffd23a', c: '#ff7e26', e: '#fff5c0', i: '#6fe3ff', n: '#120a2a' },
    sun: { a: '#ffb820', b: '#fff8c0', c: '#ff6a1c', e: '#1a1020', i: '#fff0a0', n: '#a84a0a' },
  };
  const RAINBOW = ['#ff4a5a', '#ff9a2a', '#ffd23a', '#5ad06a', '#4aa8ff', '#9a6af0'];
  const creCache = {};
  function creature(kind, elem, frame) {
    const key = kind + elem + frame;
    if (creCache[key]) return creCache[key];
    let rows = CRE[kind].slice();
    if (frame === 1) rows = rows.slice(1, rows.length - 1).concat(['................', '................']); // hop: body up, feet off the ground
    const pal = Object.assign({}, ELEM[elem] || ELEM.plain);
    if (kind === 'cat' && elem === 'plain') { pal.a = '#9a9ab0'; pal.i = '#ff8ccf'; }
    if (kind === 'dragon' && elem === 'plain') { pal.a = '#3fb58a'; pal.b = '#ffe08a'; pal.c = '#bff2dc'; }
    pal.w = '#ffffff';
    const c = ascii(rows, pal, 16);
    if (elem === 'rainbow') { // body stripes in rainbow colours, row by row
      const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < d.data.length; i += 4) if (d.data[i] === 255 && d.data[i + 1] === 0 && d.data[i + 2] === 0) { const [R, G, B] = hex(RAINBOW[Math.floor((i / 4) / c.width / 2.4) % 6]); d.data[i] = R; d.data[i + 1] = G; d.data[i + 2] = B; }
      x.putImageData(d, 0, 0);
    }
    if (elem === 'sun' || elem === 'crystal' || elem === 'comet') { // a little glow mark on the head
      const x = c.getContext('2d'), y0 = frame === 1 ? 0 : 1; x.fillStyle = elem === 'comet' ? '#ffd23a' : elem === 'sun' ? '#fff0a0' : '#6fe3ff'; x.fillRect(7, y0 + 3, 2, 2);
    }
    if (elem === 'gold') { const x = c.getContext('2d'), y0 = frame === 1 ? 0 : 1; x.fillStyle = '#1a1020'; x.fillRect(5, y0, 7, 3); x.fillStyle = '#ffd23a'; x.fillRect(6, y0, 1, 2); x.fillRect(8, y0, 1, 2); x.fillRect(10, y0, 1, 2); x.fillRect(6, y0 + 1, 5, 1); }
    creCache[key] = c;
    return c;
  }

  // eggs: speckled, in the colour of what will hatch
  const eggCache = {};
  function egg(col, spot, size) {
    size = size || 14;
    const key = col + spot + size;
    if (eggCache[key]) return eggCache[key];
    const r = new Raster(size, size + 2), [R, G, B] = hex(col);
    const dark = `rgb(${R * .7 | 0},${G * .7 | 0},${B * .7 | 0})`;
    const cx = size / 2, cy = size / 2 + 1.5;
    r.ellipse(cx, cy, size * .36, size * .46, col, (x, y) => {
      const u = (x + .5 - cx) / (size * .36), v = (y + .5 - cy) / (size * .46);
      if (u < -.2 && v < -.2 && u * u + v * v < .5 && u * u + v * v > .2) return '#ffffff';
      if (u > .45 || v > .6) return dark;
      return col;
    });
    [[-.1, .1], [.2, -.25], [.15, .35], [-.25, .45]].forEach(([u, v]) => r.set(cx + u * size * .5, cy + v * size * .5, spot));
    const c = r.outline().canvas();
    eggCache[key] = c;
    return c;
  }

  // ── evil dragon boss, drawn procedurally ────────────────────────────
  const bossCache = {};
  function boss(pal, frame, hurt) {
    const key = pal.body + frame + (hurt ? 'h' : '');
    if (bossCache[key]) return bossCache[key];
    const W = 44, H = 38, r = new Raster(W, H);
    const body = hurt ? '#ffffff' : pal.body, belly = hurt ? '#ffffff' : pal.belly, dk = hurt ? '#ffd0d0' : pal.dark;
    const wy = frame ? 4 : 0;
    // wings
    r.tri(14, 16, 1, 3 + wy, 5, 22 - wy / 2, pal.wing); r.tri(14, 16, 5, 22, 12, 24, dk);
    r.tri(30, 16, 43, 3 + wy, 39, 22 - wy / 2, pal.wing); r.tri(30, 16, 39, 22, 32, 24, dk);
    r.line(14, 16, 1, 3 + wy, dk); r.line(30, 16, 43, 3 + wy, dk);
    // tail
    r.ellipse(33, 33, 7, 3, body); r.tri(38, 31, 43, 27, 41, 34, pal.spike);
    // body + belly
    r.ellipse(22, 27, 11, 9, body, (x, y, d) => d > .7 && y > 27 ? dk : body);
    r.ellipse(22, 29, 6.5, 6.5, belly, (x, y) => (y % 3 === 0) ? pal.bellyLine : belly);
    // feet
    r.rect(14, 34, 5, 3, dk); r.rect(25, 34, 5, 3, dk);
    r.set(14, 37, '#ffffff'); r.set(16, 37, '#ffffff'); r.set(25, 37, '#ffffff'); r.set(27, 37, '#ffffff');
    // head
    r.ellipse(22, 12, 9, 7.5, body, (x, y, d) => d > .75 && y > 13 ? dk : body);
    r.ellipse(22, 16, 6, 3.5, pal.snout);
    r.set(19, 15, dk); r.set(25, 15, dk); // nostrils
    // horns
    r.tri(15, 7, 12, -1, 18, 5, pal.horn); r.tri(29, 7, 32, -1, 26, 5, pal.horn);
    // angry eyes
    r.rect(16, 9, 4, 3, '#fff1a8'); r.rect(24, 9, 4, 3, '#fff1a8');
    r.set(18, 10, '#1a1020'); r.set(18, 11, '#1a1020'); r.set(25, 10, '#1a1020'); r.set(25, 11, '#1a1020');
    r.line(15, 8, 20, 9, '#1a1020'); r.line(24, 9, 29, 8, '#1a1020');
    // mouth (open on frame 2 → breath)
    if (frame === 2) { r.rect(19, 17, 7, 3, '#3b0d0d'); r.set(20, 17, '#ffffff'); r.set(24, 17, '#ffffff'); }
    else { r.line(19, 18, 25, 18, '#1a1020'); r.set(20, 19, '#ffffff'); r.set(24, 19, '#ffffff'); }
    // back spikes
    [[22, 4], [17, 5], [27, 5]].forEach(([x, y]) => r.tri(x - 1.5, y + 1, x + 1.5, y + 1, x, y - 2, pal.spike));
    const c = r.outline().canvas();
    bossCache[key] = c;
    return c;
  }

  // UI glyphs drawn by hand (emoji versions blur at small sizes)
  const GLYPH = {
    speaker: ['.....k.......', '....kk...k...', 'kkkkwk....k..', 'kwwwwk..k..k.', 'kwwwwk...k.k.', 'kwwwwk...k.k.', 'kwwwwk..k..k.', 'kkkkwk....k..', '....kk...k...', '.....k.......'],
    star: ['.....k.....', '....kyk....', '....kwk....', 'kkkkywykkkk', 'kyyyyyyyyyk', '.kyyyyyyyk.', '..kyyyyyk..', '..kyykyyk..', '.kyyk.kyyk.', '.kyk...kyk.', '.kk.....kk.'],
    mute: ['.....k.......', '....kk.......', 'kkkkwk.k...k.', 'kwwwwk..k.k..', 'kwwwwk...k...', 'kwwwwk..k.k..', 'kkkkwk.k...k.', '....kk.......', '.....k.......'],
  };
  const glyph = (name, col) => ascii(GLYPH[name], { w: col || '#ffffff', k: '#1a1020', y: '#ffd23a' });
  window.SPR = { OUT, cv, hex, ascii, Raster, pixEmoji, blob, dots, picFor, url, img, hero, HEROES, LEVEL_COL, creature, ELEM, egg, boss, glyph };
})();
