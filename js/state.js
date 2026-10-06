// Save data, economy, word mastery (which words to practise next), game levels, merge recipes, decorations.
(function () {
  const KEY = 'gur-lava-isles-v1';
  const style = (roof, wall) => ({ roof, wall, flag: roof });
  const fresh = () => ({
    v: 2, started: false, hero: 'fox', heroLv: { fox: 1, cat: 1, dragon: 1 },
    gems: 15, castles: [0, 0, 0], bridges: [false, false, false, false],
    isles: [0, 1, 2, 3].map(() => ({ won: false, castle: 0, tries: 0 })),
    items: { fire: 1, eggFox: 1 },
    creatures: [], found: {}, words: {}, skill: {}, seconds: 0, hebrew: true, tip: 0, rounds: 0, finale: false,
    diff: {},                       // game id -> level 1..5 (float, grows with good play)
    sessions: 0, lastGames: [],
    decor: [],                      // [{ k, x, y, isle }] placed on the map
    styles: { castles: [style('red', 'gray'), style('blue', 'gray'), style('purple', 'gray')], isles: [style('orange', 'gray'), style('white', 'gray'), style('green', 'gray'), style('yellow', 'gray')] },
    boss: {},                       // isle -> first-win rare drop taken
  });
  let S = fresh();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const old = JSON.parse(raw), f = fresh();
        S = Object.assign(f, old);
        S.items = Object.assign({}, old.items || {});
        S.styles = Object.assign(f.styles, old.styles || {});
        S.isles = (old.isles || f.isles).map(x => Object.assign({ won: false, castle: 0, tries: 0 }, x));
        S.v = 2;
      }
    } catch (e) { }
    return S;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
  function reset() { S = fresh(); save(); return S; }

  // ── costs ─────────────────────────────────────────────────────────────
  const CASTLE_COST = [[20, 45, 80], [30, 60, 100], [40, 75, 120]];
  const ISLE_CASTLE_COST = [50, 90, 130];
  const HERO_COST = [40, 80, 130, 200];
  const castleLevels = () => S.castles.reduce((a, b) => a + b, 0);
  // bridges open by themselves: the first when a castle is fixed, the next ones when a dragon is beaten
  const bridgeOpen = i => i === 0 ? castleLevels() >= 1 : S.isles[i - 1].won;

  // how much of the world is fixed, 0..100
  function progress() {
    let p = castleLevels() * 4;                                   // 36
    p += S.bridges.filter(Boolean).length * 3;                    // 12
    p += S.isles.filter(i => i.won).length * 6;                   // 24
    p += S.isles.reduce((a, i) => a + i.castle, 0) * 1.5;         // 18
    p += Math.min(10, S.creatures.length);                        // 10
    return Math.min(100, Math.round(p));
  }

  // ── game levels: each game has its own level 1..5 that follows how well Gur plays it ──
  const lvl = id => Math.max(1, Math.min(5, Math.floor((S.diff[id] || 1) + 1e-6)));
  function bumpLevel(id, ratio) {
    if (!id) return null;
    const before = lvl(id), d = S.diff[id] || 1;
    const step = ratio >= 0.85 ? 0.5 : ratio >= 0.65 ? 0.25 : ratio < 0.45 ? -0.5 : 0;
    S.diff[id] = Math.max(1, Math.min(5.5, d + step));
    save();
    const after = lvl(id);
    return after !== before ? { before, after } : null;
  }
  // the longest words a level reaches
  const tierCap = L => [1, 1, 2, 3, 4, 4][L];

  // ── word mastery ─────────────────────────────────────────────────────
  const W = () => WB.WORDS;
  const rec = w => (S.words[w] = S.words[w] || { s: 0, c: 0, st: 0 });
  const mastered = w => { const r = S.words[w]; return r && r.st >= 3; };
  function tierOpen(t) {
    if (t <= 1) return true;
    const prev = W().filter(o => o.tier === t - 1);
    const good = prev.filter(o => (S.words[o.w] || {}).c >= 2).length;
    return good >= prev.length * 0.5;
  }
  const topTier = () => tierOpen(4) ? 4 : tierOpen(3) ? 3 : tierOpen(2) ? 2 : 1;
  // a game level can open longer words before mastery does, and at high levels the very short words step back
  function openWords(filter, L) {
    const cap = L ? tierCap(L) : 0;
    let pool = W().filter(o => (tierOpen(o.tier) || o.tier <= cap) && (!filter || filter(o)));
    if (L >= 3) { const hard = pool.filter(o => o.tier >= cap - 1); if (hard.length >= 12) pool = hard; }
    return pool;
  }
  // a small active set: words in progress + a few new ones; mastered words come back now and then
  function pick(n, filter, L) {
    const pool = openWords(filter, L);
    const learning = pool.filter(o => S.words[o.w] && !mastered(o.w));
    const fresh_ = pool.filter(o => !S.words[o.w]);
    const done = pool.filter(o => mastered(o.w));
    const active = learning.slice();
    shuffle(fresh_); fresh_.sort((a, b) => a.tier - b.tier);
    while (active.length < 8 && fresh_.length) active.push(fresh_.shift());
    const out = [], used = new Set();
    const take = arr => { const c = arr.filter(o => !used.has(o.w) && !used.has('p' + o.pic)); if (!c.length) return false; const o = c[Math.floor(Math.random() * c.length)]; used.add(o.w); used.add('p' + o.pic); out.push(o); return true; };
    let guard = 0;
    while (out.length < n && guard++ < 200) {
      const r = Math.random();
      if (r < 0.2 && done.length && take(done)) continue;
      if (take(active)) continue;
      if (take(pool)) continue;
      break;
    }
    return out;
  }
  // distractors: different words with different pictures, preferably same category
  function distract(word, n, filter) {
    let pool = W().filter(o => o.w !== word.w && o.pic !== word.pic && (!filter || filter(o)));
    const same = pool.filter(o => o.cat === word.cat);
    const out = [];
    shuffle(same); shuffle(pool);
    for (const o of same.concat(pool)) { if (out.length >= n) break; if (!out.includes(o)) out.push(o); }
    return out;
  }
  function record(w, ok, skill) {
    const r = rec(w); r.s++;
    if (ok) { r.c++; r.st++; } else r.st = 0;
    const k = (S.skill[skill] = S.skill[skill] || [0, 0]); k[1]++; if (ok) k[0]++;
    save();
  }
  function sentences(n, L) {
    const tier = Math.max(topTier(), L ? tierCap(L) : 1);
    let pool = WB.SENTENCES.filter(s => s.tier <= tier);
    if (L >= 4) { const hard = pool.filter(s => s.tier >= 3); if (hard.length >= n) pool = hard; }
    shuffle(pool);
    return pool.slice(0, n);
  }

  // ── items: common drops, crafted things, and rare ones ───────────────
  const ITEMS = {
    fire: { word: 'fire', pic: '🔥' }, water: { word: 'water', pic: '💧' }, moon: { word: 'moon', pic: '🌙' },
    star: { word: 'star', pic: '⭐' }, leaf: { word: 'leaf', pic: '🍃' }, rock: { word: 'rock', pic: '🪨' },
    crown: { word: 'crown', pic: '👑' },
    cloud: { word: 'cloud', pic: '☁️' }, ice: { word: 'ice', pic: '❄️' }, flower: { word: 'flower', pic: '🌸' },
    sun: { word: 'sun', pic: '☀️', rare: true }, comet: { word: 'comet', pic: '☄️', rare: true },
    rainbow: { word: 'rainbow', pic: '🌈', rare: true }, crystal: { word: 'crystal', pic: '🔮', rare: true },
    eggFox: { word: 'fox egg', egg: ['#ff8a1c', '#fff1a8'] }, eggCat: { word: 'cat egg', egg: ['#9a96c8', '#ffffff'] },
    eggDragon: { word: 'dragon egg', egg: ['#3fb58a', '#ffe08a'] },
    eggGold: { word: 'gold egg', egg: ['#ffd23a', '#ffffff'], rare: true },
  };
  const COMMON = ['fire', 'moon', 'star', 'water', 'leaf', 'rock'];
  // after a game: usually one common thing, sometimes a rare one
  function dropItem(luck) {
    const r = Math.random();
    if (r < 0.04 + (luck || 0)) return 'sun';
    if (r < 0.06 + (luck || 0) * 1.5) return 'eggGold';
    return COMMON[Math.floor(Math.random() * COMMON.length)];
  }
  const RECIPES = [
    { a: 'eggFox', b: 'fire', kind: 'fox', elem: 'lava', name: 'Lava Fox', clue: 'The fox likes fire.' },
    { a: 'eggCat', b: 'moon', kind: 'cat', elem: 'moon', name: 'Moon Cat', clue: 'The cat likes the moon.' },
    { a: 'eggDragon', b: 'fire', kind: 'dragon', elem: 'lava', name: 'Fire Dragon', clue: 'The dragon likes fire.' },
    { a: 'eggFox', b: 'star', kind: 'fox', elem: 'star', name: 'Star Fox', clue: 'The fox likes the stars.' },
    { a: 'eggCat', b: 'fire', kind: 'cat', elem: 'lava', name: 'Lava Cat', clue: 'The cat likes fire too.' },
    { a: 'eggDragon', b: 'water', kind: 'dragon', elem: 'steam', name: 'Steam Dragon', clue: 'The dragon likes water.' },
    { a: 'eggFox', b: 'leaf', kind: 'fox', elem: 'leaf', name: 'Leaf Fox', clue: 'The fox likes a green leaf.' },
    { a: 'eggCat', b: 'star', kind: 'cat', elem: 'star', name: 'Star Cat', clue: 'The cat likes the stars.' },
    { a: 'eggDragon', b: 'moon', kind: 'dragon', elem: 'shadow', name: 'Night Dragon', clue: 'The dragon likes the moon.' },
    { a: 'eggCat', b: 'rock', kind: 'cat', elem: 'shadow', name: 'Shadow Cat', clue: 'The black cat likes a rock.' },
    // two things make a new thing
    { a: 'fire', b: 'water', make: 'cloud', name: 'cloud', clue: 'Fire and water make a cloud.' },
    { a: 'water', b: 'moon', make: 'ice', name: 'ice', clue: 'Water and the moon make ice.' },
    { a: 'leaf', b: 'water', make: 'flower', name: 'flower', clue: 'A leaf and water make a flower.' },
    { a: 'star', b: 'star', make: 'comet', name: 'comet', clue: 'Two stars make a comet.', rare: true },
    { a: 'cloud', b: 'sun', make: 'rainbow', name: 'rainbow', clue: 'A cloud and the sun make a rainbow.', rare: true },
    { a: 'rock', b: 'comet', make: 'crystal', name: 'crystal', clue: 'A comet hits a rock. Crystal!', rare: true },
    // new animals from the new things
    { a: 'eggFox', b: 'ice', kind: 'fox', elem: 'ice', name: 'Ice Fox', clue: 'The fox likes ice.' },
    { a: 'eggCat', b: 'flower', kind: 'cat', elem: 'flower', name: 'Flower Cat', clue: 'The cat likes a flower.' },
    { a: 'eggDragon', b: 'cloud', kind: 'dragon', elem: 'cloud', name: 'Cloud Dragon', clue: 'The dragon likes a cloud.' },
    { a: 'eggDragon', b: 'ice', kind: 'dragon', elem: 'ice', name: 'Ice Dragon', clue: 'The dragon likes ice too.' },
    { a: 'eggFox', b: 'flower', kind: 'fox', elem: 'flower', name: 'Flower Fox', clue: 'The fox likes a flower too.' },
    // rare animals
    { a: 'eggFox', b: 'rainbow', kind: 'fox', elem: 'rainbow', name: 'Rainbow Fox', clue: 'The fox likes a rainbow.', rare: true },
    { a: 'eggCat', b: 'crystal', kind: 'cat', elem: 'crystal', name: 'Crystal Cat', clue: 'The cat likes a crystal.', rare: true },
    { a: 'eggDragon', b: 'comet', kind: 'dragon', elem: 'comet', name: 'Comet Dragon', clue: 'The dragon likes a comet.', rare: true },
    { a: 'eggGold', b: 'sun', kind: 'dragon', elem: 'sun', name: 'Sun Dragon', clue: 'The gold egg likes the sun.', rare: true },
    { a: 'eggGold', b: 'rainbow', kind: 'cat', elem: 'rainbow', name: 'Rainbow Cat', clue: 'The gold egg likes a rainbow.', rare: true },
    // evolutions: a grown creature + the crown
    { a: 'c:fox:lava', b: 'crown', kind: 'fox', elem: 'gold', name: 'King Fox', clue: 'The lava fox wants a crown.', evo: true },
    { a: 'c:cat:moon', b: 'crown', kind: 'cat', elem: 'gold', name: 'Queen Cat', clue: 'The moon cat wants a crown.', evo: true },
    { a: 'c:dragon:lava', b: 'crown', kind: 'dragon', elem: 'gold', name: 'Dragon King', clue: 'The fire dragon wants a crown.', evo: true },
    { a: 'c:fox:rainbow', b: 'crystal', kind: 'fox', elem: 'crystal', name: 'Crystal Fox', clue: 'The rainbow fox wants a crystal.', evo: true, rare: true },
  ];
  function findRecipe(a, b) { return RECIPES.find(r => (r.a === a && r.b === b) || (r.a === b && r.b === a)); }

  // ── decorations for the island ──────────────────────────────────────
  // fx: what it does now and then (the surprises)
  const DECOR = {
    flower: { word: 'flower', pic: '🌷', cost: 4 }, sunflower: { word: 'sunflower', pic: '🌻', cost: 6 },
    mushroom: { word: 'mushroom', pic: '🍄', cost: 8, fx: 'grow' }, rock: { word: 'rock', pic: '🪨', cost: 3 },
    palm: { word: 'palm tree', pic: '🌴', cost: 12 }, cactus: { word: 'cactus', pic: '🌵', cost: 10 },
    lantern: { word: 'lantern', pic: '🏮', cost: 12, fx: 'glow' }, pumpkin: { word: 'pumpkin', pic: '🎃', cost: 10, fx: 'glow' },
    tent: { word: 'tent', pic: '⛺', cost: 15, fx: 'visitor' }, snowman: { word: 'snowman', pic: '⛄', cost: 18, fx: 'snow' },
    house: { word: 'house', pic: '🏠', cost: 30, fx: 'visitor' }, fountain: { word: 'fountain', pic: '⛲', cost: 30, fx: 'water' },
    statue: { word: 'statue', pic: '🗿', cost: 25, fx: 'wink' }, tree: { word: 'pine tree', pic: '🌲', cost: 8 },
    wheel: { word: 'big wheel', pic: '🎡', cost: 45, fx: 'lights' }, xmas: { word: 'Christmas tree', pic: '🎄', cost: 25, fx: 'lights' },
    gift: { word: 'gift', pic: '🎁', cost: 20, gift: true },
    // only from gifts
    rainbow: { word: 'rainbow', pic: '🌈', rare: true, fx: 'sparkle' }, unicorn: { word: 'unicorn', pic: '🦄', rare: true, walk: true },
    dino: { word: 'dinosaur', pic: '🦖', rare: true, walk: true }, ufo: { word: 'UFO', pic: '🛸', rare: true, fx: 'fly' },
    crystal: { word: 'crystal', pic: '💎', rare: true, fx: 'sparkle' }, volcano: { word: 'small volcano', pic: '🌋', rare: true, fx: 'glow' },
  };
  // what is inside a gift: usually a decoration, sometimes gems, an item, or something rare
  function openGift() {
    const r = Math.random();
    const rares = Object.keys(DECOR).filter(k => DECOR[k].rare);
    const commons = Object.keys(DECOR).filter(k => !DECOR[k].rare && !DECOR[k].gift);
    if (r < 0.16) return { decor: rares[Math.floor(Math.random() * rares.length)], rare: true };
    if (r < 0.22) return { item: Math.random() < 0.5 ? 'crystal' : 'eggGold', rare: true };
    if (r < 0.4) return { gems: 10 + Math.floor(Math.random() * 21) };
    if (r < 0.55) return { item: ['cloud', 'ice', 'flower', 'sun'][Math.floor(Math.random() * 4)] };
    return { decor: commons[Math.floor(Math.random() * commons.length)] };
  }

  // castle colours (colour words!)
  const COLORS = { red: '#c23a4a', blue: '#3a64c8', purple: '#8a4fd8', green: '#3fa05a', pink: '#ff7ac0', orange: '#e8742a', yellow: '#e8c020', black: '#2b2438', white: '#e8e4f0', brown: '#8a5a34' };
  const WALLS = { gray: ['#8a86a0', '#5e5a74', '#b9b5cc'], white: ['#d8d4e4', '#a8a4b8', '#f4f1ea'], brown: ['#9a6a44', '#6a4428', '#c08a5a'], pink: ['#d88aa8', '#a85a7a', '#f4b8cc'], black: ['#4a4458', '#2a2636', '#6a6478'], blue: ['#6a86c0', '#465c90', '#9ab4e0'] };

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  window.ST = {
    load, save, reset, get S() { return S; }, progress, castleLevels, bridgeOpen, CASTLE_COST, ISLE_CASTLE_COST, HERO_COST,
    pick, distract, record, sentences, tierOpen, topTier, mastered, ITEMS, COMMON, dropItem, RECIPES, findRecipe, shuffle,
    lvl, bumpLevel, tierCap, DECOR, openGift, COLORS, WALLS,
  };
})();
