// DOM UI: HUD, dock, modal shell, title, hero pick, story, parent corner, rewards.
(function () {
  const $ = s => document.querySelector(s);
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'style') e.style.cssText = attrs[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    }
    kids.flat().forEach(k => { if (k === null || k === undefined || k === false) return; e.append(k.nodeType ? k : document.createTextNode(k)); });
    return e;
  }
  const icon = (emoji, px) => { const c = SPR.pixEmoji(emoji, 16); return SPR.img(c, Math.max(1, Math.round((px || 48) / c.width))); };
  const pic = (p, px) => { const c = SPR.picFor(p, 24); return SPR.img(c, Math.max(1, Math.round((px || 96) / c.width))); };
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // a red "wrong" flash clears itself after the shake
  document.addEventListener('animationend', e => { if (e.animationName === 'shake' && e.target.classList.contains('bad')) e.target.classList.remove('bad'); });
  // any element with data-say speaks when tapped
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-say]');
    if (el) { AUD.say(el.dataset.say); }
  });

  function speakBtn(text, big) {
    const b = h('button', { class: 'speak' + (big ? ' big' : ''), title: 'Listen' }, SPR.img(SPR.glyph('speaker'), big ? 4 : 3));
    b.addEventListener('click', e => { e.stopPropagation(); AUD.say(typeof text === 'function' ? text() : text); });
    return b;
  }
  function heHint(he) {
    const S = ST.S;
    const out = h('div', { class: 'he' });
    if (!S.hebrew || !he) return out;
    const b = h('button', { class: 'hebtn' }, 'עברית?');
    b.onclick = e => { e.stopPropagation(); out.textContent = he; setTimeout(() => { out.textContent = ''; out.append(b); }, 7000); };
    out.append(b);
    return out;
  }

  // an always-visible Hebrew line under an instruction (for a beginner who can't read the English yet)
  const heLine = he => (ST.S.hebrew && he) ? h('div', { class: 'heline' }, he) : null;

  // ── HUD ───────────────────────────────────────────────────────────────
  let shownGems = 0;
  function hud() {
    $('#gems .gi').replaceChildren(icon('💎', 44));
    $('#prog .pi').replaceChildren(SPR.img(SPR.hero(ST.S.hero, ST.S.heroLv[ST.S.hero], 0), 2));
    updateHud(true);
    const snd = $('#btnSound');
    const setSnd = () => snd.replaceChildren(SPR.img(SPR.glyph(AUD.settings.music ? 'speaker' : 'mute'), 3));
    setSnd();
    snd.onclick = () => { const on = !AUD.settings.music; AUD.setMusic(on); AUD.setSfx(on); setSnd(); ST.S.sound = on; ST.save(); };
    $('#btnParent').replaceChildren(icon('⚙️', 40));
    $('#btnParent').onclick = () => parentGate();
  }
  function updateHud(instant) {
    const S = ST.S;
    if (instant) shownGems = S.gems;
    $('#gems .n').textContent = shownGems;
    const p = ST.progress();
    $('#prog .fill').style.width = `calc(${p}% - 6px * ${p / 100})`;
    $('#prog .lbl').textContent = p + '%';
  }
  function addGems(n, fromEl) {
    const S = ST.S;
    S.gems += n; ST.save();
    let left = Math.min(n, 14);
    const per = Math.ceil(n / left);
    FX.gems(fromEl, left, () => {
      shownGems = Math.min(S.gems, shownGems + per);
      if (--left <= 0) shownGems = S.gems;
      $('#gems .n').textContent = shownGems;
      const g = $('#gems'); g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump');
    });
  }
  function spend(n) {
    const S = ST.S;
    if (S.gems < n) return false;
    S.gems -= n; shownGems = S.gems; ST.save(); updateHud(); return true;
  }

  // ── dock ──────────────────────────────────────────────────────────────
  const DOCK = [
    { id: 'play', label: 'Play', big: true },
    { sep: true },
    { id: 'hatch', label: 'Hatch', emoji: '🥚' },
    { id: 'decor', label: 'Decorate', emoji: '🏡' },
    { id: 'hero', label: 'Hero', hero: true },
  ];
  function dock() {
    const d = $('#dock'); d.replaceChildren();
    DOCK.forEach(o => {
      if (o.sep) return d.append(h('div', { class: 'dock-sep' }));
      if (o.big) {
        const b = h('button', { class: 'btn green', id: 'dk-' + o.id, style: 'font-size:40px;padding:14px 44px 20px;margin:4px 10px 4px 6px' }, icon('▶️', 40), o.label);
        b.onclick = () => { AUD.sfx('tap'); AUD.say("Let's play!"); UI.onDock && UI.onDock(o.id); };
        return d.append(b);
      }
      const im = o.hero ? SPR.img(SPR.hero(ST.S.hero, ST.S.heroLv[ST.S.hero], 0), 2) : icon(o.emoji, 48);
      im.style.height = '52px'; im.style.width = 'auto';
      const b = h('button', { class: 'dk', id: 'dk-' + o.id }, im, h('span', null, o.label));
      b.onclick = () => { AUD.sfx('tap'); AUD.say(o.label); UI.onDock && UI.onDock(o.id); };
      d.append(b);
    });
    updateBadges();
  }
  function updateBadges() {
    const n = window.GAMES && GAMES.possibleMixes ? GAMES.possibleMixes() : 0;
    const b = $('#dk-hatch'); if (!b) return;
    b.querySelector('.badge') && b.querySelector('.badge').remove();
    if (n) b.append(h('div', { class: 'badge' }, String(n)));
  }

  // ── the bar at the top while putting a decoration on the map ─────────
  function placeBar(text, he, onCancel, onPutAway) {
    let bar = $('#placebar');
    if (!text) { bar && bar.remove(); return; }
    if (!bar) { bar = h('div', { id: 'placebar', class: 'frame' }); document.body.append(bar); }
    bar.style.cssText = 'position:fixed;top:86px;left:50%;transform:translateX(-50%);z-index:25;display:flex;align-items:center;gap:14px;padding:10px 16px 12px;max-width:94vw';
    bar.replaceChildren(
      h('div', { class: 'col', style: 'gap:2px;align-items:flex-start' }, h('div', { class: 'word say', 'data-say': text, style: 'font-size:26px' }, text), ST.S.hebrew && he ? h('div', { class: 'he', style: 'font-size:18px;min-height:0' }, he) : null),
      ...[onPutAway ? h('button', { class: 'btn small blue', onclick: () => { AUD.sfx('tap'); onPutAway(); } }, '👜 Bag') : null,
      h('button', { class: 'btn small gray', onclick: () => { AUD.sfx('tap'); placeBar(null); onCancel && onCancel(); } }, 'Cancel')].filter(Boolean));
  }

  // ── modal ─────────────────────────────────────────────────────────────
  let onCloseFn = null;
  function open(el, onClose) {
    const m = $('#modal'); m.replaceChildren(el); m.classList.add('on'); onCloseFn = onClose || null;
    fit();
    hand(null);
  }
  // shrink or grow the window to the screen
  function fit() { const el = $('#modal').firstElementChild; if (el) el.style.zoom = Math.min(1.3, innerHeight / 800, innerWidth / 1160).toFixed(3); }
  addEventListener('resize', fit);
  function close() {
    UI.session = null;
    const m = $('#modal'); m.classList.remove('on'); m.replaceChildren();
    speechSynthesis && speechSynthesis.cancel();
    const f = onCloseFn; onCloseFn = null; f && f();
    if (!isOpen()) UI.afterClose && UI.afterClose();
  }
  const isOpen = () => $('#modal').classList.contains('on');

  // a mini-game frame: title, round pips, close button
  function shell(title, emoji, rounds, cls, lvl) {
    const pips = h('div', { class: 'pips' });
    const badge = lvl ? h('div', { class: 'say', 'data-say': 'Level ' + lvl, style: 'font-family:var(--pix);font-size:22px;padding:4px 12px 6px;background:var(--plum3);box-shadow:0 0 0 3px var(--ink);color:var(--gold);white-space:nowrap' }, 'Level ' + lvl) : null;
    for (let i = 0; i < rounds; i++) pips.append(h('div', { class: 'pip' }));
    const body = h('div', { class: 'sb' });
    const root = h('div', { class: 'screen frame ' + (cls || '') },
      h('div', { class: 'sh' }, emoji ? icon(emoji, 52) : null, h('h2', { class: 'say', 'data-say': title }, title), badge, pips,
        h('button', { class: 'close', onclick: () => { AUD.sfx('tap'); close(); } }, '×')),
      body);
    return { root, body, pip: (i, st) => { const p = pips.children[i]; if (p) p.className = 'pip ' + (st || 'on'); } };
  }

  // ── rewards screen ───────────────────────────────────────────────────
  async function results(o) {
    // o: { title, emoji, correct, total, gems, items:[id], again }
    const S = ST.S;
    const ratio = o.correct / o.total, stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
    // rewards follow right answers: nothing for guessing
    if (o.correct === 0) o.gems = 0;
    if (o.correct < o.total / 2) o.items = [];
    const lv = S.heroLv[S.hero], bonus = Math.round(o.gems * (lv - 1) * 0.1);
    const gems = o.gems + bonus;
    // the game's own level follows how well it went
    const game = UI.curGame;
    const up = game ? ST.bumpLevel(game, ratio) : null;
    const ss = game ? UI.session : null;
    UI.curGame = null;
    const st = h('div', { class: 'stars' }, ...[0, 1, 2].map(() => h('div', { class: 'star' }, SPR.img(SPR.glyph('star'), 7))));
    const gemRow = h('div', { class: 'reward frame' }, icon('💎', 48), h('span', null, '+' + gems), bonus ? h('span', { style: 'font-size:20px;color:#c8b8d8' }, `(hero +${bonus})`) : null);
    const itemsRow = h('div', { class: 'row' });
    (o.items || []).forEach(id => { S.items[id] = (S.items[id] || 0) + 1; itemsRow.append(itemCard(id, true)); if (ST.ITEMS[id].rare) setTimeout(() => toast('Rare: ' + ST.ITEMS[id].word + '!', '✨'), 1400); });
    const upRow = up ? h('div', { class: 'row', style: 'gap:10px;font-family:var(--pix);font-size:30px;color:' + (up.after > up.before ? 'var(--mint)' : '#c8b8d8') }, icon(up.after > up.before ? '⬆️' : '⬇️', 34), 'Level ' + up.after + (up.after > up.before ? '!' : '')) : null;
    ST.S.rounds++; ST.save();
    const praise = stars === 3 ? 'Amazing!' : stars === 2 ? 'Great job!' : 'Good try!';
    const s = h('div', { class: 'screen frame narrow', style: 'align-items:center;gap:22px;padding:30px' },
      h('h2', { class: 'say', 'data-say': praise, style: 'font-family:var(--pix);font-size:56px;margin:0;color:var(--gold);text-shadow:0 5px 0 var(--ink)' }, praise),
      st,
      h('div', { class: 'word', style: 'font-size:28px' }, `${o.correct} / ${o.total}`),
      gemRow, itemsRow, upRow,
      ss ? h('div', { class: 'row' },
        h('button', { class: 'btn green', style: 'font-size:32px', onclick: () => { AUD.sfx('tap'); GAMES.sessionNext(stars, gems); } }, ss.i + 1 < ss.list.length ? 'Next game' : 'Treasure!', icon(ss.i + 1 < ss.list.length ? '▶️' : '🧰', 32)),
        h('div', { class: 'word', style: 'font-size:22px;color:#c8b8d8' }, `${ss.i + 1} / ${ss.list.length}`))
        : h('div', { class: 'row' },
        h('button', { class: 'btn green', onclick: () => { AUD.sfx('tap'); close(); } }, 'Island'),
        o.again ? h('button', { class: 'btn', onclick: () => { AUD.sfx('tap'); UI.curGame = game; o.again(); } }, 'Again!') : null));
    open(s, ss ? null : o.onClose);
    if (ss) UI.session = ss;
    AUD.sfx('win');
    AUD.say(praise);
    for (let i = 0; i < stars; i++) { await wait(350); st.children[i].classList.add('on'); AUD.sfx('coin'); FX.burstEl(st.children[i], 20); }
    await wait(300);
    addGems(gems, gemRow);
    if (stars === 3) FX.confetti(120);
    if (up && up.after > up.before) { AUD.sfx('magic'); FX.burstEl(upRow, 40); setTimeout(() => AUD.say('Level up!'), 900); }
    updateBadges();
  }

  function itemCard(id, fresh) {
    const it = ST.ITEMS[id];
    const art = it.egg ? SPR.img(SPR.egg(it.egg[0], it.egg[1]), 4) : icon(it.pic, 56);
    return h('div', { class: 'card say', 'data-say': it.word, style: `padding:10px 14px;${fresh ? 'animation:popIn .5s;' : ''}${it.rare ? 'background:#fff0b0;box-shadow:0 0 0 4px var(--ink),0 0 0 8px var(--gold)' : ''}` }, art, h('div', { class: 'word', style: 'font-size:22px' }, (it.rare ? '✨ ' : '') + it.word));
  }

  // ── toast + tooltip + pointing hand ─────────────────────────────────
  function toast(text, emoji, say) {
    const t = h('div', { class: 'toast frame' }, emoji ? icon(emoji, 40) : null, h('span', null, text));
    const box = $('#toast');
    // over an open window, sit at the very top so titles and answers stay visible
    if (isOpen()) { box.style.top = '6px'; box.style.bottom = 'auto'; } else { box.style.top = 'auto'; box.style.bottom = '160px'; }
    box.append(t); setTimeout(() => t.remove(), 3100);
    if (say !== false) AUD.say(text);
  }
  function tip(text, x, y) {
    const t = $('#tip');
    if (!text) { t.style.display = 'none'; return; }
    t.textContent = text; t.style.display = 'block'; t.style.left = x + 'px'; t.style.top = (y - 18) + 'px';
  }
  let handTarget = null;
  function hand(target) { handTarget = target; if (!target) $('#hand').style.display = 'none'; }
  function tickHand() {
    const el = $('#hand');
    if (!handTarget || isOpen()) { el.style.display = 'none'; return; }
    let x, y;
    if (handTarget.nodeType) { const r = handTarget.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top; }
    else { [x, y] = WORLD.toScreen(handTarget[0], handTarget[1]); }
    el.style.display = 'block'; el.style.left = (x - 27) + 'px'; el.style.top = (y - 70) + 'px';
  }

  // ── title / hero pick / story ────────────────────────────────────────
  function title(onPlay) {
    const t = $('#title'); t.classList.remove('hidden');
    const has = ST.S.started;
    t.replaceChildren(
      h('div', { class: 'logo' }, 'LAVA ISLES', h('small', null, 'an English adventure')),
      h('button', { class: 'btn', style: 'font-size:40px;padding:20px 60px 26px', onclick: () => { AUD.unlock(); AUD.sfx('magic'); t.classList.add('hidden'); onPlay(); } }, icon('▶️', 36), has ? 'Play' : 'Start'));
  }
  function heroPick(onDone, fromCamp) {
    const S = ST.S;
    let sel = S.hero;
    const cards = h('div', { class: 'row', style: 'gap:30px' });
    const detail = h('div', { class: 'col' });
    const lines = { fox: 'I am Flint. I am a fox.', cat: 'I am Luna. I am a cat.', dragon: 'I am Pip. I am a dragon.' };
    const draw = () => {
      cards.replaceChildren();
      Object.keys(SPR.HEROES).forEach(id => {
        const H = SPR.HEROES[id], lv = S.heroLv[id];
        const im = SPR.img(SPR.hero(id, lv, 0), 8);
        im.style.animation = sel === id ? 'float 1s ease-in-out infinite' : '';
        const c = h('div', { class: 'card', style: `width:220px;padding:16px 10px 14px;${sel === id ? 'background:#fff5c0;box-shadow:0 0 0 4px var(--ink),0 0 0 10px var(--gold),0 8px 0 4px rgba(0,0,0,.3)' : ''}` },
          im, h('div', { class: 'word', style: 'font-size:34px' }, H.name), h('div', { style: 'font-size:18px;color:#6a4a6e;font-weight:700' }, 'Level ' + lv));
        c.onclick = () => { sel = id; AUD.sfx('pick', 3); AUD.say(lines[id]); draw(); };
        cards.append(c);
      });
    };
    draw();
    const sc = h('div', { class: 'screen frame', style: 'height:auto;padding:30px 30px 36px;gap:26px;align-items:center' },
      h('h2', { class: 'say', 'data-say': 'Choose your hero!', style: 'font-family:var(--pix);font-size:52px;margin:0;color:var(--gold);text-shadow:0 5px 0 var(--ink)' }, 'Choose your hero!'),
      cards, detail,
      h('button', { class: 'btn green', style: 'font-size:34px', onclick: () => { S.hero = sel; ST.save(); AUD.sfx('good'); close(); onDone && onDone(); } }, 'Go!'));
    open(sc);
    AUD.say('Choose your hero!');
  }
  async function story(onDone) {
    const slides = [
      { t: 'Bad dragons broke our island.', he: 'דרקונים רעים שברו את האי שלנו.', art: () => SPR.img(SPR.boss({ body: '#4a8a3a', belly: '#e8d08a', bellyLine: '#c8a860', dark: '#2f5a2a', wing: '#8a3a3a', spike: '#ffd23a', horn: '#f4f1ea', snout: '#6aa84a' }, 2), 6) },
      { t: 'Play games. Get gems.', he: 'שחק משחקים. אסוף יהלומים.', art: () => h('div', { class: 'row' }, icon('🧪', 96), icon('🔤', 96), icon('💎', 96)) },
      { t: 'Fix the castles. Help the animals!', he: 'תקן את הטירות. עזור לחיות!', art: () => h('div', { class: 'row' }, icon('🏰', 110), SPR.img(SPR.creature('fox', 'lava', 0), 8), SPR.img(SPR.creature('cat', 'moon', 0), 8)) },
    ];
    let i = 0;
    const show = () => {
      const s = slides[i];
      const sc = h('div', { class: 'screen frame narrow', style: 'align-items:center;gap:26px;padding:34px;width:min(860px,94vw)' },
        h('div', { style: 'min-height:240px;display:grid;place-items:center' }, s.art()),
        h('div', { class: 'row' }, h('div', { class: 'word say', 'data-say': s.t, style: 'font-size:46px;text-align:center' }, s.t), speakBtn(s.t)),
        h('div', { class: 'he', style: 'font-size:26px' }, ST.S.hebrew ? s.he : ''),
        h('button', { class: 'btn green', onclick: () => { AUD.sfx('tap'); i++; if (i < slides.length) show(); else { close(); onDone(); } } }, i < slides.length - 1 ? 'Next' : "Let's go!"));
      open(sc);
      AUD.say(s.t);
    };
    show();
  }

  // ── simple confirm/info panel ───────────────────────────────────────
  function panel(o) {
    // o: { title, art, text, he, cost, btn, onYes, secondary }
    const S = ST.S;
    const can = !o.cost || S.gems >= o.cost;
    const yes = h('button', { class: 'btn green', style: 'font-size:30px' }, o.btn || 'OK', o.cost ? h('span', { style: 'display:inline-flex;align-items:center;gap:4px' }, icon('💎', 32), String(o.cost)) : null);
    if (!can) yes.setAttribute('disabled', '');
    yes.onclick = () => { AUD.sfx('tap'); close(); o.onYes && o.onYes(); };
    const need = !can ? h('div', { class: 'word say', 'data-say': 'You need more gems. Play a game!', style: 'font-size:24px;color:#ffb0a0' }, 'You need more gems. Play a game!') : null;
    const sc = h('div', { class: 'screen frame narrow', style: 'align-items:center;gap:18px;padding:28px' },
      h('div', { class: 'sh', style: 'width:100%' }, h('h2', { class: 'say', 'data-say': o.title }, o.title), h('button', { class: 'close', onclick: () => { AUD.sfx('tap'); close(); } }, '×')),
      o.art || null,
      o.text ? h('div', { class: 'row', style: 'gap:14px' }, h('div', { class: 'word say', 'data-say': o.text, style: 'font-size:32px;text-align:center' }, o.text), speakBtn(o.text)) : null,
      o.he && S.hebrew ? h('div', { class: 'he' }, o.he) : null,
      need,
      h('div', { class: 'row' }, o.onYes ? yes : null, o.secondary || null));
    open(sc);
    AUD.say(o.text || o.title);
  }

  // ── parent corner ────────────────────────────────────────────────────
  function parentGate() {
    // hold the button for 2 seconds, so little fingers don't reset things
    let timer = null;
    const b = h('button', { class: 'btn blue' }, 'Hold for parents');
    const bar = h('div', { style: 'height:12px;width:0;background:var(--gold);transition:width 2s linear' });
    const start = () => { bar.style.width = '100%'; timer = setTimeout(() => { close(); parents(); }, 2000); };
    const stop = () => { bar.style.transition = 'none'; bar.style.width = '0'; void bar.offsetWidth; bar.style.transition = 'width 2s linear'; clearTimeout(timer); };
    b.addEventListener('pointerdown', start); b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop);
    open(h('div', { class: 'screen frame narrow', style: 'align-items:center;gap:18px;padding:30px' },
      h('div', { class: 'sh', style: 'width:100%' }, h('h2', null, 'Parents'), h('button', { class: 'close', onclick: close }, '×')), b, h('div', { style: 'width:300px;background:var(--ink)' }, bar)));
  }
  function parents() {
    const S = ST.S;
    const all = WB.WORDS, seen = all.filter(o => S.words[o.w]), mast = all.filter(o => ST.mastered(o.w));
    const skillName = { phonics: 'Letters & sounds', listen: 'Listening', read: 'Reading', spell: 'Spelling / writing', sentence: 'Sentences' };
    const skills = Object.keys(skillName).map(k => { const v = S.skill[k] || [0, 0]; return h('div', { class: 'row', style: 'justify-content:space-between;width:100%;font-size:20px' }, h('span', null, skillName[k]), h('b', null, v[1] ? `${Math.round(v[0] / v[1] * 100)}%  (${v[0]}/${v[1]})` : '—')); });
    const weak = seen.filter(o => { const r = S.words[o.w]; return r.s >= 2 && r.c / r.s < 0.6; }).map(o => o.w);
    const chk = (label, val, fn) => { const i = h('input', { type: 'checkbox' }); i.checked = val; i.onchange = () => fn(i.checked); return h('label', { style: 'display:flex;gap:10px;align-items:center;font-size:20px' }, i, label); };
    const rate = h('input', { type: 'range', min: '0.55', max: '1.1', step: '0.05', value: String(AUD.settings.rate) });
    rate.oninput = () => { AUD.settings.rate = +rate.value; S.rate = +rate.value; ST.save(); };
    const mins = Math.round(S.seconds / 60);
    const sc = h('div', { class: 'screen frame', style: 'overflow:auto' },
      h('div', { class: 'sh' }, h('h2', null, 'Parent corner'), h('button', { class: 'close', onclick: close }, '×')),
      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:26px;font-size:20px;align-content:start' },
        h('div', { class: 'col', style: 'align-items:stretch' },
          h('h3', { style: 'margin:0;font-family:var(--pix);color:var(--gold)' }, 'Progress'),
          h('div', null, `Time played: ${mins} min · Games finished: ${S.rounds}`),
          h('div', null, `Words met: ${seen.length} / ${all.length} · Mastered (3 right in a row): ${mast.length}`),
          h('div', null, `Word level unlocked: ${ST.tierOpen(3) ? 3 : ST.tierOpen(2) ? 2 : 1} of 3`),
          ...skills,
          h('div', null, h('b', null, 'Needs practice: '), weak.length ? weak.join(', ') : '—'),
          h('h3', { style: 'margin:10px 0 0;font-family:var(--pix);color:var(--gold)' }, 'Games (level 1-5)'),
          h('div', { style: 'display:grid;grid-template-columns:repeat(2,1fr);gap:6px' }, ...GAMES.LIST.map(g => h('button', { class: 'btn small blue', style: 'font-size:17px;justify-content:space-between', onclick: () => { close(); GAMES.play(g.id); } }, icon(g.emoji, 22), g.name, h('b', null, 'Lv ' + ST.lvl(g.id))))),
          h('div', null, h('b', null, 'Mastered: '), mast.length ? mast.map(o => o.w).join(', ') : '—')),
        h('div', { class: 'col', style: 'align-items:stretch' },
          h('h3', { style: 'margin:0;font-family:var(--pix);color:var(--gold)' }, 'Settings'),
          chk('Hebrew hints (עברית)', S.hebrew, v => { S.hebrew = v; ST.save(); }),
          chk('Music', AUD.settings.music, v => AUD.setMusic(v)),
          chk('Sound effects', AUD.settings.sfx, v => AUD.setSfx(v)),
          h('label', { style: 'display:flex;gap:10px;align-items:center' }, 'Voice speed', rate, h('button', { class: 'btn small blue', onclick: () => AUD.say('The fox can run.') }, 'Test')),
          h('button', { class: 'btn small gray', style: 'margin-top:30px', onclick: () => { if (confirm('Erase all progress?')) { ST.reset(); location.reload(); } } }, 'Erase progress'))));
    open(sc);
  }

  window.UI = { placeBar, session: null, curGame: null, moving: false, heLine, h, icon, pic, wait, speakBtn, heHint, hud, updateHud, addGems, spend, dock, updateBadges, open, close, isOpen, shell, results, itemCard, toast, tip, hand, tickHand, title, heroPick, story, panel, onDock: null };
})();
