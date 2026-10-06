// Game controller: loop, map actions (fix castles, bridges, fight dragons, decorations), gentle tutorial, finale.
(function () {
  const { h, icon, wait } = UI;
  const S = ST.load();
  if (S.rate) AUD.settings.rate = S.rate;
  if (S.sound === false) { AUD.settings.music = false; AUD.settings.sfx = false; }
  const W = WORLD;
  const an = w => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;

  // ── map hooks ────────────────────────────────────────────────────────
  W.hooks.castleReady = i => S.castles[i] < 3 && S.gems >= ST.CASTLE_COST[i][S.castles[i]];
  W.hooks.isleReady = i => S.isles[i].won && S.isles[i].castle < 3 && S.gems >= ST.ISLE_CASTLE_COST[S.isles[i].castle];
  W.hooks.hover = (o, x, y) => {
    if (!o) return UI.tip(null);
    const label = o.type === 'cre' ? (o.c.name || o.c.kind) : o.type === 'hero' ? SPR.HEROES[S.hero].name : o.type === 'visitor' ? o.v.word : o.label;
    UI.tip(label, x, y);
  };
  W.hooks.click = o => {
    AUD.sfx('tap');
    if (o.type === 'visitor') return visitorAction(o.v);
    if (UI.moving) {
      if (o.type === 'decor') return GAMES.pickToMove(o.i);
      if (o.type === 'cre' && o.c.decor !== undefined) return GAMES.pickToMove(o.c.decor);
      return;
    }
    if (o.type === 'castle') return castleAction(o.i);
    if (o.type === 'sign') return bridgeAction(o.i);
    if (o.type === 'isle') return isleAction(o.i);
    if (o.type === 'decor') return decorAction(o);
    if (o.type === 'cre') { const n = o.c.name || o.c.kind; AUD.say(n); W.burst(o.c.x, o.c.y - 8, 8, ['#ff8ccf', '#ffffff'], 18); return; }
    if (o.type === 'hero') return GAMES.camp();
    if (o.label) AUD.say(o.label);
  };

  const castleNames = ['Red Castle', 'Blue Castle', 'Purple Castle'];
  const paintBtn = (kind, i) => h('button', { class: 'btn blue', style: 'font-size:28px', onclick: () => { AUD.sfx('tap'); GAMES.paint(kind, i); } }, icon('🎨', 30), 'Paint');
  function castleAction(i) {
    const L = S.castles[i], c = W.CASTLES[i];
    if (L >= 3) {
      AUD.say('The castle is fixed!');
      return UI.panel({ title: castleNames[i], text: 'The castle is fixed!', he: 'הטירה מתוקנת! רוצה לצבוע אותה?', art: icon('🏰', 110), secondary: paintBtn('castle', i) });
    }
    const cost = ST.CASTLE_COST[i][L];
    UI.panel({
      title: castleNames[i], text: L === 0 ? 'Fix the castle!' : 'Make the castle big!', he: L === 0 ? 'תקן את הטירה!' : 'תגדיל את הטירה!',
      art: h('div', { class: 'row', style: 'gap:20px' }, icon('🏰', 110), icon('🔨', 64)), cost, btn: L === 0 ? 'Fix' : 'Build',
      secondary: L >= 1 ? paintBtn('castle', i) : null,
      onYes: () => {
        if (!UI.spend(cost)) return;
        W.goTo(c.x + 14, c.y + 4, -1, async () => {
          W.hero.flip = true;
          for (let k = 0; k < 5; k++) { W.hero.busy = 0.2; AUD.sfx('hammer'); W.burst(c.x + 4, c.y - 6, 8, ['#ffd262', '#ffffff', '#8a86a0'], 26); await wait(260); }
          S.castles[i]++; ST.save();
          W.burst(c.x, c.y - 16, 60, ['#ffd262', '#ffffff', '#3fd08a', '#ff8ccf'], 50);
          AUD.sfx('win');
          W.refresh(); UI.updateHud();
          const egg = ['eggFox', 'eggCat', 'eggDragon'][i];
          S.items[egg] = (S.items[egg] || 0) + 1; ST.save(); UI.updateBadges();
          UI.toast(S.castles[i] === 1 ? 'The castle is fixed!' : 'The castle is bigger!', '🏰');
          setTimeout(() => UI.toast('You got ' + an(ST.ITEMS[egg].word) + '!', null, true), 1800);
          await wait(2600);
          await openBridges();
          nextTip();
        });
      },
    });
  }
  function bridgeAction(i) {
    const I = W.ISLES[i];
    if (S.bridges[i]) return;
    const text = i === 0 ? 'Fix a castle. Then the bridge opens!' : 'Beat the dragon on ' + W.ISLES[i - 1].name + '. Then the bridge opens!';
    const he = i === 0 ? 'תקן טירה אחת, והגשר ייפתח!' : 'נצח את הדרקון באי הקודם, והגשר ייפתח!';
    UI.panel({ title: 'Bridge to ' + I.name, text, he, art: h('div', { class: 'row', style: 'gap:14px' }, icon('🌉', 100), icon(i === 0 ? '🏰' : '🐉', 80)) });
  }
  // bridges build themselves once they are open (after the first castle, and after each dragon)
  let building = false;
  async function openBridges() {
    if (building) return;
    building = true;
    for (let i = 0; i < 4; i++) {
      if (S.bridges[i] || !ST.bridgeOpen(i)) continue;
      const I = W.ISLES[i], [a, b] = I.bridge;
      W.centerOn((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      await wait(700);
      S.bridges[i] = true; W.bridgeAnim[i] = 0; ST.save();
      W.refresh(); UI.updateHud();
      for (let k = 0; k < 8; k++) { AUD.sfx('hammer'); await wait(200); }
      AUD.sfx('win');
      UI.toast('A bridge to ' + I.name + '!', '🌉');
      await wait(1600);
      AUD.sfx('roar');
      UI.toast(I.boss.name + ' the dragon is angry!', '🐉');
      W.centerOn(I.cx, I.cy);
      await wait(1800);
    }
    building = false;
  }
  function isleAction(i) {
    const I = W.ISLES[i], st = S.isles[i];
    if (!S.bridges[i]) return bridgeAction(i);
    if (!st.won) {
      const art = SPR.img(SPR.boss(BATTLE.BOSS_PAL[I.boss.elem], 0), 4);
      art.style.animation = 'float 1.5s ease-in-out infinite';
      const hearts = BATTLE.hearts(S.heroLv[S.hero]);
      return UI.panel({
        title: I.name, art, text: I.boss.name + ' lives here. Fight!', he: `דרקון רע גר כאן. יש לך ${hearts} לבבות. תענה נכון ומהר!`, btn: 'Fight!',
        onYes: () => W.goTo(I.cx - 8, I.cy + 6, i, () => BATTLE.battle(i, () => afterWin(i))),
      });
    }
    if (st.castle >= 3) { AUD.say(I.name); return UI.panel({ title: I.name, text: I.name + ' is happy!', art: icon('💖', 90), secondary: paintBtn('isle', i) }); }
    const cost = ST.ISLE_CASTLE_COST[st.castle];
    UI.panel({
      title: I.name, text: st.castle === 0 ? 'Build a castle here!' : 'Make the castle big!', he: 'בנה כאן טירה!', art: icon('🏰', 110), cost, btn: 'Build',
      secondary: st.castle >= 1 ? paintBtn('isle', i) : null,
      onYes: () => {
        if (!UI.spend(cost)) return;
        W.goTo(I.cx + 12, I.cy + 8, i, async () => {
          W.hero.flip = true;
          for (let k = 0; k < 5; k++) { W.hero.busy = .2; AUD.sfx('hammer'); W.burst(I.cx, I.cy - 4, 8, ['#ffd262', '#ffffff'], 24); await wait(260); }
          st.castle++; ST.save();
          W.burst(I.cx, I.cy - 12, 60, ['#ffd262', '#ffffff', '#3fd08a', '#ff8ccf'], 50);
          AUD.sfx('win'); W.refresh(); UI.updateHud();
          UI.toast('More animals came!', '🦊');
          checkFinale();
        });
      },
    });
  }
  async function afterWin(i) {
    W.refresh(); UI.updateHud();
    UI.toast('You saved ' + W.ISLES[i].name + '!', '🎉');
    checkFinale();
    await wait(2400);
    await openBridges();
    nextTip();
  }

  // ── decorations, gifts and surprise visitors ───────────────────────
  function decorAction(o) {
    const D = ST.DECOR[o.k];
    if (D.gift) return GAMES.openGiftAt(o.i);
    AUD.say(an(D.word) + '!');
    W.surprise(o.i);
    AUD.sfx('pop');
  }
  function visitorAction(v) {
    const n = 1 + Math.floor(Math.random() * 3);
    W.catchVisitor(v);
    AUD.sfx('magic');
    const [sx, sy] = W.toScreen(v.x, v.y - 8);
    if (Math.random() < 0.08) {
      const item = ST.dropItem(0.3); S.items[item] = (S.items[item] || 0) + 1; ST.save(); UI.updateBadges();
      UI.toast(`${an(v.word)}! You got ${an(ST.ITEMS[item].word)}!`, ST.ITEMS[item].pic || '🥚');
    } else {
      UI.addGems(n, [sx, sy]);
      UI.toast(`${an(v.word)}! +${n} gems`, v.pic);
    }
  }

  // ── dock ─────────────────────────────────────────────────────────────
  UI.onDock = id => {
    W.stopPlace(); UI.placeBar(null); UI.moving = false;
    const map = { play: GAMES.session, hatch: GAMES.hatch, decor: GAMES.decorate, hero: GAMES.camp };
    map[id] && map[id]();
  };
  UI.afterClose = () => { AUD.music('world'); UI.updateHud(); UI.updateBadges(); UI.dock(); nextTip(); };

  // ── gentle tutorial: a pointing hand at the next useful thing ────────
  function nextTip() {
    if (UI.isOpen() || W.placing) return;
    const cheapest = [0, 1, 2].filter(i => S.castles[i] < 3).sort((a, b) => ST.CASTLE_COST[a][S.castles[a]] - ST.CASTLE_COST[b][S.castles[b]])[0];
    const fight = [0, 1, 2, 3].find(i => S.bridges[i] && !S.isles[i].won);
    const mixes = GAMES.possibleMixes();
    if (S.rounds === 0) return UI.hand(document.getElementById('dk-play'));
    if (cheapest !== undefined && S.gems >= ST.CASTLE_COST[cheapest][S.castles[cheapest]] && ST.castleLevels() < 2) { const c = W.CASTLES[cheapest]; W.focus(c.x, c.y - 20); return UI.hand([c.x, c.y - 36]); }
    if (mixes && !Object.keys(S.found).length) return UI.hand(document.getElementById('dk-hatch'));
    if (fight !== undefined && (S.tipFight || 0) < fight + 1) { S.tipFight = fight + 1; const I = W.ISLES[fight]; W.focus(I.cx, I.cy - 20); return UI.hand([I.cx, I.cy - 30]); }
    if (!S.decor.length && S.gems >= 30 && S.rounds >= 6) return UI.hand(document.getElementById('dk-decor'));
    UI.hand(null);
  }
  window.GAME = { afterGame: nextTip, openBridges };

  // ── finale ───────────────────────────────────────────────────────────
  function checkFinale() {
    if (S.finale || !S.isles.every(x => x.won)) return;
    S.finale = true; ST.save();
    setTimeout(() => {
      FX.confetti(300); AUD.sfx('win');
      const line = 'You saved the Lava Isles! The foxes, cats and dragons are happy!';
      const row = h('div', { class: 'row', style: 'gap:10px' }, ...['fox', 'cat', 'dragon'].map(k => SPR.img(SPR.creature(k, 'gold', 0), 10)));
      UI.open(h('div', { class: 'screen frame narrow', style: 'align-items:center;gap:24px;padding:34px;width:min(900px,94vw)' },
        h('div', { class: 'logo', style: 'font-size:70px' }, 'THE END?'), row,
        h('div', { class: 'row' }, h('div', { class: 'word say', 'data-say': line, style: 'font-size:38px;text-align:center' }, line), UI.speakBtn(line)),
        h('div', { class: 'word', style: 'font-size:24px;color:#c8b8d8' }, 'Keep playing: fix every castle, find every rare animal, decorate, master every word!'),
        h('button', { class: 'btn green', onclick: () => UI.close() }, 'Yay!')));
      AUD.say(line);
    }, 2500);
  }

  // ── loop ─────────────────────────────────────────────────────────────
  let last = performance.now(), secT = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    W.update(dt); W.draw(dt);
    UI.tickHand();
    secT += dt; if (secT > 10) { S.seconds += Math.round(secT); secT = 0; ST.save(); }
    requestAnimationFrame(loop);
  }

  // ── boot ─────────────────────────────────────────────────────────────
  W.init(document.getElementById('world'));
  requestAnimationFrame(loop);
  UI.title(() => {
    AUD.music('world');
    const enter = () => {
      document.getElementById('hud').classList.remove('hidden');
      document.getElementById('dock').classList.remove('hidden');
      UI.hud(); UI.dock(); nextTip();
      if (!S.started) { S.started = true; ST.save(); }
      else UI.toast('Welcome back, ' + SPR.HEROES[S.hero].name + '!', null);
      // saves from before: open the bridges that should be open now
      setTimeout(() => openBridges().then(nextTip), 1500);
    };
    if (!S.started) UI.heroPick(() => UI.story(enter));
    else enter();
  });
})();
