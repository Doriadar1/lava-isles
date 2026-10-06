// The five English mini-games, the hatchery (merge & evolve) and the hero camp.
(function () {
  const { h, icon, pic, wait, speakBtn, heHint } = UI;
  const rand = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = ST.shuffle;
  const praise = () => rand(WB.PRAISE);
  const alive = el => document.body.contains(el);
  const ELEMS = ['fire', 'moon', 'star', 'water', 'leaf', 'rock'];
  // 'a cat', 'an egg', 'red' - the right little word before a noun
  const art = o => (['color', 'number', 'describe', 'action'].includes(o.cat)) ? '' : (/^[aeiou]/.test(o.w) ? 'an ' : 'a ');
  const THING = o => ['animal', 'thing', 'food', 'body'].includes(o.cat);

  function cheer(el, text) {
    AUD.sfx('good');
    FX.burstEl(el, 26);
    const p = text || praise();
    AUD.say(p);
    return p;
  }

  // ════════════════════════════════════════════════════════════════════
  // 0. ABC — first letters: "c is for cat"
  // ════════════════════════════════════════════════════════════════════
  const TRICKY = new Set(['one', 'eye', 'owl', 'ear', 'ant', 'island', 'giraffe', 'unicorn', 'octopus']);   // first sound doesn't match the letter a beginner learns
  async function abc() {
    const LV = ST.lvl('abc'), ROUNDS = [0, 5, 6, 6, 7, 8][LV], NOPT = [0, 3, 4, 4, 5, 6][LV];
    const sh = UI.shell('ABC', '🔠', ROUNDS, '', LV);
    UI.open(sh.root);
    AUD.music('game');
    const ok = o => THING(o) && !TRICKY.has(o.w) && /^[a-z]+$/.test(o.w) && !/^(sh|ch|th|wh|ph|kn)/.test(o.w);
    const words = ST.pick(ROUNDS, ok, LV);
    let correct = 0;
    const cardPx = NOPT > 4 ? 140 : 170;
    const big = L => h('div', { class: 'word', style: 'font-size:150px;line-height:1;color:var(--gold);text-shadow:0 6px 0 var(--ink)' }, LV >= 3 ? L.toUpperCase() : L.toUpperCase() + L);
    for (let r = 0; r < ROUNDS; r++) {
      if (!alive(sh.root)) return;
      const w = words[r % words.length], L = w.w[0];
      const used = new Set([L]);
      const others = ST.shuffle(WB.WORDS.filter(o => ok(o) && o.pic !== w.pic)).filter(o => { if (used.has(o.w[0])) return false; used.add(o.w[0]); return true; }).slice(0, NOPT - 1);
      // level 4+: sometimes only the sound, no picture
      const hearOnly = LV >= 4 && r % 3 === 2;
      let miss = 0;
      let resolve; const done = new Promise(r_ => (resolve = r_));
      const win = async el => {
        if (!miss) correct++;
        ST.record(w.w, !miss, 'phonics');
        el.classList.add('good'); AUD.sfx('good'); FX.burstEl(el, 26);
        const line = `${L} is for ${w.w}!`;
        msg.textContent = line; await AUD.say(line);
        sh.pip(r, miss ? 'miss' : 'on');
        await wait(700); resolve();
      };
      const bad = el => { miss++; el.classList.remove('bad'); void el.offsetWidth; el.classList.add('bad'); AUD.sfx('bad'); };
      const msg = h('div', { class: 'word', style: 'font-size:40px;min-height:52px;color:var(--mint)' });
      let top, row, heTxt, sayQ;
      if (r % 2 === 0 && !hearOnly) {
        // see the letter → find the picture that starts with it
        const opts = ST.shuffle([w, ...others]);
        sayQ = `${L}. Which one starts with ${L}?`;
        top = h('div', { class: 'row', style: 'gap:24px' }, big(L), speakBtn(sayQ, true));
        row = h('div', { class: 'row', style: 'gap:20px' }, ...opts.map(o => {
          const c = h('div', { class: 'card', style: `width:${cardPx}px;height:${cardPx}px` }, pic(o.pic, cardPx - 42));
          c.onclick = () => { if (o === w) win(c); else { bad(c); AUD.say(o.w + ' starts with ' + o.w[0] + '.'); } };
          return c;
        }));
        heTxt = `איזו תמונה מתחילה באות ${L.toUpperCase()}?`;
      } else {
        // see the picture → pick its first letter
        const letters = ST.shuffle([L, ...others.map(o => o.w[0])]);
        sayQ = `${w.w}. What letter does ${w.w} start with?`;
        top = hearOnly
          ? h('div', { class: 'row', style: 'gap:24px' }, h('div', { class: 'card', style: 'width:190px;height:170px;cursor:default;font-size:100px;font-family:var(--pix);color:#6a4a6e' }, '?'), speakBtn(w.w, true))
          : h('div', { class: 'row', style: 'gap:24px' }, h('div', { class: 'card', style: 'padding:14px 20px;cursor:default' }, pic(w.pic, 150)), speakBtn(w.w, true));
        const bp = NOPT > 4 ? 124 : 150;
        row = h('div', { class: 'row', style: 'gap:20px' }, ...letters.map(x => {
          const b = h('button', { class: 'card word', style: `width:${bp}px;height:${bp}px;font-size:${bp * 0.56 | 0}px;padding:0` }, LV >= 3 ? x.toUpperCase() : x.toUpperCase() + x);
          b.onclick = () => { if (x === L) win(b); else { bad(b); AUD.say(x); } };
          return b;
        }));
        heTxt = hearOnly ? 'הקשב למילה. באיזו אות היא מתחילה?' : 'באיזו אות מתחילה המילה? הקשב לצליל הראשון.';
      }
      sh.body.replaceChildren(top, UI.heLine(heTxt), row, msg);
      await wait(200); AUD.say(sayQ);
      await done;
    }
    if (!alive(sh.root)) return;
    UI.results({ correct, total: ROUNDS, gems: correct * 3 + (correct === ROUNDS ? 4 : 0) + LV, items: [ST.dropItem()], again: abc, onClose: backToWorld });
  }

  // ════════════════════════════════════════════════════════════════════
  // 1. POTION LAB — read the recipe, find the pictures
  // ════════════════════════════════════════════════════════════════════
  function cauldron(scale) {
    const W = 64, H = 58, c = SPR.cv(W, H), x = c.getContext('2d');
    c.className = 'px'; c.style.width = W * scale + 'px'; c.style.height = H * scale + 'px';
    const st = { col: '#3fd08a', bubbles: [], puff: 0 };
    const pot = new SPR.Raster(W, H);
    pot.ellipse(32, 36, 24, 17, '#2b2438', (px, py, d) => d > .75 && px > 34 ? '#1d1828' : px < 22 && py < 38 && d > .5 ? '#4a4060' : '#2b2438');
    pot.rect(12, 50, 6, 5, '#2b2438'); pot.rect(46, 50, 6, 5, '#2b2438');
    pot.ellipse(32, 22, 25, 6, '#4a4060');
    pot.outline();
    const potC = pot.canvas();
    function frame(now) {
      if (!alive(c)) return;
      const t = now / 1000;
      x.clearRect(0, 0, W, H);
      // fire
      for (let i = 0; i < 14; i++) { const fx = 18 + i * 2, fh = 3 + Math.round((Math.sin(t * 12 + i * 1.7) + 1) * 2.5); x.fillStyle = '#ff7e26'; x.fillRect(fx, H - fh, 2, fh); x.fillStyle = '#ffd262'; x.fillRect(fx, H - Math.max(1, fh - 3), 2, Math.max(1, fh - 3)); }
      x.drawImage(potC, 0, 0);
      // liquid
      x.fillStyle = st.col;
      for (let yy = -4; yy <= 4; yy++) { const hw = Math.round(22 * Math.sqrt(1 - (yy / 5) ** 2)); x.fillRect(32 - hw, 22 + yy, hw * 2, 1); }
      x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(20, 20, 6, 1); x.fillRect(38, 23, 4, 1);
      if (Math.random() < 0.15) st.bubbles.push({ x: 14 + Math.random() * 36, y: 22, r: 1 + (Math.random() * 2 | 0), v: 6 + Math.random() * 8 });
      st.bubbles.forEach(b => { b.y -= b.v / 60; });
      st.bubbles = st.bubbles.filter(b => b.y > 2);
      st.bubbles.forEach(b => { x.fillStyle = st.col; x.fillRect(Math.round(b.x), Math.round(b.y), b.r + 1, b.r + 1); x.fillStyle = '#ffffff'; x.fillRect(Math.round(b.x), Math.round(b.y), 1, 1); });
      if (st.puff > 0) { st.puff -= 1 / 60; for (let i = 0; i < 20; i++) { x.fillStyle = i % 2 ? '#ffffff' : st.col; x.fillRect(32 + Math.round(Math.cos(i * 1.3 + t) * (1 - st.puff) * 30), 18 - Math.round((1 - st.puff) * 18 + Math.sin(i) * 6), 2, 2); } }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { el: c, set: col => (st.col = col), puff: () => (st.puff = 1) };
  }
  const POTION_COL = ['#3fd08a', '#ff8ccf', '#6fe3ff', '#ffd23a', '#b98bff', '#ff7e26'];

  async function potion() {
    const LV = ST.lvl('potion'), ROUNDS = 4;
    const sh = UI.shell('Potion Lab', '🧪', ROUNDS, '', LV);
    UI.open(sh.root);
    AUD.music('game');
    let correct = 0, total = 0;
    const SHELF = [0, 5, 6, 7, 8, 8][LV];
    for (let r = 0; r < ROUNDS; r++) {
      if (!alive(sh.root)) return;
      const n = [0, 2, 2, 3, 3, 4][LV] + (LV === 2 && r >= 2 ? 1 : 0);
      const targets = ST.pick(n, THING, LV);
      const extra = [];
      targets.forEach(tg => ST.distract(tg, 4, THING).forEach(d => { if (!targets.includes(d) && !extra.includes(d) && !targets.some(t => t.pic === d.pic) && !extra.some(e => e.pic === d.pic)) extra.push(d); }));
      const shelf = shuffle(targets.concat(extra.slice(0, SHELF - n)));
      const left = new Set(targets.map(t => t.w));
      let misses = 0;
      const recipeText = 'Put in ' + targets.map(t => art(t) + t.w).join(', ').replace(/, ([^,]*)$/, ' and $1') + '.';
      // level 5: the recipe words don't read themselves out
      const chips = targets.map(t => h('div', { class: 'word' + (LV < 5 ? ' say' : ''), 'data-say': LV < 5 ? t.w : null, style: `font-size:${n > 3 ? 36 : 44}px;padding:4px 18px 8px;background:#f4e4c4;box-shadow:0 0 0 4px var(--ink);color:var(--ink);display:flex;align-items:center;gap:10px` }, t.w));
      const pot = cauldron(n > 3 ? 3 : 4);
      pot.set(POTION_COL[r % POTION_COL.length]);
      const scroll = h('div', { class: 'col', style: 'background:#e8d4a8;color:var(--ink);padding:18px 26px 22px;box-shadow:0 0 0 4px var(--ink),inset 0 -8px 0 #c8b088;min-width:280px' },
        h('div', { class: 'row', style: 'gap:12px' }, h('div', { style: 'font-family:var(--pix);font-size:28px' }, 'Recipe'), LV < 5 ? speakBtn(recipeText) : null),
        ...chips);
      const cpx = SHELF > 7 ? 108 : 132;
      const cards = shelf.map(o => {
        const c = h('div', { class: 'card', style: `width:${cpx}px;height:${cpx}px` }, pic(o.pic, cpx - 36));
        c.onclick = async () => {
          if (c.classList.contains('dim')) return;
          if (left.has(o.w)) {
            left.delete(o.w); total++;
            const first = misses === 0; if (first) correct++;
            ST.record(o.w, first, 'read');
            const chip = chips[targets.indexOf(o)];
            chip.style.background = '#bff2cf'; chip.append(icon('✅', 32));
            // fly into the pot
            const a = c.getBoundingClientRect(), b = pot.el.getBoundingClientRect();
            c.style.transition = 'transform .45s cubic-bezier(.5,-0.4,.7,1), opacity .45s';
            c.style.transform = `translate(${b.left + b.width / 2 - a.left - a.width / 2}px, ${b.top + 60 - a.top - a.height / 2}px) scale(.3) rotate(200deg)`;
            c.style.opacity = '0'; c.classList.add('dim');
            AUD.sfx('whoosh'); AUD.say(o.w);
            await wait(450); AUD.sfx('bubble'); AUD.sfx('bubble');
            pot.set(POTION_COL[(r + targets.length - left.size) % POTION_COL.length]);
            FX.burstEl(pot.el, 16, ['#ffffff', POTION_COL[r % 6]], 300);
            if (!left.size) done();
          } else {
            misses++;
            c.classList.remove('bad'); void c.offsetWidth; c.classList.add('bad');
            AUD.sfx('bad');
            AUD.say('This is ' + art(o) + o.w + '.');
            if (misses >= 3) { const need = shelf.find(s => left.has(s.w)); const i = shelf.indexOf(need); cardEls[i].classList.add('glow'); }
          }
        };
        return c;
      });
      const cardEls = cards;
      let resolveRound;
      const roundDone = new Promise(r_ => (resolveRound = r_));
      const done = async () => {
        pot.puff(); AUD.sfx('magic');
        await wait(500);
        const msg = 'You made a potion!';
        potionMsg.textContent = msg; AUD.say(msg);
        FX.burstEl(pot.el, 40);
        sh.pip(r, misses ? 'miss' : 'on');
        await wait(1700);
        resolveRound();
      };
      const potionMsg = h('div', { class: 'word', style: 'font-size:36px;color:var(--gold);min-height:46px;text-shadow:0 3px 0 var(--ink)' });
      sh.body.replaceChildren(
        UI.heLine('קרא את המתכון, ומצא את התמונות. גע בתמונה כדי לשים אותה בסיר.'),
        h('div', { class: 'row', style: 'gap:40px;align-items:flex-end' }, scroll, h('div', { class: 'col' }, pot.el, potionMsg)),
        h('div', { class: 'row', style: 'gap:18px' }, ...cards));
      if (r === 0 && LV < 4) { await wait(300); AUD.say(recipeText); }
      await roundDone;
    }
    if (!alive(sh.root)) return;
    UI.results({ correct, total, gems: correct * 3 + (correct === total ? 4 : 0) + LV, items: [rand(['eggFox', 'eggCat', 'eggDragon']), ST.dropItem()], again: potion, onClose: backToWorld });
  }

  // ════════════════════════════════════════════════════════════════════
  // 2. LETTER GRID — connect letters to spell words
  // ════════════════════════════════════════════════════════════════════
  const COMMON = 'aeioustrnlcdmpbghfwky';
  async function grid() {
    const LV = ST.lvl('grid'), BOARDS = 2, PER = [0, 2, 3, 3, 3, 4][LV], N = [0, 4, 5, 5, 6, 6][LV];
    const maxLen = [0, 3, 4, 5, 6, 6][LV], minLen = LV >= 4 ? 4 : 3, TS = N >= 6 ? 72 : 84;
    const sh = UI.shell('Letter Grid', '🔤', BOARDS * PER, '', LV);
    UI.open(sh.root);
    AUD.music('game');
    let correct = 0, total = 0, pipI = 0;
    for (let bIdx = 0; bIdx < BOARDS; bIdx++) {
      if (!alive(sh.root)) return;
      const targets = ST.pick(PER, o => /^[a-z]+$/.test(o.w) && o.w.length <= maxLen && o.w.length >= minLen, LV);
      const found = new Set();
      let hinted = new Set();
      let G = [];                 // G[r][c] = { ch, el }
      const boardEl = h('div', { style: `display:grid;grid-template-columns:repeat(${N},${TS}px);gap:8px;touch-action:none;position:relative` });
      const chainWord = h('div', { class: 'word', style: 'font-size:48px;min-height:60px;letter-spacing:6px;color:var(--gold);text-shadow:0 4px 0 var(--ink)' });
      const tcards = targets.map(t => {
        const slots = h('div', { class: 'row', style: 'gap:4px;flex-wrap:nowrap' }, ...t.w.split('').map(() => h('div', { style: `width:${t.w.length > 6 ? 22 : 30}px;height:38px;border-bottom:4px solid var(--ink);font-size:${t.w.length > 6 ? 24 : 30}px;font-weight:700;text-align:center` })));
        return h('div', { class: 'card', style: 'padding:10px 14px;min-width:190px;cursor:default' }, h('div', { class: 'row', style: 'gap:8px' }, pic(t.pic, PER > 3 ? 50 : 72), speakBtn(t.w)), slots);
      });
      // ── grid generation with the target words planted as connected paths
      const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
      const inb = (r, c) => r >= 0 && c >= 0 && r < N && c < N;
      function plant(word, cells) {
        for (let tries = 0; tries < 300; tries++) {
          const free = [];
          for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!cells[r][c]) free.push([r, c]);
          if (!free.length) return false;
          const path = [rand(free)];
          const walk = () => {
            if (path.length === word.length) return true;
            const [r, c] = path[path.length - 1];
            for (const [dr, dc] of shuffle(DIRS.slice())) {
              const nr = r + dr, nc = c + dc;
              if (inb(nr, nc) && !cells[nr][nc] && !path.some(p => p[0] === nr && p[1] === nc)) { path.push([nr, nc]); if (walk()) return true; path.pop(); }
            }
            return false;
          };
          if (walk()) { path.forEach(([r, c], i) => (cells[r][c] = word[i])); return true; }
        }
        return false;
      }
      function build(keep) {
        for (let attempt = 0; attempt < 200; attempt++) {
          const cells = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => keep ? keep[r][c] : null));
          const need = targets.filter(t => !found.has(t.w));
          if (need.every(t => plant(t.w, cells))) {
            const pool = need.map(t => t.w).join('') + COMMON;
            for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!cells[r][c]) cells[r][c] = rand(pool);
            return cells;
          }
          keep = null;
        }
      }
      function findPath(word) {
        const res = [];
        const dfs = (r, c, i) => {
          if (!inb(r, c) || G[r][c].ch !== word[i] || res.some(p => p[0] === r && p[1] === c)) return false;
          res.push([r, c]); if (i === word.length - 1) return true;
          for (const [dr, dc] of DIRS) if (dfs(r + dr, c + dc, i + 1)) return true;
          res.pop(); return false;
        };
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (dfs(r, c, 0)) return res;
        return null;
      }
      const tileStyle = `width:${TS}px;height:${TS}px;font-size:${TS * 0.55 | 0}px;padding:0;font-family:var(--word);font-weight:700`;
      function render(cells, anim) {
        boardEl.replaceChildren();
        G = cells.map((row, r) => row.map((ch, c) => {
          const el = h('div', { class: 'card', style: tileStyle + (anim ? `;animation:popIn .35s ${(r * N + c) * 0.015}s both` : '') }, ch);
          el.dataset.r = r; el.dataset.c = c;
          boardEl.append(el);
          return { ch, el };
        }));
      }
      render(build(), true);
      // ── selecting
      let chain = [], dragging = false, moved = false;
      const cur = () => chain.map(([r, c]) => G[r][c].ch).join('');
      const paint = () => {
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const e = G[r][c].el; const on = chain.some(p => p[0] === r && p[1] === c); e.style.background = on ? '#ffd23a' : ''; e.style.transform = on ? 'scale(1.06)' : ''; }
        chainWord.textContent = cur().toUpperCase();
      };
      const adj = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) === 1;
      function touch(r, c) {
        const p = [r, c], idx = chain.findIndex(q => q[0] === r && q[1] === c);
        if (idx >= 0) { chain = chain.slice(0, idx + 1); }
        else if (!chain.length || adj(chain[chain.length - 1], p)) chain.push(p);
        else chain = [p];
        AUD.sfx('pick', chain.length - 1);
        paint(); check();
      }
      let busy = false;
      async function check() {
        const w = cur();
        const t = targets.find(t => t.w === w && !found.has(t.w));
        if (!t || busy) return;
        busy = true;
        found.add(w); total++;
        const first = !hinted.has(w); if (first) correct++;
        ST.record(w, first, 'spell');
        sh.pip(pipI++, first ? 'on' : 'miss');
        const card = tcards[targets.indexOf(t)];
        const slots = card.querySelectorAll('.row')[1].children;
        const cells = chain.slice();
        chain = []; paint();
        cells.forEach(([r, c], i) => { const e = G[r][c].el; e.style.background = '#3fd08a'; e.style.transform = 'scale(1.15)'; setTimeout(() => { slots[i].textContent = w[i]; AUD.sfx('pick', i + 2); }, 120 * i); });
        cheer(card, w);
        card.style.background = '#bff2cf';
        await wait(700);
        cells.forEach(([r, c]) => { const e = G[r][c].el; e.style.transition = 'transform .25s, opacity .25s'; e.style.transform = 'scale(0)'; e.style.opacity = '0'; });
        await wait(280);
        // gravity: drop letters down, new ones from the top
        const gone = new Set(cells.map(([r, c]) => r + ',' + c));
        const next = Array.from({ length: N }, () => Array(N).fill(null));
        for (let c = 0; c < N; c++) {
          const col = [];
          for (let r = N - 1; r >= 0; r--) if (!gone.has(r + ',' + c)) col.push(G[r][c].ch);
          for (let r = N - 1, k = 0; r >= 0; r--, k++) next[r][c] = col[k] || null;
        }
        const need = targets.filter(t => !found.has(t.w));
        const pool = need.map(t => t.w).join('') + COMMON;
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!next[r][c]) next[r][c] = rand(pool);
        G = next.map(row => row.map(ch => ({ ch })));
        let ok = need.every(t => findPath(t.w));
        render(ok ? next : build(), !ok);
        busy = false;
        if (found.size === targets.length) finishBoard();
      }
      boardEl.addEventListener('pointerdown', e => {
        const el = e.target.closest('[data-r]'); if (!el) return;
        dragging = true; moved = false; boardEl.setPointerCapture(e.pointerId);
        touch(+el.dataset.r, +el.dataset.c);
      });
      boardEl.addEventListener('pointermove', e => {
        if (!dragging) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const t = el && el.closest && el.closest('[data-r]'); if (!t) return;
        const r = +t.dataset.r, c = +t.dataset.c, last = chain[chain.length - 1];
        if (last && last[0] === r && last[1] === c) return;
        // only react when the pointer is near the tile centre, so diagonals work
        const b = t.getBoundingClientRect(); if (Math.hypot(e.clientX - b.left - b.width / 2, e.clientY - b.top - b.height / 2) > TS * 0.38) return;
        moved = true; touch(r, c);
      });
      boardEl.addEventListener('pointerup', () => {
        dragging = false;
        if (moved && chain.length > 1 && !busy) {
          const w = cur();
          if (w.length >= 3 && WB.BY[w] && !targets.some(t => t.w === w)) bonus(w);
          else if (!targets.some(t => t.w === w)) { AUD.sfx('bad'); chain = []; paint(); }
        }
      });
      const bonusSeen = new Set();
      function bonus(w) {
        chain = []; paint();
        if (bonusSeen.has(w)) return;
        bonusSeen.add(w); UI.addGems(2, chainWord); UI.toast('Bonus word: ' + w + '!', WB.BY[w].pic.length < 5 ? WB.BY[w].pic : '⭐');
      }
      const hintBtn = h('button', { class: 'btn small blue' }, icon('💡', 32), 'Help');
      hintBtn.onclick = () => {
        const t = targets.find(t => !found.has(t.w)); if (!t) return;
        hinted.add(t.w);
        const p = findPath(t.w);
        AUD.say(t.w);
        if (p) { const n = Math.min(p.length, 1 + [...hinted].length); p.slice(0, 2).forEach(([r, c]) => { G[r][c].el.style.animation = ''; G[r][c].el.classList.add('glow'); }); setTimeout(() => p.forEach(([r, c]) => G[r] && G[r][c] && G[r][c].el && G[r][c].el.classList.remove('glow')), 2500); }
      };
      const clearBtn = h('button', { class: 'btn small gray', onclick: () => { chain = []; paint(); AUD.sfx('tap'); } }, 'Clear');
      let resolveBoard; const boardDone = new Promise(r => (resolveBoard = r));
      async function finishBoard() { AUD.sfx('win'); FX.confetti(60); await wait(1400); resolveBoard(); }
      sh.body.replaceChildren(
        h('div', { class: 'row', style: 'gap:36px;align-items:center;flex-wrap:nowrap' },
          h('div', { class: 'col', style: 'gap:16px' }, h('div', { class: 'word say', 'data-say': 'Find the words!', style: 'font-size:28px' }, 'Find the words!'), UI.heLine('חבר אותיות סמוכות (גרור או גע) כדי לכתוב את המילים.'), h('div', { style: `display:grid;grid-template-columns:repeat(${PER > 3 ? 2 : 1},auto);gap:12px` }, ...tcards)),
          h('div', { class: 'col' }, chainWord, boardEl, h('div', { class: 'row' }, hintBtn, clearBtn))));
      AUD.say('Find the words!');
      await boardDone;
    }
    if (!alive(sh.root)) return;
    UI.results({ correct, total, gems: correct * 3 + (correct === total ? 4 : 0) + LV, items: [ST.dropItem()], again: grid, onClose: backToWorld });
  }

  // ════════════════════════════════════════════════════════════════════
  // 3. SENTENCES — fill the gap / put the words in order
  // ════════════════════════════════════════════════════════════════════
  const SIGHT = ['is', 'can', 'the', 'a', 'in', 'on', 'my', 'have', 'see', 'like', 'am', 'it'];
  async function sentence() {
    const LV = ST.lvl('sentence'), ROUNDS = 5, ORDER_MAX = [0, 4, 5, 6, 7, 8][LV], NWRONG = LV >= 4 ? 3 : 2, EXTRA = [0, 0, 0, 1, 1, 2][LV];
    const sh = UI.shell('Sentences', '📜', ROUNDS, '', LV);
    UI.open(sh.root);
    AUD.music('game');
    const list = ST.sentences(ROUNDS, LV);
    let correct = 0;
    const karaoke = async (spans, text) => {
      AUD.say(text, { rate: 0.95 });
      for (const s of spans) { s.style.color = '#c4381c'; s.style.transform = 'translateY(-6px)'; await wait(420); s.style.color = ''; s.style.transform = ''; }
    };
    for (let r = 0; r < ROUNDS; r++) {
      if (!alive(sh.root)) return;
      const s = list[r % list.length], mode = (r % 2 === 1 && s.words.length <= ORDER_MAX) ? 'order' : 'gap';
      const art = h('div', { class: 'card', style: 'padding:16px 26px;cursor:default;flex-direction:row;gap:14px;min-height:170px' }, ...s.pics.map(p => pic(p, s.pics.length > 2 ? 72 : 128)));
      const line = h('div', { class: 'row', style: 'gap:14px;min-height:90px' });
      const opts = h('div', { class: 'row', style: 'gap:22px' });
      let miss = 0;
      let resolve; const done = new Promise(r_ => (resolve = r_));
      const wordSpan = w => h('span', { class: 'word', style: `font-size:${s.words.length > 6 ? 42 : 52}px;transition:all .15s;display:inline-block` }, w);
      if (mode === 'gap') {
        const answer = s.words[s.blank];
        const spans = s.words.map((w, i) => i === s.blank ? h('span', { class: 'word', style: 'font-size:52px;min-width:150px;border-bottom:6px dashed var(--gold);display:inline-block;text-align:center;color:var(--gold)' }, '?') : wordSpan(w));
        spans[spans.length - 1].textContent += '.';
        if (s.blank === s.words.length - 1) spans[s.blank].dataset.dot = '1';
        line.append(...spans);
        const inBank = WB.BY[answer.toLowerCase()];
        let wrong = inBank ? ST.distract(inBank, NWRONG).map(o => o.w) : shuffle(SIGHT.filter(w => w !== answer.toLowerCase())).slice(0, NWRONG);
        const choices = shuffle([answer, ...wrong]);
        choices.forEach(w => {
          const b = h('button', { class: 'card word', style: 'font-size:44px;padding:10px 30px 16px' }, w);
          b.onclick = async () => {
            if (w === answer) {
              if (!miss) correct++;
              ST.record(answer.toLowerCase(), !miss, 'sentence');
              spans[s.blank].textContent = w + (spans[s.blank].dataset.dot ? '.' : ''); spans[s.blank].style.color = '#3fd08a'; spans[s.blank].style.borderBottomStyle = 'solid';
              b.classList.add('good'); cheer(b, ' ');
              [...opts.children].forEach(x => x !== b && x.classList.add('dim'));
              await wait(500); await karaoke(spans, s.text); await wait(400);
              sh.pip(r, miss ? 'miss' : 'on'); resolve();
            } else {
              miss++; b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); AUD.sfx('bad');
              if (miss >= 3) [...opts.children].find(x => x.textContent === answer).classList.add('glow');
            }
          };
          opts.append(b);
        });
      } else {
        const slots = s.words.map(() => h('span', { class: 'word', style: 'font-size:48px;min-width:110px;min-height:66px;border-bottom:6px dashed #6a4a6e;display:inline-block;text-align:center' }, ''));
        line.append(...slots, h('span', { class: 'word', style: 'font-size:48px' }, '.'));
        let k = 0;
        let order = shuffle(s.words.map((w, i) => ({ w, i })));
        if (order.every((o, i) => o.i === i)) order.reverse();
        // higher levels: one or two words that don't belong
        if (EXTRA) order = shuffle(order.concat(shuffle(SIGHT.concat(ST.distract(WB.BY[s.words[s.blank].toLowerCase()] || WB.WORDS[0], 3).map(o => o.w)).filter(x => !s.words.map(y => y.toLowerCase()).includes(x))).slice(0, EXTRA).map(w => ({ w, i: -1 }))));
        order.forEach(o => {
          const b = h('button', { class: 'card word', style: 'font-size:42px;padding:10px 24px 16px' }, o.w);
          b.onclick = async () => {
            if (s.words[k] === o.w) {
              slots[k].textContent = o.w; slots[k].style.borderBottomColor = '#3fd08a'; slots[k].style.animation = 'popIn .3s';
              AUD.sfx('pick', k); AUD.say(o.w); b.classList.add('dim'); k++;
              if (k === s.words.length) {
                if (!miss) correct++;
                ST.record('sentence', !miss, 'sentence');
                cheer(line, ' '); await wait(500); await karaoke(slots, s.text); await wait(400);
                sh.pip(r, miss ? 'miss' : 'on'); resolve();
              }
            } else {
              miss++; b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); AUD.sfx('bad');
              if (miss >= 3) [...opts.children].find(x => x.textContent === s.words[k] && !x.classList.contains('dim')).classList.add('glow');
            }
          };
          opts.append(b);
        });
      }
      const prompt = mode === 'gap' ? 'Which word is missing?' : 'Put the words in order.';
      sh.body.replaceChildren(
        h('div', { class: 'row', style: 'gap:14px' }, h('div', { class: 'word say', 'data-say': prompt, style: 'font-size:30px;color:#c8b8d8' }, prompt), speakBtn(mode === 'gap' ? s.words.map((w, i) => i === s.blank ? '...' : w).join(' ') : s.text)),
        UI.heLine(mode === 'gap' ? 'איזו מילה חסרה? קרא את המשפט ובחר מילה.' : 'גע במילים לפי הסדר הנכון.'),
        art, line, opts, heHint(s.he));
      AUD.say(prompt);
      await done;
      opts.querySelectorAll('.glow').forEach(x => x.classList.remove('glow'));
    }
    if (!alive(sh.root)) return;
    UI.results({ correct, total: ROUNDS, gems: correct * 4 + (correct === ROUNDS ? 4 : 0) + LV, items: [ST.dropItem()], again: sentence, onClose: backToWorld });
  }

  // ════════════════════════════════════════════════════════════════════
  // 4. MAGIC VOICE — read out loud
  // ════════════════════════════════════════════════════════════════════
  async function speak() {
    const LV = ST.lvl('speak'), ROUNDS = 5;
    const sh = UI.shell('Magic Voice', '🎤', ROUNDS, '', LV);
    UI.open(sh.root);
    AUD.music('game');
    const mic = AUD.canListen();
    const nSent = [0, 0, 1, 2, 3, 3][LV], SMAX = [0, 4, 5, 6, 7, 8][LV];
    const items = ST.pick(ROUNDS - nSent, null, LV).map(o => ({ text: o.w, pic: [o.pic], he: o.he, word: o.w }))
      .concat(ST.sentences(nSent + 3, LV).filter(s => s.words.length <= SMAX).slice(0, LV >= 4 ? nSent - 1 : nSent).map(s => ({ text: s.text, pic: s.pics, he: s.he })))
      .concat(LV >= 4 ? [tenseItem(LV)] : []);
    while (items.length < ROUNDS) { const o = ST.pick(1, null, LV)[0]; items.push({ text: o.w, pic: [o.pic], he: o.he, word: o.w }); }
    let correct = 0;
    for (let r = 0; r < ROUNDS; r++) {
      if (!alive(sh.root)) return;
      const it = items[r];
      let tries = 0;
      const words = it.text.replace('.', '').split(' ');
      const spans = words.map(w => h('span', { class: 'word', style: `font-size:${words.length > 1 ? 64 : 110}px;transition:color .2s;display:inline-block` }, w));
      const status = h('div', { class: 'word', style: 'font-size:28px;min-height:40px;color:#c8b8d8' });
      const bars = h('div', { class: 'row', style: 'gap:6px;height:40px;align-items:flex-end;visibility:hidden' }, ...[0, 1, 2, 3, 4].map(i => h('div', { style: `width:10px;background:var(--mint);height:10px;animation:bars .5s ${i * 0.1}s infinite alternate` })));
      let resolve; const done = new Promise(r_ => (resolve = r_));
      const success = async () => {
        if (!tries) correct++;
        ST.record(it.word || 'read-sentence', tries === 0, 'speak');
        spans.forEach(s => (s.style.color = '#3fd08a'));
        AUD.sfx('magic'); FX.burstEl(spans[0], 50, ['#6fe3ff', '#b98bff', '#ffffff', '#ffd23a']);
        status.textContent = praise(); AUD.say(status.textContent);
        sh.pip(r, tries ? 'miss' : 'on');
        await wait(1500); resolve();
      };
      const micBtn = h('button', { class: 'btn', style: 'width:150px;height:150px;border-radius:50%;padding:0;background:#ff5a6a;box-shadow:0 0 0 5px var(--ink),inset 0 -12px 0 #b02a3a,inset 0 6px 0 #ffc0c8,0 10px 0 5px rgba(0,0,0,.35)' }, icon('🎤', 80));
      const listenBtn = speakBtn(it.text, true);
      const saidBtn = h('button', { class: 'btn green', style: 'font-size:28px' }, icon('✅', 34), 'I said it!');
      const skipBtn = h('button', { class: 'btn small gray hidden' }, 'Next');
      skipBtn.onclick = () => { ST.record(it.word || 'read-sentence', false, 'speak'); sh.pip(r, 'miss'); resolve(); };
      micBtn.onclick = async () => {
        if (micBtn.dataset.busy) return;
        micBtn.dataset.busy = '1'; micBtn.style.animation = 'glow 1s infinite';
        bars.style.visibility = 'visible'; status.textContent = 'Listening...';
        AUD.sfx('pop');
        const res = await AUD.listen(it.text, (heard) => {
          status.textContent = '“' + heard + '”';
          const hw = heard.toLowerCase().split(' ');
          spans.forEach((s, i) => { if (hw.some(x => AUD.score(words[i], x) >= 1)) s.style.color = '#3fd08a'; });
        });
        delete micBtn.dataset.busy; micBtn.style.animation = ''; bars.style.visibility = 'hidden';
        if (res.ok) return success();
        tries++;
        if (res.error === 'not-allowed' || res.error === 'service-not-allowed') { status.textContent = 'The microphone is off. Use "I said it!"'; micBtn.remove(); controls.append(saidBtn); return; }
        status.textContent = res.heard ? `I heard “${res.heard}”. Try again!` : 'I did not hear you. Try again!';
        AUD.sfx('bad');
        await wait(600); AUD.say('Listen. ' + it.text);
        if (tries >= 2) skipBtn.classList.remove('hidden');
      };
      saidBtn.onclick = () => success();
      const controls = h('div', { class: 'row', style: 'gap:30px' }, listenBtn, mic ? micBtn : saidBtn, skipBtn);
      const prompt = mic ? 'Read it out loud! Tap the red button.' : 'Read it out loud!';
      const hePrompt = mic ? 'קרא בקול! לחץ על הכפתור האדום ודבר.' : 'קרא בקול! אחר כך מבוגר לוחץ על הכפתור הירוק.';
      sh.body.replaceChildren(
        h('div', { class: 'word say', 'data-say': 'Read it out loud!', style: 'font-size:30px;color:#c8b8d8' }, prompt), UI.heLine(hePrompt),
        h('div', { class: 'row', style: 'gap:40px;align-items:center' }, h('div', { class: 'card', style: 'padding:14px 22px;cursor:default;flex-direction:row' }, ...it.pic.map(p => pic(p, 150))), h('div', { class: 'row', style: 'gap:20px;max-width:640px' }, ...spans)),
        heHint(it.he), bars, status, controls);
      await done;
    }
    if (!alive(sh.root)) return;
    UI.results({ correct, total: ROUNDS, gems: mic ? correct * 4 + (correct === ROUNDS ? 4 : 0) + LV : correct, items: mic ? [ST.dropItem()] : [], again: speak, onClose: backToWorld });
  }

  // ════════════════════════════════════════════════════════════════════
  // 5. RUNE FORGE — hear it, write it
  // ════════════════════════════════════════════════════════════════════
  async function spell() {
    const LV = ST.lvl('spell'), ROUNDS = 5;
    const sh = UI.shell('Rune Forge', '✏️', ROUNDS, '', LV);
    UI.open(sh.root);
    AUD.music('game');
    const maxLen = [0, 3, 4, 5, 6, 7][LV], minLen = LV >= 4 ? 4 : 3;
    const words = ST.pick(ROUNDS, o => /^[a-z]+$/.test(o.w) && o.w.length <= maxLen && o.w.length >= minLen, LV);
    let correct = 0;
    let onKey = null;
    const keyH = e => { if (!alive(sh.root)) { document.removeEventListener('keydown', keyH); return; } onKey && onKey(e.key.toLowerCase()); };
    document.addEventListener('keydown', keyH);
    for (let r = 0; r < ROUNDS; r++) {
      if (!alive(sh.root)) break;
      const o = words[r], w = o.w;
      const rec = ST.S.words[w];
      // faint letters to copy: always at level 1, for new or shaky words at 2, only brand-new words at 3-4, never at 5
      const ghost = LV === 1 || (LV === 2 && (!rec || rec.st === 0)) || (LV <= 4 && LV >= 3 && !rec);
      let pos = 0, miss = 0, missHere = 0;
      const slots = w.split('').map(ch => h('div', { style: 'width:80px;height:96px;background:#1a1020;box-shadow:inset 0 0 0 4px #4d3354;display:grid;place-items:center;font-size:66px;font-weight:700;font-family:var(--word);color:' + (ghost ? 'rgba(255,244,224,.22)' : 'transparent') }, ch));
      const letters = shuffle(w.split('').concat(shuffle('abcdefghijklmnoprstuwy'.split('').filter(c => !w.includes(c))).slice(0, LV >= 4 ? Math.max(4, 10 - w.length) : Math.max(3, 8 - w.length))));
      let resolve; const done = new Promise(r_ => (resolve = r_));
      const keys = letters.map(ch => {
        const b = h('button', { class: 'card word', style: 'width:84px;height:84px;font-size:46px;padding:0' }, ch);
        b.onclick = () => press(ch, b);
        return b;
      });
      async function press(ch, b) {
        if (pos >= w.length) return;
        b = b || keys.find(k => k.textContent === ch && !k.classList.contains('dim')) || keys.find(k => k.textContent === ch);
        if (ch === w[pos]) {
          const s = slots[pos];
          s.textContent = ch; s.style.color = 'var(--gold)'; s.style.animation = 'popIn .25s'; s.style.boxShadow = 'inset 0 0 0 4px var(--gold)';
          FX.burstEl(s, 10, ['#ffd262', '#ff7e26', '#ffffff'], 250);
          AUD.sfx('hammer'); AUD.sfx('pick', pos);
          keys.forEach(k => k.classList.remove('glow'));
          pos++; missHere = 0;
          if (pos === w.length) {
            if (!miss) correct++;
            ST.record(w, !miss, 'spell');
            slots.forEach(s => (s.style.color = '#3fd08a'));
            await wait(250); cheer(slots[0].parentElement, w);
            await wait(1200); sh.pip(r, miss ? 'miss' : 'on'); resolve();
          }
        } else if (/^[a-z]$/.test(ch)) {
          miss++; missHere++;
          if (b) { b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); }
          AUD.sfx('bad');
          if (missHere >= 3) { const k = keys.find(k => k.textContent === w[pos]); k && k.classList.add('glow'); }
        }
      }
      onKey = ch => press(ch);
      sh.body.replaceChildren(
        h('div', { class: 'word say', 'data-say': 'Write the word!', style: 'font-size:30px;color:#c8b8d8' }, 'Write the word!'), UI.heLine('הקשב למילה וכתוב אותה. אפשר גם במקלדת.'),
        h('div', { class: 'row', style: 'gap:30px' }, h('div', { class: 'card', style: 'padding:14px 20px;cursor:default' }, pic(o.pic, 140)), speakBtn(w, true)),
        h('div', { class: 'row', style: 'gap:10px' }, ...slots),
        h('div', { class: 'row', style: 'gap:12px;max-width:760px' }, ...keys),
        heHint(o.he));
      await wait(200); AUD.say(w);
      await done;
    }
    document.removeEventListener('keydown', keyH);
    if (!alive(sh.root)) return;
    UI.results({ correct, total: ROUNDS, gems: correct * 4 + (correct === ROUNDS ? 4 : 0) + LV, items: [ST.dropItem()], again: spell, onClose: backToWorld });
  }

  // ════════════════════════════════════════════════════════════════════
  // 6. MEMORY — flip cards, match each word to its picture
  // ════════════════════════════════════════════════════════════════════
  async function memory() {
    const LV = ST.lvl('memory'), PAIRS = [0, 3, 4, 5, 6, 8][LV], CP = PAIRS > 6 ? 120 : 150, COLS = PAIRS === 3 ? 3 : PAIRS === 5 ? 5 : 4;
    const sh = UI.shell('Memory', '🃏', PAIRS, '', LV);
    UI.open(sh.root);
    AUD.music('game');
    const words = ST.pick(PAIRS, null, LV);
    const deck = shuffle(words.flatMap(o => [{ o, kind: 'pic' }, { o, kind: 'word' }]));
    let open_ = [], matched = 0, tries = 0, lock = false;
    const missed = new Set();
    let resolve; const done = new Promise(r => (resolve = r));
    const back = () => h('div', { style: 'font-family:var(--pix);font-size:56px;color:#ffd23a;text-shadow:0 4px 0 #1a1020' }, '?');
    const cards = deck.map(d => {
      const c = h('div', { class: 'card', style: `width:${CP}px;height:${CP}px;background:#5a3a9a;transition:transform .2s,background .2s` }, back());
      c.onclick = async () => {
        if (lock || c.dataset.open || c.dataset.done) return;
        c.dataset.open = '1'; c.style.transform = 'rotateY(90deg)'; AUD.sfx('tap');
        await wait(120);
        c.style.background = ''; c.replaceChildren(d.kind === 'pic' ? pic(d.o.pic, CP - 46) : h('div', { class: 'word', style: `font-size:${d.o.w.length > 7 ? 26 : d.o.w.length > 5 ? 34 : 44}px` }, d.o.w));
        c.style.transform = '';
        if (d.kind === 'word') AUD.say(d.o.w);
        open_.push({ c, d });
        if (open_.length < 2) return;
        lock = true; tries++;
        const [a, b] = open_; open_ = [];
        if (a.d.o === b.d.o && a.d.kind !== b.d.kind) {
          if (!missed.has(a.d.o.w)) ST.record(a.d.o.w, true, 'read');
          sh.pip(matched, missed.has(a.d.o.w) ? 'miss' : 'on');
          matched++;
          [a.c, b.c].forEach(x => { x.dataset.done = '1'; x.classList.add('good'); });
          cheer(b.c, a.d.o.w);
          await wait(600); lock = false;
          if (matched === PAIRS) { await wait(700); resolve(); }
        } else {
          if (a.d.kind !== b.d.kind) { missed.add(a.d.o.w); missed.add(b.d.o.w); }
          await wait(1100);
          [a.c, b.c].forEach(x => { delete x.dataset.open; x.style.background = '#5a3a9a'; x.replaceChildren(back()); });
          lock = false;
        }
      };
      return c;
    });
    sh.body.replaceChildren(
      h('div', { class: 'word say', 'data-say': 'Find a word and its picture!', style: 'font-size:28px;color:#c8b8d8' }, 'Find a word and its picture!'), UI.heLine('הפוך קלפים. מצא מילה והתמונה שלה.'),
      h('div', { style: `display:grid;grid-template-columns:repeat(${COLS},${CP}px);gap:14px` }, ...cards));
    AUD.say('Find a word and its picture!');
    await done;
    if (!alive(sh.root)) return;
    const correct = PAIRS - missed.size / 2;
    UI.results({ correct: Math.max(0, Math.round(correct)), total: PAIRS, gems: Math.round(correct) * 3 + LV, items: [ST.dropItem()], again: memory, onClose: backToWorld });
  }

  // ════════════════════════════════════════════════════════════════════
  // HATCHERY — combine items; only the right pair makes something new
  // ════════════════════════════════════════════════════════════════════
  const keyArt = (k, scale) => {
    if (k.startsWith('c:')) { const [, kind, elem] = k.split(':'); return SPR.img(SPR.creature(kind, elem, 0), scale || 5); }
    const it = ST.ITEMS[k];
    return it.egg ? SPR.img(SPR.egg(it.egg[0], it.egg[1]), scale || 5) : icon(it.pic, (scale || 5) * 12);
  };
  const keyName = k => { if (k.startsWith('c:')) { const r = ST.RECIPES.find(r => 'c:' + r.kind + ':' + r.elem === k); return r ? r.name : k; } return ST.ITEMS[k].word; };
  function have(k) {
    const S = ST.S;
    if (k.startsWith('c:')) { const [, kind, elem] = k.split(':'); return S.creatures.filter(c => c.kind === kind && c.elem === elem).length; }
    return S.items[k] || 0;
  }
  function possibleMixes() { return ST.RECIPES.filter((r, i) => !ST.S.found[i] && have(r.a) > 0 && have(r.b) > (r.a === r.b ? 1 : 0)).length; }

  function hatch() {
    const S = ST.S;
    AUD.music('world');
    const slots = [null, null];
    const sh = UI.shell('Hatchery', '🥚', 0);
    UI.open(sh.root);
    const inv = h('div', { style: 'display:grid;grid-template-columns:repeat(3,96px);gap:10px;align-content:start;max-height:540px;overflow:auto;padding:6px' });
    const slotEls = [0, 1].map(i => h('div', { class: 'card', style: 'width:130px;height:130px;background:#3a2640;box-shadow:0 0 0 4px var(--ink),inset 0 0 0 6px #4d3354' }));
    const nest = h('div', { class: 'col', style: 'gap:10px;min-width:220px' });
    const msg = h('div', { class: 'word', style: 'font-size:28px;min-height:70px;text-align:center;max-width:400px' });
    const mixBtn = h('button', { class: 'btn green', style: 'font-size:34px' }, 'Mix!');
    const book = h('div', { class: 'col', style: 'gap:8px;align-items:stretch;overflow:auto;max-height:520px;padding:4px 10px 4px 4px' });
    function drawInv() {
      inv.replaceChildren();
      const keys = Object.keys(ST.ITEMS).filter(k => have(k) > 0);
      const cre = [...new Set(S.creatures.map(c => 'c:' + c.kind + ':' + c.elem))].filter(k => ST.RECIPES.some(r => r.a === k));
      keys.concat(cre).forEach(k => {
        const used = slots.filter(s => s === k).length, n = have(k) - used;
        const rare = !k.startsWith('c:') && ST.ITEMS[k].rare;
        const c = h('div', { class: 'card' + (n <= 0 ? ' dim' : ''), style: 'padding:8px 4px 6px;height:124px' + (rare ? ';background:#fff0b0' : '') }, rare ? h('div', { style: 'position:absolute;top:2px;left:4px' }, icon('✨', 20)) : null, keyArt(k, 4), h('div', { class: 'word', style: 'font-size:18px;text-align:center;line-height:1' }, keyName(k)), h('div', { style: 'position:absolute;top:4px;right:6px;font-family:var(--pix);font-size:20px' }, '×' + n));
        c.onclick = () => { const i = slots.indexOf(null); AUD.say(keyName(k)); if (i < 0) return; slots[i] = k; AUD.sfx('pick', i * 3); drawAll(); };
        inv.append(c);
      });
      if (!keys.length && !cre.length) inv.append(h('div', { class: 'word', style: 'grid-column:1/-1;font-size:22px;color:#c8b8d8' }, 'No items yet. Play games!'));
    }
    function drawSlots() {
      slotEls.forEach((el, i) => {
        el.replaceChildren();
        if (slots[i]) { el.append(keyArt(slots[i], 7), h('div', { class: 'word', style: 'font-size:20px' }, keyName(slots[i]))); el.onclick = () => { slots[i] = null; AUD.sfx('tap'); drawAll(); }; }
        else { el.append(h('div', { style: 'font-family:var(--pix);font-size:60px;color:#6a4a6e' }, '?')); el.onclick = null; }
      });
      mixBtn.toggleAttribute('disabled', !(slots[0] && slots[1]));
    }
    function drawBook() {
      book.replaceChildren(h('div', { style: 'font-family:var(--pix);font-size:26px;color:var(--gold)' }, 'Clue book'));
      ST.RECIPES.forEach((r, i) => {
        if (S.found[i]) {
          book.append(h('div', { class: 'row', style: 'gap:6px;background:#3a2640;padding:6px 8px;flex-wrap:nowrap;justify-content:flex-start' }, keyArt(r.a, 3), '+', keyArt(r.b, 3), '=', r.make ? keyArt(r.make, 3) : SPR.img(SPR.creature(r.kind, r.elem, 0), 4), h('span', { class: 'word say', 'data-say': r.name, style: 'font-size:18px' }, r.name)));
        } else {
          book.append(h('div', { class: 'row say', 'data-say': r.clue, style: `gap:8px;background:#2a1b2e;box-shadow:inset 0 0 0 3px ${r.rare ? '#e0a01c' : '#4d3354'};padding:8px 10px;flex-wrap:nowrap;justify-content:flex-start;cursor:pointer` }, icon(r.rare ? '✨' : r.evo ? '👑' : r.make ? '⚗️' : '❓', 26), h('span', { class: 'word', style: 'font-size:21px' }, r.clue), h('span', { style: 'margin-left:auto' }, SPR.img(SPR.glyph('speaker'), 2))));
        }
      });
    }
    function drawAll() { drawInv(); drawSlots(); drawBook(); UI.updateBadges(); }
    mixBtn.onclick = async () => {
      const [a, b] = slots;
      const rec = ST.findRecipe(a, b);
      AUD.sfx('magic');
      slotEls.forEach(el => { el.style.transition = 'transform .4s'; el.style.transform = 'scale(.8) rotate(10deg)'; });
      await wait(400);
      slotEls.forEach(el => { el.style.transform = ''; });
      if (!rec) {
        msg.textContent = 'Nothing happened. Read the clues!'; AUD.sfx('bad'); AUD.say(msg.textContent);
        slots[0] = slots[1] = null; drawAll();
        return;
      }
      const idx = ST.RECIPES.indexOf(rec);
      // use up the ingredients
      [a, b].forEach(k => {
        if (k.startsWith('c:')) { const [, kind, elem] = k.split(':'); const j = S.creatures.findIndex(c => c.kind === kind && c.elem === elem); if (j >= 0) S.creatures.splice(j, 1); }
        else S.items[k]--;
      });
      slots[0] = slots[1] = null;
      const firstTime = !S.found[idx];
      S.found[idx] = true;
      if (rec.make) {
        // two things make a new thing
        S.items[rec.make] = (S.items[rec.make] || 0) + 1; ST.save();
        const it = ST.ITEMS[rec.make], art = icon(it.pic, 160);
        art.style.animation = 'popIn .5s cubic-bezier(.2,1.8,.4,1), float 1.4s .5s ease-in-out infinite';
        AUD.sfx('hatch'); FX.burstEl(nest, 60); if (it.rare) FX.confetti(100);
        const line = (/^[aeiou]/.test(it.word) ? 'You made an ' : 'You made a ') + it.word + '!';
        const stage = h('div', { class: 'col', style: 'position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,#4d3354,#1a1020 70%);justify-content:center;z-index:20;gap:18px' }, art,
          h('div', { class: 'word say', 'data-say': line, style: 'font-size:54px;color:var(--gold);text-shadow:0 4px 0 var(--ink)' }, line),
          it.rare ? h('div', { class: 'word', style: 'font-size:26px;color:#fff0b0' }, '✨ Rare! ✨') : null,
          h('button', { class: 'btn green', onclick: () => { stage.remove(); drawAll(); } }, 'Yay!'));
        sh.root.append(stage); AUD.say(line);
        return;
      }
      S.creatures.push({ kind: rec.kind, elem: rec.elem, name: rec.name });
      ST.save();
      // hatch show
      const eggEl = rec.evo ? keyArt(rec.a, 10) : SPR.img(SPR.egg(...ST.ITEMS[rec.a].egg), 10);
      eggEl.style.animation = 'shake .35s 4';
      const stage = h('div', { class: 'col', style: 'position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,#4d3354,#1a1020 70%);justify-content:center;z-index:20;gap:18px' }, eggEl);
      sh.root.append(stage);
      AUD.sfx('pop'); await wait(500); AUD.sfx('pop'); await wait(500); AUD.sfx('pop'); await wait(500);
      AUD.sfx('hatch'); FX.burstEl(eggEl, 90); FX.confetti(80);
      const cre = SPR.img(SPR.creature(rec.kind, rec.elem, 0), 11);
      cre.style.animation = 'popIn .5s cubic-bezier(.2,1.8,.4,1), float 1.4s .5s ease-in-out infinite';
      const line = (rec.evo ? 'It grew up! ' : 'It is a ') + rec.name + '!';
      stage.replaceChildren(cre, h('div', { class: 'word say', 'data-say': line, style: 'font-size:54px;color:var(--gold);text-shadow:0 4px 0 var(--ink)' }, line),
        firstTime ? h('div', { class: 'word', style: 'font-size:24px' }, (rec.rare ? '✨ Rare! ' : 'New! ') + 'It lives on your island now.') : null,
        h('button', { class: 'btn green', onclick: () => { stage.remove(); drawAll(); } }, 'Yay!'));
      AUD.say(line);
      WORLD.syncCreatures(); UI.updateHud();
    };
    nest.append(h('div', { class: 'row', style: 'gap:16px;flex-wrap:nowrap' }, slotEls[0], h('div', { style: 'font-family:var(--pix);font-size:50px' }, '+'), slotEls[1]), mixBtn, msg);
    sh.body.style.justifyContent = 'flex-start';
    sh.body.replaceChildren(h('div', { style: 'display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,330px);gap:20px;width:100%;align-items:start;margin-top:8px' },
      h('div', { class: 'col', style: 'align-items:flex-start' }, h('div', { style: 'font-family:var(--pix);font-size:26px;color:var(--gold)' }, 'Your things'), inv),
      h('div', { class: 'col', style: 'margin-top:60px' }, nest),
      book));
    drawAll();
    AUD.say('Put two things together!');
    UI.root_onClose = null;
  }

  // ════════════════════════════════════════════════════════════════════
  // HERO CAMP — switch hero, level up
  // ════════════════════════════════════════════════════════════════════
  function camp() {
    const S = ST.S, id = S.hero, lv = S.heroLv[id], H = SPR.HEROES[id];
    const cost = ST.HERO_COST[lv - 1];
    const power = l => 1 + (l >= 3 ? 1 : 0) + (l >= 5 ? 1 : 0);
    const stat = (label, a, b) => h('div', { class: 'row', style: 'gap:12px;font-size:26px;justify-content:flex-start' }, h('b', { class: 'say', 'data-say': label, style: 'min-width:110px' }, label), h('span', null, a), b !== undefined ? h('span', { style: 'color:var(--mint)' }, '→ ' + b) : null);
    const me = SPR.img(SPR.hero(id, lv, 0), 10); me.style.animation = 'float 1.6s ease-in-out infinite';
    const next = lv < 5 ? SPR.img(SPR.hero(id, lv + 1, 0), 6) : null;
    const up = h('button', { class: 'btn green', style: 'font-size:30px' }, 'Level up!', h('span', { style: 'display:inline-flex;align-items:center;gap:4px' }, icon('💎', 32), String(cost)));
    if (lv >= 5 || S.gems < cost) up.setAttribute('disabled', '');
    up.onclick = () => {
      if (!UI.spend(cost)) return;
      S.heroLv[id]++; ST.save();
      AUD.sfx('win'); FX.confetti(100);
      UI.close(); UI.dock(); camp();
      UI.toast(H.name + ' is level ' + S.heroLv[id] + '!', '⭐');
    };
    const sc = h('div', { class: 'screen frame', style: 'height:auto' },
      h('div', { class: 'sh' }, h('h2', { class: 'say', 'data-say': H.name + ' ' + H.title }, H.name + ' ' + H.title), h('button', { class: 'close', onclick: () => { AUD.sfx('tap'); UI.close(); } }, '×')),
      h('div', { class: 'row', style: 'gap:50px;padding:10px 0 20px' },
        h('div', { class: 'col' }, me, h('div', { style: 'font-family:var(--pix);font-size:30px' }, 'Level ' + lv)),
        h('div', { class: 'col', style: 'align-items:flex-start;gap:16px' },
          stat('Power', power(lv), lv < 5 && power(lv + 1) !== power(lv) ? power(lv + 1) : undefined),
          stat('Gems', '+' + (lv - 1) * 10 + '%', lv < 5 ? '+' + lv * 10 + '%' : undefined),
          h('div', { style: 'font-size:18px;color:#c8b8d8;max-width:360px' }, 'Power: hits on dragons. Gems: extra gems after each game.'),
          lv < 5 ? h('div', { class: 'row', style: 'gap:14px' }, h('span', { class: 'word', style: 'font-size:22px' }, 'Next:'), next) : h('div', { class: 'word', style: 'font-size:26px;color:var(--gold)' }, 'Max level!'),
          h('div', { class: 'row' }, up, h('button', { class: 'btn blue', style: 'font-size:26px', onclick: () => UI.heroPick(() => { UI.dock(); }) }, 'Change hero')))));
    UI.open(sc);
    AUD.say(H.name + ' ' + H.title);
  }

  // ════════════════════════════════════════════════════════════════════
  // tense helpers
  // ════════════════════════════════════════════════════════════════════
  const WHEN = {
    past: { label: 'Past', icon: '🌙', col: '#9a86c8', he: 'עבר (קרה כבר)' },
    now: { label: 'Present', icon: '☀️', col: '#ffd23a', he: 'הווה (קורה תמיד)' },
    future: { label: 'Future', icon: '🚀', col: '#6fe3ff', he: 'עתיד (יקרה)' },
  };
  function tenseItem(LV) {
    const vb = rand(WB.VERBS.filter(v => LV >= 4 || v.regular)), s = WB.tenseSentence(vb, rand(['past', 'now', 'future']), rand(WB.SUBJECTS));
    return { text: s.text, pic: s.pics, he: s.he };
  }
  // pick verb + subject + time, never the same verb twice in a row
  function tenseDeck(n, LV, whens) {
    const verbs = shuffle(WB.VERBS.filter(v => LV >= 4 || v.regular));
    const subs = WB.SUBJECTS.filter(s => LV >= 3 || !s.third);
    const ws = [];
    while (ws.length < n) ws.push(...shuffle(whens.slice()));
    return ws.slice(0, n).map((when, i) => ({ vb: verbs[i % verbs.length], when, subj: rand(subs) }));
  }
  const timeline = (active, hint) => h('div', { class: 'row', style: 'gap:12px;flex-wrap:nowrap' }, ...['past', 'now', 'future'].map(k => {
    const on = active === k && hint;
    return h('div', { class: 'say', 'data-say': WHEN[k].label, style: `display:flex;align-items:center;gap:8px;padding:6px 14px 8px;font-size:24px;font-weight:700;background:${on ? WHEN[k].col : '#2a1b2e'};color:${on ? 'var(--ink)' : '#c8b8d8'};box-shadow:0 0 0 3px var(--ink);transition:all .3s;cursor:pointer`, 'data-when': k }, icon(WHEN[k].icon, 30), WHEN[k].label);
  }));
  const karaokeSpans = async (spans, text) => {
    AUD.say(text, { rate: 0.95 });
    for (const s of spans) { s.style.color = '#c4381c'; s.style.transform = 'translateY(-6px)'; await wait(380); s.style.color = ''; s.style.transform = ''; }
  };

  // ════════════════════════════════════════════════════════════════════
  // 7. TIME MACHINE — pick the right verb: jumped / jumps / will jump
  // ════════════════════════════════════════════════════════════════════
  async function tense() {
    const LV = ST.lvl('tense'), ROUNDS = 5;
    const sh = UI.shell('Time Machine', '⏳', ROUNDS, '', LV);
    UI.open(sh.root);
    AUD.music('game');
    const whens = LV === 1 ? ['past', 'future'] : ['past', 'now', 'future'];
    const deck = tenseDeck(ROUNDS, LV, whens);
    let correct = 0;
    for (let r = 0; r < ROUNDS; r++) {
      if (!alive(sh.root)) return;
      const { vb, when, subj } = deck[r];
      const s = WB.tenseSentence(vb, when, subj, { timeFirst: LV <= 2 || Math.random() < 0.4 });
      const ans = s.verbForm;
      // the choices: past / present / future forms (+ the plain verb at level 3+, so "jump" vs "jumps" matters)
      let forms = whens.map(x => WB.form(vb, x, subj));
      if (LV >= 3) forms.push(subj.third ? vb.v : vb.s3);
      forms = shuffle([...new Set(forms)]);
      const timeWords = s.time ? s.time.w.split(' ').map(x => x.toLowerCase()) : [];
      const spans = [];
      s.words.forEach((x, j) => {
        if (j > s.verbAt && j < s.verbAt + s.verbLen) return;
        if (j === s.verbAt) { spans.push(h('span', { class: 'word', style: 'font-size:50px;min-width:170px;border-bottom:6px dashed var(--gold);display:inline-block;text-align:center;color:var(--gold)' }, '?')); return; }
        const isTime = timeWords.includes(x.toLowerCase());
        spans.push(h('span', { class: 'word', style: `font-size:50px;display:inline-block;transition:all .15s;${isTime && LV <= 3 ? 'color:' + WHEN[when].col + ';text-shadow:0 3px 0 var(--ink)' : ''}` }, x));
      });
      spans[spans.length - 1].textContent += '.';
      const gap = spans[s.verbAt];
      const tl = timeline(when, LV <= 2);
      let miss = 0, resolve; const done = new Promise(r_ => (resolve = r_));
      const opts = h('div', { class: 'row', style: 'gap:20px' }, ...forms.map(f => {
        const b = h('button', { class: 'card word', style: 'font-size:40px;padding:10px 26px 16px' }, f);
        b.onclick = async () => {
          if (f === ans) {
            if (!miss) correct++;
            ST.record('tense-' + when, !miss, 'tense');
            gap.textContent = f + (s.verbAt === s.words.length - s.verbLen ? '.' : ''); gap.style.color = '#3fd08a'; gap.style.borderBottomStyle = 'solid';
            b.classList.add('good'); AUD.sfx('magic'); FX.burstEl(b, 24, [WHEN[when].col, '#ffffff']);
            [...opts.children].forEach(x => x !== b && x.classList.add('dim'));
            tl.querySelectorAll('[data-when]').forEach(e => { if (e.dataset.when === when) { e.style.background = WHEN[when].col; e.style.color = 'var(--ink)'; e.style.transform = 'scale(1.12)'; } });
            await wait(400); await karaokeSpans(spans, s.text); await wait(500);
            sh.pip(r, miss ? 'miss' : 'on'); resolve();
          } else {
            miss++; b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); AUD.sfx('bad');
            const why = when === 'past' ? 'It already happened.' : when === 'future' ? 'It did not happen yet.' : 'It happens every day.';
            msg.textContent = why; AUD.say(why);
            if (miss >= 2) [...opts.children].find(x => x.textContent === ans).classList.add('glow');
          }
        };
        return b;
      }));
      const msg = h('div', { class: 'word', style: 'font-size:26px;min-height:34px;color:#ffb0a0' });
      const art = h('div', { class: 'card', style: 'padding:10px 22px;cursor:default;flex-direction:row;gap:18px' }, pic(subj.pic, 96), pic(vb.pic, 96));
      sh.body.replaceChildren(
        h('div', { class: 'row', style: 'gap:14px' }, h('div', { class: 'word say', 'data-say': 'When is it? Pick the right word.', style: 'font-size:28px;color:#c8b8d8' }, 'When is it? Pick the right word.'), speakBtn(s.words.map((x, j) => j === s.verbAt ? '...' : (j > s.verbAt && j < s.verbAt + s.verbLen) ? '' : x).join(' '))),
        UI.heLine('עבר = Past (ed-) · הווה = Present · עתיד = Future (will)'),
        tl, art, h('div', { class: 'row', style: 'gap:14px;min-height:80px' }, ...spans), opts, msg, heHint(s.he));
      AUD.say('When is it?');
      await done;
    }
    if (!alive(sh.root)) return;
    UI.results({ correct, total: ROUNDS, gems: correct * 4 + (correct === ROUNDS ? 4 : 0) + LV, items: [ST.dropItem()], again: tense, onClose: backToWorld });
  }

  // ════════════════════════════════════════════════════════════════════
  // 8. PAST / PRESENT / FUTURE — read a sentence, send it to the right time
  // ════════════════════════════════════════════════════════════════════
  async function when() {
    const LV = ST.lvl('when'), ROUNDS = [0, 5, 6, 6, 7, 8][LV];
    const sh = UI.shell('When?', '🕰️', ROUNDS, '', LV);
    UI.open(sh.root);
    AUD.music('game');
    const whens = LV === 1 ? ['past', 'future'] : ['past', 'now', 'future'];
    const deck = tenseDeck(ROUNDS, LV, whens);
    let correct = 0;
    for (let r = 0; r < ROUNDS; r++) {
      if (!alive(sh.root)) return;
      const { vb, when: wh, subj } = deck[r];
      // level 3+: no time word — the verb alone tells you when
      const s = WB.tenseSentence(vb, wh, subj, { noTime: LV >= 3, timeFirst: Math.random() < 0.5 });
      const spans = s.words.map((x, j) => h('span', { class: 'word', style: 'font-size:52px;display:inline-block;transition:all .15s' }, x + (j === s.words.length - 1 ? '.' : '')));
      const card = h('div', { class: 'card', style: 'padding:16px 26px 20px;cursor:default;gap:12px;max-width:900px' },
        h('div', { class: 'row', style: 'gap:16px' }, pic(subj.pic, 80), pic(vb.pic, 80)),
        h('div', { class: 'row', style: 'gap:14px' }, ...spans), speakBtn(s.text));
      let miss = 0, resolve; const done = new Promise(r_ => (resolve = r_));
      const msg = h('div', { class: 'word', style: 'font-size:26px;min-height:34px;color:#ffb0a0;text-align:center' });
      const boxes = h('div', { class: 'row', style: 'gap:22px' }, ...whens.map(k => {
        const b = h('button', { class: 'card', style: `width:220px;height:150px;gap:4px;background:${WHEN[k].col}` }, icon(WHEN[k].icon, 64), h('div', { class: 'word', style: 'font-size:30px' }, WHEN[k].label));
        b.onclick = async () => {
          AUD.say(WHEN[k].label);
          if (k === wh) {
            if (!miss) correct++;
            ST.record('tense-' + wh, !miss, 'tense');
            b.classList.add('good'); AUD.sfx('magic'); FX.burstEl(b, 30);
            // the sentence card flies into its box
            const a = card.getBoundingClientRect(), c = b.getBoundingClientRect();
            card.style.transition = 'transform .5s cubic-bezier(.5,-0.3,.7,1), opacity .5s';
            card.style.transform = `translate(${c.left + c.width / 2 - a.left - a.width / 2}px, ${c.top + c.height / 2 - a.top - a.height / 2}px) scale(.2)`;
            card.style.opacity = '0';
            await wait(550); msg.style.color = 'var(--mint)'; msg.textContent = s.text; await AUD.say(s.text); await wait(300);
            sh.pip(r, miss ? 'miss' : 'on'); resolve();
          } else {
            miss++; b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); AUD.sfx('bad');
            const vf = s.verbForm, hint = wh === 'past' ? `"${vf}" means it already happened.` : wh === 'future' ? `"will" means it did not happen yet.` : `"${vf}" means it happens all the time.`;
            msg.textContent = hint; await wait(400); AUD.say(hint);
            // light up the verb
            for (let j = s.verbAt; j < s.verbAt + s.verbLen; j++) { spans[j].style.color = '#c4381c'; spans[j].style.transform = 'translateY(-6px)'; }
            if (miss >= 2) [...boxes.children].find((x, i) => whens[i] === wh).classList.add('glow');
          }
        };
        return b;
      }));
      sh.body.replaceChildren(
        h('div', { class: 'row', style: 'gap:14px' }, h('div', { class: 'word say', 'data-say': 'Read it. When is it?', style: 'font-size:30px;color:#c8b8d8' }, 'Read it. When is it?')),
        UI.heLine(LV >= 3 ? 'אין מילת זמן! תסתכל על הפועל: ed- = עבר, will = עתיד, בלי = הווה.' : 'קרא את המשפט. מתי זה קורה? Past (עבר), Present (הווה), או Future (עתיד)?'),
        card, boxes, msg, heHint(s.he));
      if (LV <= 2) karaokeSpans(spans, s.text); else AUD.say('Read it. When is it?');
      await done;
    }
    if (!alive(sh.root)) return;
    UI.results({ correct, total: ROUNDS, gems: correct * 3 + (correct === ROUNDS ? 4 : 0) + LV, items: [ST.dropItem()], again: when, onClose: backToWorld });
  }

  // ════════════════════════════════════════════════════════════════════
  // 9. WORD BRIDGE — build the sentence plank by plank across the lava
  // ════════════════════════════════════════════════════════════════════
  async function builder() {
    const LV = ST.lvl('builder'), ROUNDS = 4, EXTRA = [0, 0, 1, 1, 2, 3][LV], MAXW = [0, 4, 5, 6, 7, 8][LV];
    const sh = UI.shell('Word Bridge', '🌉', ROUNDS, '', LV);
    UI.open(sh.root);
    AUD.music('game');
    let correct = 0;
    // where the sentences come from: the sentence bank, and from level 3 the tense sentences too
    const bank = ST.sentences(30, LV).filter(s => s.words.length <= MAXW && s.words.length >= (LV >= 3 ? 4 : 3));
    const deck = tenseDeck(ROUNDS, LV, ['past', 'now', 'future']);
    const S = ST.S;
    for (let r = 0; r < ROUNDS; r++) {
      if (!alive(sh.root)) return;
      let s, wrongs = [];
      if (LV >= 3 && (r % 2 === 1 || !bank.length)) {
        const d = deck[r]; s = WB.tenseSentence(d.vb, d.when, d.subj, { timeFirst: Math.random() < 0.5 });
        // wrong verb forms make the best traps
        wrongs = ['past', 'now', 'future'].map(x => WB.form(d.vb, x, d.subj)).filter(x => x !== s.verbForm).flatMap(x => x.split(' ')).filter(x => !s.words.includes(x));
      } else {
        s = bank[r % Math.max(1, bank.length)] || WB.SENTENCES[r];
        const ans = WB.BY[s.words[s.blank].toLowerCase()];
        wrongs = shuffle((ans ? ST.distract(ans, 3).map(o => o.w) : []).concat(SIGHT)).filter(x => !s.words.map(y => y.toLowerCase()).includes(x));
      }
      const words = s.words;
      const lower = LV >= 3; // blocks in small letters: the first word gets its capital when it goes on the bridge
      const blockText = x => lower && x !== 'I' ? x.toLowerCase() : x;
      const pool = shuffle(words.map((w, i) => ({ w, i })).concat(shuffle([...new Set(wrongs)]).slice(0, EXTRA).map(w => ({ w, i: -1 }))));
      if (pool.every((o, i) => o.i === i)) pool.reverse();
      // the bridge
      const planks = words.map(() => h('div', { class: 'word', style: `min-width:${words.length > 6 ? 80 : 96}px;height:60px;padding:0 10px;display:grid;place-items:center;font-size:${words.length > 6 ? 30 : 36}px;background:rgba(26,16,32,.55);box-shadow:inset 0 0 0 3px #ffd262;margin-bottom:6px;transition:all .25s` }, ''));
      const heroImg = SPR.img(SPR.hero(S.hero, S.heroLv[S.hero], 0), 4);
      heroImg.style.cssText += ';position:absolute;bottom:58px;left:0;transition:left .45s cubic-bezier(.3,1.4,.5,1)';
      const goal = icon('🏰', 72);
      const lava = h('div', { style: 'position:relative;display:flex;align-items:flex-end;gap:6px;padding:90px 16px 0 110px;background:linear-gradient(transparent 0 72%,#c4381c 72%,#ff7e26 86%,#ffd262);background-size:100% 100%;box-shadow:inset 0 -4px 0 #6e1614;max-width:100%;flex-wrap:nowrap' },
        h('div', { style: 'position:absolute;left:0;bottom:0;width:100px;height:40px;background:#4b3344;box-shadow:inset 0 4px 0 #6b5552' }), heroImg, ...planks, h('div', { style: 'margin-left:10px;margin-bottom:28px' }, goal));
      let k = 0, miss = 0, resolve; const done = new Promise(r_ => (resolve = r_));
      const moveHero = () => { const p = planks[k - 1]; const box = lava.getBoundingClientRect(), pb = p.getBoundingClientRect(), z = parseFloat(sh.root.style.zoom) || 1; heroImg.style.left = ((pb.left - box.left) / z + pb.width / z / 2 - heroImg.width / 2) + 'px'; };
      const blocks = h('div', { class: 'row', style: 'gap:16px;max-width:980px' }, ...pool.map(o => {
        const b = h('button', { class: 'card word', style: 'font-size:38px;padding:8px 22px 14px' }, blockText(o.w));
        b.onclick = async () => {
          if (k >= words.length) return;
          if (o.w.toLowerCase() === words[k].toLowerCase()) {
            planks[k].textContent = words[k] + (k === words.length - 1 ? '.' : '');
            planks[k].style.cssText += ';background:#a0703c;color:var(--cream);border-bottom:6px solid #5a3a2a;box-shadow:0 0 0 3px var(--ink),inset 0 -6px 0 #7a5030;animation:popIn .3s';
            b.classList.add('dim'); AUD.sfx('hammer'); AUD.sfx('pick', k); AUD.say(words[k]);
            k++; moveHero();
            if (k === words.length) {
              if (!miss) correct++;
              ST.record('build', !miss, 'sentence');
              await wait(600);
              heroImg.style.left = (lava.offsetWidth - 90) + 'px';
              AUD.sfx('win'); FX.burstEl(goal, 40);
              await wait(500); await karaokeSpans(planks, s.text); await wait(500);
              sh.pip(r, miss ? 'miss' : 'on'); resolve();
            }
          } else {
            miss++; b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); AUD.sfx('bad');
            heroImg.style.animation = 'shake .4s'; setTimeout(() => (heroImg.style.animation = ''), 420);
            if (miss >= 3) { const g = [...blocks.children].find((x, i) => pool[i].w.toLowerCase() === words[k].toLowerCase() && !x.classList.contains('dim')); g && g.classList.add('glow'); }
          }
        };
        return b;
      }));
      sh.body.replaceChildren(
        h('div', { class: 'row', style: 'gap:14px' }, h('div', { class: 'word say', 'data-say': 'Build the sentence!', style: 'font-size:30px;color:#c8b8d8' }, 'Build the sentence!'), speakBtn(s.text, true)),
        UI.heLine(EXTRA ? 'בנה את המשפט, מילה אחרי מילה. זהירות: יש מילים מיותרות!' : 'בנה את המשפט, מילה אחרי מילה, כדי לעבור את הלבה.'),
        h('div', { class: 'row', style: 'gap:16px' }, ...s.pics.slice(0, 3).map(p => pic(p, 84))),
        lava, blocks, heHint(s.he));
      await wait(250);
      // the sentence is spoken at the start up to level 4; at level 5 only if you tap the speaker
      if (LV <= 4) AUD.say(s.text); else AUD.say('Build the sentence!');
      await done;
    }
    if (!alive(sh.root)) return;
    UI.results({ correct, total: ROUNDS, gems: correct * 5 + (correct === ROUNDS ? 4 : 0) + LV, items: [ST.dropItem()], again: builder, onClose: backToWorld });
  }

  // ════════════════════════════════════════════════════════════════════
  // PLAY: a session of 5 random games in a row, then a treasure chest
  // ════════════════════════════════════════════════════════════════════
  const LIST = [
    { id: 'abc', name: 'ABC', emoji: '🔠', fn: abc }, { id: 'potion', name: 'Potions', emoji: '🧪', fn: potion },
    { id: 'grid', name: 'Letters', emoji: '🔤', fn: grid }, { id: 'sentence', name: 'Sentences', emoji: '📜', fn: sentence },
    { id: 'spell', name: 'Write', emoji: '✏️', fn: spell },
    { id: 'memory', name: 'Memory', emoji: '🃏', fn: memory }, { id: 'tense', name: 'Time Machine', emoji: '⏳', fn: tense },
    { id: 'when', name: 'When?', emoji: '🕰️', fn: when }, { id: 'builder', name: 'Word Bridge', emoji: '🌉', fn: builder },
  ];
  const BYID = {}; LIST.forEach(g => (BYID[g.id] = g));
  const SESSION = 5;
  function play(id) { UI.curGame = id; BYID[id].fn(); }
  function session() {
    const S = ST.S, last = new Set(S.lastGames || []);
    // weighted draw without repeats: games from last time come up less
    const bag = LIST.map(g => ({ id: g.id, w: (last.has(g.id) ? 0.35 : 1) * (['tense', 'when', 'builder'].includes(g.id) ? 1.3 : 1) }));
    const list = [];
    while (list.length < SESSION) {
      const sum = bag.reduce((a, b) => a + b.w, 0); let x = Math.random() * sum;
      const k = bag.findIndex(b => (x -= b.w) <= 0);
      list.push(bag.splice(k < 0 ? 0 : k, 1)[0].id);
    }
    S.lastGames = list; ST.save();
    UI.session = { list, i: 0, gems: 0, stars: [] };
    spin();
  }
  // a slot machine shows which game comes next
  async function spin() {
    const ss = UI.session; if (!ss) return;
    const g = BYID[ss.list[ss.i]];
    AUD.music('game');
    const dots = h('div', { class: 'row', style: 'gap:12px' }, ...ss.list.map((id, j) => h('div', { style: `width:62px;height:62px;display:grid;place-items:center;box-shadow:0 0 0 4px var(--ink);background:${j < ss.i ? 'var(--mint)' : j === ss.i ? 'var(--gold)' : '#2a1b2e'}` }, j < ss.i ? icon(BYID[id].emoji, 40) : h('span', { style: 'font-family:var(--pix);font-size:34px;color:' + (j === ss.i ? 'var(--ink)' : '#6a4a6e') }, j === ss.i ? '?' : String(j + 1)))));
    const win = h('div', { style: 'width:340px;height:200px;background:var(--cream);box-shadow:0 0 0 6px var(--ink),inset 0 0 0 8px #d8c8b0,0 10px 0 6px rgba(0,0,0,.35);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;overflow:hidden;color:var(--ink)' });
    const show = x => win.replaceChildren(icon(x.emoji, 96), h('div', { class: 'word', style: 'font-size:34px' }, x.name));
    const sc = h('div', { class: 'screen frame narrow', style: 'align-items:center;gap:26px;padding:34px;width:min(760px,94vw)' },
      h('h2', { class: 'say', 'data-say': `Game ${ss.i + 1} of ${SESSION}`, style: 'font-family:var(--pix);font-size:48px;margin:0;color:var(--gold);text-shadow:0 5px 0 var(--ink)' }, `Game ${ss.i + 1} of ${SESSION}`),
      dots, win);
    UI.open(sc);
    const others = LIST.filter(x => x.id !== g.id);
    let d = 60;
    for (let k = 0; k < 12; k++) { show(others[(k * 3 + ss.i) % others.length]); AUD.sfx('tap'); await wait(d); d *= 1.15; if (!document.body.contains(sc)) return; }
    show(g); AUD.sfx('magic'); FX.burstEl(win, 40);
    win.style.animation = 'pulseGood .5s';
    AUD.say(g.name + '!');
    await wait(1100);
    if (!document.body.contains(sc) || UI.session !== ss) return;
    play(g.id);
  }
  function sessionNext(stars, gems) {
    const ss = UI.session; if (!ss) return;
    ss.stars.push(stars); ss.gems += gems; ss.i++;
    if (ss.i < SESSION) spin(); else chest();
  }
  // the treasure chest at the end: you never know what is inside
  async function chest() {
    const ss = UI.session, S = ST.S; UI.session = null;
    S.sessions = (S.sessions || 0) + 1; ST.save();
    const stars = ss.stars.reduce((a, b) => a + b, 0), perfect = ss.stars.every(x => x === 3);
    const box = h('div', { style: 'cursor:pointer;animation:float 1.4s ease-in-out infinite' }, icon('🧰', 170));
    const out = h('div', { class: 'row', style: 'gap:18px;min-height:150px' });
    const tap = h('div', { class: 'word say', 'data-say': 'Tap the chest!', style: 'font-size:34px' }, 'Tap the chest!');
    const btn = h('button', { class: 'btn green hidden', onclick: () => { AUD.sfx('tap'); UI.close(); } }, 'Island');
    const sc = h('div', { class: 'screen frame narrow', style: 'align-items:center;gap:20px;padding:30px;width:min(820px,94vw)' },
      h('h2', { class: 'say', 'data-say': 'You played 5 games!', style: 'font-family:var(--pix);font-size:50px;margin:0;color:var(--gold);text-shadow:0 5px 0 var(--ink)' }, 'You played 5 games!'),
      h('div', { class: 'row', style: 'gap:8px' }, ...ss.stars.map(n => h('div', { class: 'row', style: 'gap:0;background:#2a1b2e;padding:4px 8px;box-shadow:0 0 0 3px var(--ink)' }, ...[0, 1, 2].map(j => SPR.img(SPR.glyph('star', j < n ? '#ffffff' : '#555'), 3)).map((e, j) => { if (j >= n) e.style.filter = 'grayscale(1) brightness(.4)'; return e; })))),
      box, tap, out, btn);
    UI.open(sc);
    AUD.sfx('win'); AUD.say('You played 5 games! Tap the chest!');
    box.onclick = async () => {
      box.onclick = null; tap.textContent = '';
      box.style.animation = 'shake .3s 4'; AUD.sfx('pop'); await wait(400); AUD.sfx('pop'); await wait(400); AUD.sfx('pop'); await wait(400);
      AUD.sfx('hatch'); FX.burstEl(box, 90); FX.confetti(120);
      box.replaceChildren(icon('✨', 120)); box.style.animation = '';
      const luck = perfect ? 0.12 : stars >= 12 ? 0.05 : 0;
      const prizes = [];
      const bonus = 6 + stars * 2 + (perfect ? 15 : 0);
      prizes.push({ gems: bonus });
      prizes.push({ item: ST.dropItem(luck) });
      const r = Math.random();
      if (perfect && r < 0.5) prizes.push({ item: rand(['crystal', 'rainbow', 'comet', 'eggGold']) });
      else if (r < 0.35) prizes.push({ decor: 'gift' });
      else if (r < 0.6) prizes.push({ item: rand(['eggFox', 'eggCat', 'eggDragon']) });
      for (const p of prizes) {
        let el;
        if (p.gems) { el = h('div', { class: 'reward frame' }, icon('💎', 48), h('span', null, '+' + p.gems)); out.append(el); UI.addGems(p.gems, el); }
        else if (p.item) { S.items[p.item] = (S.items[p.item] || 0) + 1; el = UI.itemCard(p.item, true); out.append(el); if (ST.ITEMS[p.item].rare) { el.style.background = '#fff0b0'; UI.toast('Rare: ' + ST.ITEMS[p.item].word + '!', '✨'); } }
        else if (p.decor) { S.bag = S.bag || {}; S.bag[p.decor] = (S.bag[p.decor] || 0) + 1; el = h('div', { class: 'card say', 'data-say': 'a gift', style: 'padding:10px 14px;animation:popIn .5s' }, icon('🎁', 56), h('div', { class: 'word', style: 'font-size:22px' }, 'gift')); out.append(el); }
        AUD.sfx('coin'); await wait(450);
      }
      ST.save(); UI.updateBadges();
      AUD.say(perfect ? 'Wow! All stars! A rare prize!' : 'Look what you got!');
      btn.classList.remove('hidden');
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // PAINT A CASTLE — roof, walls and flag in colour words
  // ════════════════════════════════════════════════════════════════════
  function paint(kind, i) {
    const S = ST.S, st = kind === 'isle' ? S.styles.isles[i] : S.styles.castles[i];
    const level = () => kind === 'isle' ? S.isles[i].castle : S.castles[i];
    const prev = h('div', { style: 'min-width:220px;display:grid;place-items:center' });
    const draw = () => { const c = WORLD.castleSprite(Math.max(2, level()), st, 0), im = SPR.img(c, 7); prev.replaceChildren(im); };
    const msg = h('div', { class: 'word', style: 'font-size:30px;min-height:40px;color:var(--gold)' });
    const row = (part, label, colors) => h('div', { class: 'row', style: 'gap:10px;justify-content:flex-start;flex-wrap:wrap' },
      h('div', { class: 'word say', 'data-say': label, style: 'font-size:26px;min-width:90px' }, label),
      ...Object.keys(colors).map(name => {
        const col = Array.isArray(colors[name]) ? colors[name][0] : colors[name];
        const b = h('button', { title: name, style: `width:52px;height:52px;background:${col};box-shadow:0 0 0 4px var(--ink)${st[part] === name ? ',0 0 0 8px var(--gold)' : ''}` });
        b.onclick = () => { st[part] = name; ST.save(); AUD.sfx('pick', 3); const line = `The ${label.toLowerCase()} is ${name}!`; msg.textContent = line; AUD.say(line); draw(); refreshRows(); };
        return b;
      }));
    const rows = h('div', { class: 'col', style: 'gap:16px;align-items:flex-start' });
    const refreshRows = () => rows.replaceChildren(row('roof', 'Roof', ST.COLORS), row('wall', 'Walls', ST.WALLS), row('flag', 'Flag', ST.COLORS));
    refreshRows(); draw();
    const sc = h('div', { class: 'screen frame', style: 'height:auto' },
      h('div', { class: 'sh' }, icon('🎨', 52), h('h2', { class: 'say', 'data-say': 'Paint your castle!' }, 'Paint your castle!'), h('button', { class: 'close', onclick: () => { AUD.sfx('tap'); UI.close(); } }, '×')),
      UI.heLine('בחר צבע לגג, לקירות ולדגל. לחץ על המילה כדי לשמוע אותה.'),
      h('div', { class: 'row', style: 'gap:40px;padding:14px 0;flex-wrap:nowrap' }, prev, rows), msg,
      h('div', { class: 'row' }, h('button', { class: 'btn green', onclick: () => { AUD.sfx('tap'); UI.close(); } }, 'Done!')));
    UI.open(sc);
    AUD.say('Paint your castle!');
  }

  // ════════════════════════════════════════════════════════════════════
  // DECORATE — buy things for the island and put them anywhere
  // ════════════════════════════════════════════════════════════════════
  function decorate() {
    const S = ST.S; S.bag = S.bag || {};
    const D = ST.DECOR;
    const unlocked = k => (D[k].cost || 0) <= 12 || ST.progress() >= (D[k].cost || 0) * 0.8;
    const card = (k, free) => {
      const it = D[k], can = free || (unlocked(k) && S.gems >= it.cost), lock = !free && !unlocked(k);
      const c = h('div', { class: 'card' + (can ? '' : ' dim'), style: 'width:132px;height:150px;gap:2px;padding:6px' + (it.gift ? ';background:#ffe4f0' : '') },
        icon(lock ? '🔒' : it.pic, 60), h('div', { class: 'word', style: `font-size:${it.word.length > 9 ? 16 : 20}px;text-align:center;line-height:1` }, lock ? '?' : it.word),
        free ? h('div', { style: 'font-family:var(--pix);font-size:20px;color:#3f8a56' }, '×' + S.bag[k]) : h('div', { style: 'display:flex;align-items:center;gap:3px;font-family:var(--pix);font-size:20px' }, icon('💎', 20), String(it.cost)));
      if (lock) c.style.opacity = '.5';
      c.onclick = () => {
        AUD.say(lock ? 'Fix more of the island first!' : it.word);
        if (!can) return;
        if (!free && !UI.spend(it.cost)) return;
        if (free) { S.bag[k]--; if (!S.bag[k]) delete S.bag[k]; ST.save(); }
        UI.close();
        placeOnMap(k, () => { if (free) { S.bag[k] = (S.bag[k] || 0) + 1; } else { S.gems += it.cost; UI.updateHud(true); } ST.save(); });
      };
      return c;
    };
    const shopKeys = Object.keys(D).filter(k => !D[k].rare);
    const bagKeys = Object.keys(S.bag).filter(k => S.bag[k] > 0 && D[k]);
    const sc = h('div', { class: 'screen frame' },
      h('div', { class: 'sh' }, icon('🏡', 52), h('h2', { class: 'say', 'data-say': 'Decorate your island!' }, 'Decorate your island!'),
        h('button', { class: 'btn small blue', onclick: () => { UI.close(); moveMode(); } }, icon('✋', 26), 'Move'),
        h('button', { class: 'close', onclick: () => { AUD.sfx('tap'); UI.close(); } }, '×')),
      UI.heLine('קנה קישוט ושים אותו באי. מתנה 🎁 = הפתעה! אולי משהו נדיר...'),
      h('div', { style: 'flex:1;overflow:auto;padding:8px 4px' },
        bagKeys.length ? h('div', null, h('div', { style: 'font-family:var(--pix);font-size:26px;color:var(--gold);margin:4px 0 8px' }, 'Your bag'), h('div', { class: 'row', style: 'gap:14px;justify-content:flex-start' }, ...bagKeys.map(k => card(k, true)))) : null,
        h('div', { style: 'font-family:var(--pix);font-size:26px;color:var(--gold);margin:14px 0 8px' }, 'Shop'),
        h('div', { class: 'row', style: 'gap:14px;justify-content:flex-start' }, ...shopKeys.map(k => card(k, false)))));
    UI.open(sc);
    AUD.say('Decorate your island!');
  }
  // put a decoration on the map: a bar at the top says what to do
  function placeOnMap(k, onCancel, moving) {
    const S = ST.S, it = ST.DECOR[k];
    const text = 'Tap the island to put the ' + it.word + '!';
    UI.placeBar(text, 'הקש על האי כדי לשים את הקישוט', () => { WORLD.stopPlace(); onCancel && onCancel(); WORLD.rebuild(); WORLD.syncCreatures(); },
      moving !== undefined ? () => { WORLD.stopPlace(); const d = S.decor.splice(moving, 1)[0]; S.bag = S.bag || {}; S.bag[d.k] = (S.bag[d.k] || 0) + 1; ST.save(); WORLD.rebuild(); WORLD.syncCreatures(); UI.placeBar(null); UI.toast('In your bag!', '👜'); } : null);
    AUD.say(text);
    WORLD.startPlace(k, (x, y, isle) => {
      if (moving !== undefined) { Object.assign(S.decor[moving], { x, y, isle }); }
      else S.decor.push({ k, x, y, isle });
      ST.save(); UI.placeBar(null);
      WORLD.rebuild(); WORLD.syncCreatures();
      WORLD.burst(x, y - 6, 30, ['#ffd262', '#ffffff', '#3fd08a', '#ff8ccf'], 30);
      AUD.sfx('magic');
      AUD.say(it.gift ? 'Tap the gift to open it!' : (/^[aeiou]/i.test(it.word) ? 'An ' : 'A ') + it.word + '!');
      if (it.gift) UI.toast('Tap the gift to open it!', '🎁', false);
      GAME.afterGame();
    }, moving);
  }
  function moveMode() {
    const S = ST.S;
    if (!S.decor.length) { UI.toast('Buy something first!', '🏡'); return; }
    UI.moving = true;
    UI.placeBar('Tap a thing to move it.', 'הקש על קישוט כדי להזיז אותו', () => { UI.moving = false; });
    AUD.say('Tap a thing to move it.');
  }
  function pickToMove(i) {
    UI.moving = false;
    const d = ST.S.decor[i];
    placeOnMap(d.k, null, i);
  }
  // open a gift on the map: what will it be?
  function openGiftAt(i) {
    const S = ST.S, d = S.decor[i];
    const g = ST.openGift();
    WORLD.burst(d.x, d.y - 8, 70, ['#ff8ccf', '#ffd262', '#ffffff', '#6fe3ff', '#3fd08a'], 50);
    AUD.sfx('hatch');
    if (g.decor) { d.k = g.decor; const it = ST.DECOR[g.decor]; const line = 'It is ' + (/^[aeiou]/i.test(it.word) ? 'an ' : 'a ') + it.word + '!'; UI.toast((g.rare ? 'Rare! ' : '') + line, it.pic, false); AUD.say((g.rare ? 'Wow! ' : '') + line); if (g.rare) FX.confetti(120); }
    else {
      S.decor.splice(i, 1);
      if (g.gems) { const [sx, sy] = WORLD.toScreen(d.x, d.y - 8); UI.addGems(g.gems, [sx, sy]); UI.toast(g.gems + ' gems!', '💎'); }
      else { S.items[g.item] = (S.items[g.item] || 0) + 1; const it = ST.ITEMS[g.item]; UI.toast((g.rare ? 'Rare! ' : '') + 'You got ' + (/^[aeiou]/i.test(it.word) ? 'an ' : 'a ') + it.word + '!', it.pic || '🥚'); if (g.rare) FX.confetti(120); UI.updateBadges(); }
    }
    ST.save(); WORLD.rebuild(); WORLD.syncCreatures();
  }

  function backToWorld() { AUD.music('world'); UI.updateHud(); UI.updateBadges(); window.GAME && GAME.afterGame && GAME.afterGame(); }

  window.GAMES = { abc, potion, grid, sentence, speak, spell, memory, tense, when, builder, hatch, camp, possibleMixes, backToWorld, LIST, play, session, sessionNext, paint, decorate, pickToMove, openGiftAt, moveMode };
})();
