// Voice (text-to-speech + speech recognition), chiptune music and sound effects. All generated in the browser.
(function () {
  const A = {};
  let ctx = null, master, musicBus, sfxBus;
  A.settings = { music: true, sfx: true, rate: 0.8 };

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = A.settings.music ? 0.33 : 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = A.settings.sfx ? 0.6 : 0; sfxBus.connect(master);
    return ctx;
  }
  A.unlock = ensure;
  A.setMusic = on => { A.settings.music = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.33 : 0, ctx.currentTime, 0.1); };
  A.setSfx = on => { A.settings.sfx = on; if (sfxBus) sfxBus.gain.value = on ? 0.6 : 0; };

  // ── voice ─────────────────────────────────────────────────────────────
  let voice = null;
  function pickVoice() {
    const vs = speechSynthesis.getVoices().filter(v => /^en[-_]/i.test(v.lang));
    if (!vs.length) return;
    const pref = [/aria.*natural/i, /jenny.*natural/i, /ana.*natural/i, /natural/i, /google us english/i, /samantha/i, /zira/i, /en-US/i];
    for (const re of pref) { const v = vs.find(v => re.test(v.name) || re.test(v.lang)); if (v) { voice = v; return; } }
    voice = vs[0];
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  A.hasVoice = () => !!window.speechSynthesis;

  let duckT = 0;
  A.say = function (text, opts) {
    opts = opts || {};
    return new Promise(res => {
      if (!window.speechSynthesis) return res();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.lang = 'en-US';
      u.rate = (opts.rate || 1) * A.settings.rate;
      u.pitch = opts.pitch || 1.1;
      // lower the music while the voice talks
      if (musicBus && A.settings.music) { musicBus.gain.setTargetAtTime(0.1, ctx.currentTime, 0.05); clearTimeout(duckT); }
      const done = () => {
        if (musicBus && A.settings.music) duckT = setTimeout(() => musicBus.gain.setTargetAtTime(0.33, ctx.currentTime, 0.3), 250);
        res();
      };
      u.onend = done; u.onerror = done;
      setTimeout(done, 1500 + text.length * 160); // safety: some voices never fire onend
      speechSynthesis.speak(u);
    });
  };

  // ── speech recognition (reading out loud) ────────────────────────────
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  A.canListen = () => !!SR && location.protocol !== 'file:';
  const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  function lev(a, b) {
    const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  const NUM = { '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten', 'to': 'two', 'too': 'two', 'for': 'four', 'won': 'one' };
  // how much of the target did the child say? (0..1), lenient for a young accent
  A.score = function (target, heard) {
    const t = norm(target).split(' '), h = norm(heard).split(' ').map(w => NUM[w] || w);
    let hit = 0;
    t.forEach(tw => {
      const tw2 = NUM[tw] || tw;
      if (h.some(hw => hw === tw2 || (tw2.length > 3 && lev(hw, tw2) <= Math.floor(tw2.length / 3)))) hit++;
    });
    return hit / t.length;
  };
  A.listen = function (target, onInterim) {
    return new Promise(res => {
      if (!SR) return res({ ok: false, heard: '', error: 'unsupported' });
      const r = new SR();
      r.lang = 'en-US'; r.interimResults = true; r.maxAlternatives = 5; r.continuous = false;
      let best = { score: 0, heard: '' }, finished = false;
      const finish = (err) => { if (finished) return; finished = true; try { r.stop(); } catch (e) { } res({ ok: best.score >= 0.7, score: best.score, heard: best.heard, error: err }); };
      r.onresult = e => {
        for (let i = 0; i < e.results.length; i++) {
          const res_ = e.results[i];
          for (let k = 0; k < res_.length; k++) {
            const heard = res_[k].transcript, sc = A.score(target, heard);
            if (sc > best.score || !best.heard) best = { score: sc, heard };
          }
        }
        onInterim && onInterim(best.heard, best.score);
        if (best.score >= 1) finish();
      };
      r.onerror = e => finish(e.error);
      r.onend = () => finish();
      if (musicBus) musicBus.gain.setTargetAtTime(0.03, ctx.currentTime, 0.05);
      try { r.start(); } catch (e) { finish('start'); }
      setTimeout(() => finish('timeout'), 7000);
    }).then(v => { if (musicBus && A.settings.music) musicBus.gain.setTargetAtTime(0.33, ctx.currentTime, 0.3); return v; });
  };

  // ── synth helpers ─────────────────────────────────────────────────────
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  function tone(bus, t, f, dur, type, vol, slide, attack) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + dur);
    const a = attack || 0.005;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }
  let noiseBuf = null;
  function noise(bus, t, dur, vol, hp) {
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = noiseBuf; f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = hp || 1200;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.02);
  }

  // ── sound effects ─────────────────────────────────────────────────────
  const SFX = {
    tap: t => tone(sfxBus, t, 880, 0.06, 'square', 0.12, 1.5),
    pick: (t, i) => tone(sfxBus, t, midi(72 + [0, 2, 4, 7, 9, 12, 14, 16][Math.min(7, i || 0)]), 0.1, 'square', 0.13),
    good: t => [72, 76, 79, 84].forEach((n, i) => tone(sfxBus, t + i * 0.07, midi(n), 0.16, 'square', 0.12)),
    bad: t => { tone(sfxBus, t, 220, 0.18, 'triangle', 0.25, 0.7); tone(sfxBus, t + 0.12, 185, 0.22, 'triangle', 0.22, 0.7); },
    coin: t => { tone(sfxBus, t, midi(88), 0.06, 'square', 0.1); tone(sfxBus, t + 0.06, midi(93), 0.18, 'square', 0.1); },
    hammer: t => { noise(sfxBus, t, 0.08, 0.5, 600); tone(sfxBus, t, 160, 0.08, 'square', 0.18, 0.5); },
    whoosh: t => noise(sfxBus, t, 0.35, 0.25, 900),
    boom: t => { noise(sfxBus, t, 0.6, 0.7); tone(sfxBus, t, 110, 0.5, 'sawtooth', 0.25, 0.3); },
    magic: t => { for (let i = 0; i < 8; i++) tone(sfxBus, t + i * 0.04, midi(84 + i * 2), 0.12, 'triangle', 0.08); },
    hatch: t => { noise(sfxBus, t, 0.1, 0.4, 2000); [79, 83, 86, 91, 95].forEach((n, i) => tone(sfxBus, t + 0.1 + i * 0.08, midi(n), 0.25, 'triangle', 0.12)); },
    win: t => { [[72, 0], [76, .12], [79, .24], [84, .36], [79, .54], [84, .66]].forEach(([n, d]) => { tone(sfxBus, t + d, midi(n), 0.3, 'square', 0.12); tone(sfxBus, t + d, midi(n - 12), 0.3, 'triangle', 0.15); }); },
    roar: t => { tone(sfxBus, t, 90, 0.7, 'sawtooth', 0.3, 0.6, 0.05); noise(sfxBus, t, 0.7, 0.35); },
    bubble: t => tone(sfxBus, t, 300 + Math.random() * 300, 0.12, 'sine', 0.2, 2.2),
    pop: t => tone(sfxBus, t, 600, 0.08, 'sine', 0.3, 0.3),
  };
  A.sfx = function (name, arg) { if (!A.settings.sfx) return; ensure(); SFX[name] && SFX[name](ctx.currentTime + 0.01, arg); };

  // ── music: small cosy chiptune loops, scheduled ahead ────────────────
  const SONGS = {
    world: { bpm: 84, prog: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]],
      mel: [76, -1, 79, 76, 74, -1, 72, -1, 74, 76, -1, 72, 69, -1, -1, -1, 72, -1, 74, 72, 69, -1, 67, -1, 71, -1, 74, 72, 71, -1, -1, -1] },
    game: { bpm: 108, prog: [[60, 64, 67, 72], [65, 69, 72, 76], [57, 60, 64, 69], [55, 59, 62, 67]],
      mel: [72, 74, 76, -1, 79, -1, 76, -1, 77, 76, 74, -1, 72, -1, -1, -1, 69, 71, 72, -1, 76, -1, 74, -1, 71, 72, 74, -1, 67, -1, -1, -1] },
    battle: { bpm: 132, prog: [[57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67], [52, 56, 59, 64]],
      mel: [69, -1, 72, 69, 76, -1, 74, 72, 71, -1, 72, 74, 76, -1, -1, -1, 69, -1, 72, 69, 77, -1, 76, 74, 76, -1, 74, 71, 69, -1, -1, -1] },
  };
  let song = null, step = 0, nextT = 0, timer = null;
  A.music = function (name) {
    ensure();
    if (song === SONGS[name]) return;
    song = SONGS[name] || null; step = 0; nextT = ctx.currentTime + 0.1;
    if (!timer) timer = setInterval(tick, 50);
  };
  function tick() {
    if (!song || !ctx) return;
    const s8 = 60 / song.bpm / 2; // eighth notes
    while (nextT < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % 4, chord = song.prog[bar], i = step % 8;
      // soft arpeggio
      tone(musicBus, nextT, midi(chord[[0, 1, 2, 3, 2, 1, 2, 3][i]] + 12), s8 * 0.9, 'triangle', 0.07);
      // bass on the beat
      if (i % 4 === 0) tone(musicBus, nextT, midi(chord[0] - 24), s8 * 3.5, 'triangle', 0.22, null, 0.02);
      if (i === 2 || i === 6) tone(musicBus, nextT, midi(chord[0] - 12), s8 * 1.2, 'triangle', 0.08);
      // lead melody
      const n = song.mel[step % song.mel.length];
      if (n > 0) { tone(musicBus, nextT, midi(n), s8 * 1.7, 'square', 0.035, null, 0.02); tone(musicBus, nextT + 0.012, midi(n) * 1.004, s8 * 1.6, 'square', 0.018); }
      // light hats
      if (i % 2 === 1) noise(musicBus, nextT, 0.03, 0.05, 6000);
      if (song === SONGS.battle && i % 4 === 0) noise(musicBus, nextT, 0.12, 0.2, 0);
      nextT += s8; step++;
    }
  }

  window.AUD = A;
})();
