// Dragon battle: answer English questions, every right answer is a hit on the dragon.
(function () {
  const { h, icon, pic, wait, speakBtn } = UI;
  const rand = a => a[Math.floor(Math.random() * a.length)];
  const AW = 240, AH = 112;
  const LAVA = ['#6e1614', '#98241a', '#c4381c', '#e8561e', '#ff7e26', '#ffa838', '#ffd262', '#ffa838', '#ff7e26', '#e8561e', '#c4381c', '#98241a'];
  const BOSS_PAL = {
    leaf: { body: '#4a8a3a', belly: '#e8d08a', bellyLine: '#c8a860', dark: '#2f5a2a', wing: '#8a3a3a', spike: '#ffd23a', horn: '#f4f1ea', snout: '#6aa84a' },
    shadow: { body: '#4a3a6a', belly: '#9a86c8', bellyLine: '#7a66a8', dark: '#2a1f4a', wing: '#6a2a5a', spike: '#ff7ad9', horn: '#e8e4ff', snout: '#5a4a7a' },
    lava: { body: '#b02e18', belly: '#ffd262', bellyLine: '#e8a030', dark: '#6e1614', wing: '#4a1a1a', spike: '#fff0a8', horn: '#2b1d2a', snout: '#c4481c' },
    gold: { body: '#2b1d2a', belly: '#ffd23a', bellyLine: '#c98a1c', dark: '#120a14', wing: '#8a1a2a', spike: '#ffd23a', horn: '#ffd23a', snout: '#402b40' },
  };
  const power = l => 1 + (l >= 3 ? 1 : 0) + (l >= 5 ? 1 : 0);

  function arena(isle, scale) {
    const c = SPR.cv(AW, AH), x = c.getContext('2d');
    c.className = 'px'; c.style.height = AH * scale + 'px'; c.style.width = 'auto'; c.style.maxWidth = '100%';
    const S = ST.S, pal = BOSS_PAL[isle.boss.elem];
    const st = { heroX: 44, bossX: 150, bossY: 30, hurt: 0, breath: 0, shake: 0, shots: [], parts: [], nums: [], dead: 0, heroDash: 0, shield: 0, heroHurt: 0, heroDown: 0, charge: 0 };
    // static backdrop: sky bands, far volcano silhouettes, rock platform
    const bg = SPR.cv(AW, AH), b = bg.getContext('2d');
    const bands = ['#1a0e24', '#24122c', '#321632', '#441a34', '#5a2034', '#6e2a30'];
    bands.forEach((col, i) => { b.fillStyle = col; b.fillRect(0, i * 11, AW, 11); });
    for (let i = 0; i < 40; i++) { b.fillStyle = i % 3 ? '#ffffff55' : '#ffd26288'; b.fillRect((i * 97) % AW, (i * 53) % 40, 1, 1); }
    b.fillStyle = '#2a1624';
    [[30, 50, 40], [120, 42, 55], [205, 52, 36]].forEach(([cx, top, w]) => { for (let y = top; y < 80; y++) { const hw = (y - top) * w / 40; b.fillRect(Math.round(cx - hw), y, Math.round(hw * 2), 1); } });
    b.fillStyle = '#ff7e26'; b.fillRect(119, 42, 3, 1); b.fillRect(29, 50, 3, 1);
    b.fillStyle = '#1f1522'; b.fillRect(0, 80, AW, 32);
    const rock = new SPR.Raster(AW, 20);
    for (let xx = 0; xx < AW; xx++) { const top = 3 + Math.round(Math.sin(xx * 0.08) * 1.5 + Math.sin(xx * 0.31) * 1); for (let y = top; y < 12; y++) rock.set(xx, y, y === top ? '#6b5552' : ((xx * 7 + y * 13) % 11 === 0 ? '#57433f' : '#463438')); }
    b.drawImage(rock.canvas(), 0, 74);
    function frame(now) {
      if (!document.body.contains(c)) return;
      const t = now / 1000;
      x.save();
      if (st.shake > 0) { st.shake -= 1 / 60; x.translate(Math.round((Math.random() - .5) * 4), Math.round((Math.random() - .5) * 3)); }
      x.drawImage(bg, 0, 0);
      // lava sea at the bottom
      const step = (t * 8) | 0;
      for (let xx = 0; xx < AW; xx++) for (let y = 88; y < AH; y++) { x.fillStyle = LAVA[(((xx >> 2) + (y >> 1) * 3 - step) % 12 + 12) % 12]; if ((xx + y) % 2 === 0 || y > 92) x.fillRect(xx, y, 1, 1); }
      if (Math.random() < .5) st.parts.push({ x: Math.random() * AW, y: 90, vx: 0, vy: -10 - Math.random() * 14, l: 1.5, col: '#ffa838' });
      // hero
      const lv = S.heroLv[S.hero], hf = (t * 4 | 0) % 2;
      const hx = st.heroX + Math.round(Math.sin(Math.min(1, st.heroDash) * Math.PI) * 40);
      if (st.heroDash > 0) st.heroDash = Math.max(0, st.heroDash - 1 / 60 * 2.5);
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(hx + 3, 79, 14, 2);
      if (st.heroHurt > 0) st.heroHurt -= 1 / 60;
      const hs = SPR.hero(S.hero, lv, st.heroDash > 0 ? hf : 0);
      if (st.heroDown > 0) { // knocked over
        st.heroDown = Math.min(1, st.heroDown + 1 / 60 * 2);
        x.save(); x.translate(hx + 10, 80); x.rotate(-st.heroDown * 1.5); x.globalAlpha = 1 - st.heroDown * .3; x.drawImage(hs, -10, -24); x.restore();
      } else if (!(st.heroHurt > 0 && ((t * 16) | 0) % 2)) x.drawImage(hs, hx - (st.heroHurt > 0 ? 2 : 0), 56 + (Math.sin(t * 3) > .5 ? -1 : 0));
      // the dragon charging its fire breath: a glowing ball growing in its mouth
      if (st.charge > 0 && st.dead === 0) { const r = 1 + Math.round(st.charge * 4), cx = st.bossX + 18, cy = st.bossY + 18 + Math.round(Math.sin(t * 2.2) * 3); x.fillStyle = st.charge > .75 && ((t * 10) | 0) % 2 ? '#ffffff' : '#ff7e26'; x.fillRect(cx - r, cy - r, r * 2, r * 2); x.fillStyle = '#ffd262'; x.fillRect(cx - (r >> 1), cy - (r >> 1), Math.max(1, r), Math.max(1, r)); }
      if (st.shield > 0) { st.shield -= 1 / 60; x.fillStyle = `rgba(111,227,255,${Math.min(.6, st.shield)})`; for (let a = 0; a < 6.28; a += 0.12) x.fillRect(Math.round(hx + 10 + Math.cos(a) * 15), Math.round(68 + Math.sin(a) * 15), 1, 1); }
      // boss
      if (st.dead < 1) {
        const bob = Math.round(Math.sin(t * 2.2) * 3), fr = st.breath > 0 ? 2 : (t * 3 | 0) % 2;
        const bs = SPR.boss(pal, fr, st.hurt > 0 && ((t * 20) | 0) % 2);
        if (st.hurt > 0) st.hurt -= 1 / 60;
        x.save();
        const bx = st.bossX + (st.hurt > 0 ? 3 : 0), by = st.bossY + bob - st.dead * 90;
        if (st.dead > 0) { st.dead += 1 / 60 * 0.6; x.translate(bx + 22, by + 19); x.rotate(st.dead * 8); x.scale(1 - st.dead * .8, 1 - st.dead * .8); x.translate(-22, -19); x.drawImage(bs, 0, 0); }
        else { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(st.bossX + 10, 79, 26, 2); x.drawImage(bs, bx, by); }
        x.restore();
        if (st.breath > 0) {
          st.breath -= 1 / 60;
          for (let k = 0; k < 4; k++) st.parts.push({ x: st.bossX + 18, y: st.bossY + 18 + bob, vx: -90 - Math.random() * 40, vy: (Math.random() - .3) * 30, l: .7, col: rand(['#fff0a8', '#ffd262', '#ff7e26', '#c4381c']) });
        }
      }
      // shots
      st.shots = st.shots.filter(s => {
        s.t += 1 / 60 / s.dur;
        const px = s.x0 + (s.x1 - s.x0) * s.t, py = s.y0 + (s.y1 - s.y0) * s.t - Math.sin(s.t * Math.PI) * 14;
        for (let k = 0; k < 3; k++) st.parts.push({ x: px, y: py, vx: (Math.random() - .5) * 10, vy: (Math.random() - .5) * 10, l: .3, col: rand(s.cols) });
        x.fillStyle = s.cols[0]; x.fillRect(Math.round(px) - 2, Math.round(py) - 2, 4, 4);
        x.fillStyle = '#ffffff'; x.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
        if (s.t >= 1) { s.hit && s.hit(); return false; }
        return true;
      });
      // particles
      st.parts = st.parts.filter(p => { p.l -= 1 / 60; p.x += p.vx / 60; p.y += p.vy / 60; if (p.l <= 0) return false; x.fillStyle = p.col; x.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); return true; });
      // damage numbers
      x.font = 'bold 10px monospace'; x.textAlign = 'center';
      st.nums = st.nums.filter(n => { n.l -= 1 / 60; n.y -= 0.4; if (n.l <= 0) return false; x.fillStyle = '#1a1020'; x.fillText(n.txt, n.x + 1, n.y + 1); x.fillStyle = n.col || '#ffd23a'; x.fillText(n.txt, n.x, n.y); return true; });
      x.restore();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    const shotCols = { fox: ['#ffffff', '#dfe8f5', '#9ae8f0'], cat: ['#6fe3ff', '#b98bff', '#ffffff'], dragon: ['#ff7e26', '#ffd262', '#fff0a8'] };
    return {
      el: c, st,
      attack(dmg) {
        return new Promise(res => {
          st.heroDash = 1; AUD.sfx('whoosh');
          setTimeout(() => {
            st.shots.push({ x0: st.heroX + 16, y0: 64, x1: st.bossX + 20, y1: st.bossY + 20, t: 0, dur: .35, cols: shotCols[S.hero], hit: () => {
              st.hurt = .5; st.shake = .25; AUD.sfx('boom');
              for (let k = 0; k < 30; k++) { const a = Math.random() * 6.28, s = 20 + Math.random() * 50; st.parts.push({ x: st.bossX + 22, y: st.bossY + 20, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: .6, col: rand(shotCols[S.hero]) }); }
              st.nums.push({ x: st.bossX + 22, y: st.bossY, txt: '-' + dmg, l: 1 });
              res();
            } });
            AUD.sfx('magic');
          }, 200);
        });
      },
      roar() {
        return new Promise(res => { AUD.sfx('roar'); st.breath = .8; setTimeout(() => { st.shield = 1; st.shake = .4; }, 350); setTimeout(res, 900); });
      },
      // fire breath that reaches the hero: hurts
      burn() {
        return new Promise(res => {
          AUD.sfx('roar'); st.breath = .9; st.charge = 0;
          setTimeout(() => {
            st.heroHurt = .8; st.shake = .5; AUD.sfx('boom');
            for (let k = 0; k < 24; k++) st.parts.push({ x: st.heroX + 10, y: 66, vx: (Math.random() - .5) * 60, vy: -Math.random() * 40, l: .6, col: rand(['#fff0a8', '#ffd262', '#ff7e26']) });
            st.nums.push({ x: st.heroX + 10, y: 52, txt: '-1', l: 1, col: '#ff6a6a' });
          }, 380);
          setTimeout(res, 1000);
        });
      },
      fall() { st.heroDown = 0.01; AUD.sfx('bad'); },
      die() { st.dead = 0.01; AUD.sfx('roar'); },
    };
  }

  // hearts: how many fire hits the hero can take
  const hearts = l => 4 + Math.floor((l - 1) / 2);

  async function battle(i, onWin) {
    UI.curGame = null;
    const W_after = () => { WORLD.refresh(); UI.updateHud(); onWin && onWin(); };
    const S = ST.S, isle = WORLD.ISLES[i], boss = isle.boss, lv = S.heroLv[S.hero], dmg = power(lv);
    let hp = boss.hp, life = hearts(lv);
    const maxLife = life, L = Math.min(5, 2 + i);
    AUD.music('battle');
    const sc = h('div', { class: 'screen frame', style: 'padding:14px 20px 18px;gap:8px' });
    const A = arena(isle, 3.4);
    const hpFill = h('div', { style: 'position:absolute;left:3px;top:3px;bottom:3px;background:linear-gradient(#ff8a8a 0 40%,#e0383a 40%);transition:width .4s;width:calc(100% - 6px)' });
    const hpBar = h('div', { style: 'flex:1;height:26px;background:var(--ink);position:relative;box-shadow:inset 0 0 0 3px #120a14' }, hpFill);
    const heartRow = h('div', { class: 'row', style: 'gap:2px;flex-wrap:nowrap' });
    const drawHearts = () => heartRow.replaceChildren(...Array.from({ length: maxLife }, (_, k) => { const e = icon(k < life ? '❤️' : '🖤', 30); if (k >= life) e.style.opacity = '.45'; return e; }));
    drawHearts();
    // the fire timer: when it runs out, the dragon breathes fire at the hero
    const fuseFill = h('div', { style: 'position:absolute;left:3px;top:3px;bottom:3px;width:calc(100% - 6px);background:linear-gradient(#ffd262 0 40%,#ff7e26 40%)' });
    const fuse = h('div', { style: 'width:min(560px,80%);height:18px;background:var(--ink);position:relative;box-shadow:inset 0 0 0 3px #120a14;visibility:hidden' }, fuseFill);
    const fuseRow = h('div', { class: 'row', style: 'gap:10px;flex-wrap:nowrap;width:100%' }, icon('🔥', 30), fuse);
    const qBox = h('div', { class: 'col', style: 'gap:14px;flex:1;justify-content:center' });
    const close = h('button', { class: 'close', onclick: () => { AUD.sfx('tap'); stopFuse(); UI.close(); } }, '×');
    sc.append(
      h('div', { class: 'row', style: 'gap:16px;flex-wrap:nowrap;width:100%' }, heartRow, h('h2', { class: 'say', 'data-say': boss.name, style: 'font-family:var(--pix);font-size:32px;margin:0;color:#ff8a8a;text-shadow:0 4px 0 var(--ink);white-space:nowrap' }, boss.name), hpBar, close),
      h('div', { style: 'display:flex;justify-content:center' }, A.el), fuseRow, qBox);
    UI.open(sc);
    const alive = () => document.body.contains(sc);
    const say = t => AUD.say(t);
    let fuseRaf = 0, fuseEnd = null;
    function startFuse(sec, onEnd) {
      stopFuse();
      const t0 = performance.now(), dur = sec * 1000;
      fuse.style.visibility = 'visible'; fuseEnd = onEnd;
      const tick = now => {
        if (!alive()) return;
        const k = Math.max(0, 1 - (now - t0) / dur);
        fuseFill.style.width = `calc(${k * 100}% - ${6 * k}px)`;
        fuseFill.style.background = k < 0.3 && ((now / 150) | 0) % 2 ? '#ffffff' : 'linear-gradient(#ffd262 0 40%,#ff7e26 40%)';
        A.st.charge = 1 - k;
        if (k <= 0) { const f = fuseEnd; stopFuse(); f && f(); return; }
        fuseRaf = requestAnimationFrame(tick);
      };
      fuseRaf = requestAnimationFrame(tick);
    }
    function stopFuse() { cancelAnimationFrame(fuseRaf); fuseEnd = null; A.st.charge = 0; fuse.style.visibility = 'hidden'; }

    const intro = `I am ${boss.name}! This is my island!`;
    qBox.replaceChildren(h('div', { class: 'row' }, h('div', { class: 'word say', 'data-say': intro, style: 'font-size:40px' }, intro), speakBtn(intro)),
      UI.heLine('תשובה נכונה = מכה בדרקון. תשובה לא נכונה, או איטית מדי = הדרקון יורק עליך אש!'));
    AUD.sfx('roar'); await wait(300); await say(intro);
    await wait(900);
    let correct = 0, total = 0, again = [];
    const types = ['listen', 'read', 'pic2word'];
    if (i >= 1) types.push('missing', 'sentence');
    if (i >= 2) types.push('tense');
    if (i >= 3) types.push('tense', 'missing');
    ST.shuffle(types);
    let qi = 0;
    while (hp > 0 && life > 0 && alive()) {
      const type = types[qi++ % types.length];
      const word = again.length && Math.random() < 0.5 ? again.shift() : ST.pick(1, o => type !== 'missing' || /^[a-z]{3,7}$/.test(o.w), L)[0];
      const res = await ask(type, word);
      if (!alive()) return;
      total++;
      if (res === true) {
        correct++;
        await A.attack(dmg);
        hp = Math.max(0, hp - dmg);
        hpFill.style.width = `calc(${hp / boss.hp * 100}% - ${6 * hp / boss.hp}px)`;
      } else {
        if (word) again.push(word);
        if (res === 'slow') { qBox.replaceChildren(h('div', { class: 'word say', 'data-say': 'Too slow!', style: 'font-size:46px;color:#ff8a8a' }, 'Too slow!')); AUD.say('Too slow!'); }
        await A.burn();
        life--; drawHearts();
        heartRow.style.animation = 'shake .4s'; setTimeout(() => (heartRow.style.animation = ''), 450);
      }
      await wait(350);
    }
    if (!alive()) return;
    stopFuse();
    if (life <= 0) {
      // lost: the dragon keeps its island for now
      A.fall();
      S.isles[i].tries = (S.isles[i].tries || 0) + 1; ST.save();
      const line = `Oh no! ${boss.name} is too strong. Try again!`;
      qBox.replaceChildren(
        h('div', { class: 'row' }, h('div', { class: 'word say', 'data-say': line, style: 'font-size:40px;color:#ff8a8a;text-align:center' }, line), speakBtn(line)),
        UI.heLine('נסה שוב! אפשר גם לשחק עוד משחקים ולחזק את הגיבור (Hero).'),
        h('div', { class: 'row' },
          h('button', { class: 'btn green', onclick: () => { AUD.sfx('tap'); battle(i, onWin); } }, 'Try again'),
          h('button', { class: 'btn blue', onclick: () => { AUD.sfx('tap'); UI.close(); } }, 'Island')));
      await wait(600); AUD.say(line);
      if (correct) UI.addGems(correct, qBox);
      return;
    }
    A.die();
    qBox.replaceChildren(h('div', { class: 'word', style: 'font-size:48px;color:var(--gold);text-shadow:0 4px 0 var(--ink)' }, 'You won!'));
    AUD.say(`You won! ${boss.name} flies away!`);
    S.isles[i].won = true; ST.save();   // saved at once, even if the window is closed during the celebration
    await wait(2200);
    AUD.sfx('win'); FX.confetti(200);
    if (!alive()) { W_after(); return; }
    // every dragon guards one rare thing the first time
    const rare = ['sun', 'comet', 'crystal', 'eggGold'][i];
    const items = [i === 0 ? 'eggDragon' : i === 1 ? 'crown' : i === 2 ? 'eggDragon' : 'crown', i === 3 ? 'eggCat' : 'eggFox'];
    if (!S.boss[i]) { S.boss[i] = 1; items.unshift(rare); }
    UI.results({ correct, total, gems: 30 + i * 15 + life * 3, items, onClose: () => { GAMES.backToWorld(); onWin && onWin(); } });

    // ── one question: resolves true (right), false (wrong) or 'slow' (fire timer ran out) ──
    function ask(type, w) {
      return new Promise(async resolve => {
        let first = true, done = false;
        const T = boss.time + (type === 'sentence' || type === 'tense' ? 6 : 0);
        const go = () => { if (!done) startFuse(T, () => { if (done) return; done = true; lock(); ST.record(w ? w.w : 'tense', false, 'read'); resolve('slow'); }); };
        const finish = async (ok, el) => {
          if (done) return; done = true; stopFuse();
          if (w) ST.record(w.w, ok && first, type === 'listen' ? 'listen' : type === 'missing' ? 'spell' : 'read');
          if (ok) { el && el.classList.add('good'); AUD.sfx('good'); if (el) FX.burstEl(el, 20); await wait(450); resolve(first); }
        };
        const wrong = async (el, rightEl, text) => {
          if (done) return; done = true; stopFuse();
          first = false;
          el.classList.remove('bad'); void el.offsetWidth; el.classList.add('bad'); AUD.sfx('bad');
          rightEl.classList.add('glow');
          await wait(300); AUD.say(text);
          if (w) ST.record(w.w, false, type === 'listen' ? 'listen' : 'read');
          await wait(1300);
          resolve(false);
        };
        const lock = () => [...qBox.querySelectorAll('.card')].forEach(c => (c.style.pointerEvents = 'none'));
        const nOpt = i >= 2 ? 4 : 3;
        if (type === 'listen' || type === 'read') {
          const opts = ST.shuffle([w, ...ST.distract(w, i >= 2 ? 4 : 3)]);
          const cards = opts.map(o => h('div', { class: 'card', style: 'width:120px;height:112px' }, pic(o.pic, 80)));
          cards.forEach((c, k) => c.onclick = () => { lock(); if (opts[k] === w) finish(true, c); else wrong(c, cards[opts.indexOf(w)], `This is ${w.w}.`); });
          const top = type === 'listen'
            ? h('div', { class: 'row', style: 'gap:14px' }, h('div', { class: 'word say', 'data-say': 'Listen! Which one?', style: 'font-size:32px' }, 'Listen! Which one?'), speakBtn(w.w, true))
            : h('div', { class: 'row', style: 'gap:14px' }, h('div', { class: 'word', style: 'font-size:30px;color:#c8b8d8' }, 'Find:'), h('div', { class: 'word', style: 'font-size:64px' }, w.w));
          qBox.replaceChildren(top, h('div', { class: 'row', style: 'gap:16px' }, ...cards));
          if (type === 'listen') { await wait(200); await AUD.say(w.w); }
          go();
        } else if (type === 'pic2word') {
          const opts = ST.shuffle([w, ...ST.distract(w, nOpt - 1)]);
          const btns = opts.map(o => h('button', { class: 'card word', style: 'font-size:42px;padding:8px 26px 14px' }, o.w));
          btns.forEach((b, k) => b.onclick = () => { lock(); if (opts[k] === w) { AUD.say(w.w); finish(true, b); } else wrong(b, btns[opts.indexOf(w)], `This is ${w.w}.`); });
          qBox.replaceChildren(h('div', { class: 'row', style: 'gap:26px' }, h('div', { class: 'card', style: 'padding:8px 14px;cursor:default' }, pic(w.pic, 100)), h('div', { class: 'word say', 'data-say': 'What is it?', style: 'font-size:32px' }, 'What is it?')), h('div', { class: 'row', style: 'gap:16px' }, ...btns));
          go();
        } else if (type === 'missing') {
          const k = Math.floor(Math.random() * w.w.length), ch = w.w[k];
          const pool = 'aeioubcdfghlmnprst'.split('').filter(c => c !== ch);
          const opts = ST.shuffle([ch, ...ST.shuffle(pool).slice(0, nOpt - 1)]);
          const shown = w.w.split('').map((c, j) => h('span', { style: j === k ? 'color:var(--gold);border-bottom:6px solid var(--gold);min-width:44px;display:inline-block;text-align:center' : '' }, j === k ? '?' : c));
          const btns = opts.map(o => h('button', { class: 'card word', style: 'font-size:52px;width:96px;height:96px;padding:0' }, o));
          btns.forEach((b, j) => b.onclick = () => { lock(); if (opts[j] === ch) { shown[k].textContent = ch; AUD.say(w.w); finish(true, b); } else { shown[k].textContent = ch; wrong(b, btns[opts.indexOf(ch)], w.w); } });
          qBox.replaceChildren(h('div', { class: 'row', style: 'gap:26px' }, h('div', { class: 'card', style: 'padding:8px 14px;cursor:default' }, pic(w.pic, 100)), h('div', { class: 'word', style: 'font-size:72px;letter-spacing:4px' }, ...shown), speakBtn(w.w)), h('div', { class: 'row', style: 'gap:18px' }, ...btns));
          go();
        } else if (type === 'tense') {
          // "Yesterday the cat ___." → jumped / jumps / will jump
          const when = rand(['past', 'now', 'future']), vb = rand(WB.VERBS.filter(v => i >= 3 || v.regular)), subj = rand(WB.SUBJECTS);
          const s = WB.tenseSentence(vb, when, subj);
          w = null;
          const forms = [...new Set(['past', 'now', 'future'].map(x => WB.form(vb, x, subj)))];
          const ans = s.verbForm, opts = ST.shuffle(forms);
          const line = s.words.map((x, j) => j === s.verbAt ? '___' : (j > s.verbAt && j < s.verbAt + s.verbLen) ? null : x).filter(Boolean).join(' ') + '.';
          const btns = opts.map(o => h('button', { class: 'card word', style: 'font-size:38px;padding:8px 24px 14px' }, o));
          btns.forEach((b, j) => b.onclick = () => { lock(); ST.record('tense-' + when, opts[j] === ans, 'tense'); if (opts[j] === ans) { AUD.say(s.text); finish(true, b); } else wrong(b, btns[opts.indexOf(ans)], s.text); });
          qBox.replaceChildren(h('div', { class: 'row', style: 'gap:18px' }, ...s.pics.map(p => pic(p, 72)), h('div', { class: 'word', style: 'font-size:40px' }, line)), h('div', { class: 'row', style: 'gap:16px' }, ...btns));
          go();
        } else {
          const s = rand(ST.sentences(8, L).filter(s => WB.BY[s.words[s.blank].toLowerCase()]));
          if (!s) { ask('read', w).then(resolve); return; }
          const ans = s.words[s.blank], aw = WB.BY[ans.toLowerCase()];
          w = aw;
          const opts = ST.shuffle([ans, ...ST.distract(aw, nOpt - 1).map(o => o.w)]);
          const line = s.words.map((x, j) => j === s.blank ? '___' : x).join(' ') + '.';
          const btns = opts.map(o => h('button', { class: 'card word', style: 'font-size:40px;padding:8px 26px 14px' }, o));
          btns.forEach((b, j) => b.onclick = () => { lock(); if (opts[j] === ans) { AUD.say(s.text); finish(true, b); } else wrong(b, btns[opts.indexOf(ans)], s.text); });
          qBox.replaceChildren(h('div', { class: 'row', style: 'gap:20px' }, ...s.pics.map(p => pic(p, 80)), h('div', { class: 'word', style: 'font-size:44px' }, line)), h('div', { class: 'row', style: 'gap:16px' }, ...btns));
          go();
        }
      });
    }
  }

  window.BATTLE = { battle, BOSS_PAL, hearts };
})();
