// Game Net sound: effects and music are made in code with Web Audio, so there are no sound files to load.
// Phones only allow sound after a tap, so the first tap or key press anywhere in the game wakes it up.
// iPhones also go quiet when the ring/silent switch is on silent. Asking for "playback" audio (iOS 17+),
// or playing a silent loop on older iPhones, makes the game sound like a video does instead.
// One setting for every game: 'all' (music and effects), 'fx' (effects only) or 'off'.
(function () {
  const KEY = 'gamenet-sound', MODES = ['all', 'fx', 'off'];
  let mode = 'all';
  try { const m = localStorage.getItem(KEY); if (MODES.includes(m)) mode = m; } catch (e) {}
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let ctx = null, master, fxBus, musicBus, verbIn, keepAlive = null;
  const buttons = [];

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return false; } }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .2;
    master = ctx.createGain(); master.gain.value = .9;
    master.connect(comp); comp.connect(ctx.destination);
    fxBus = ctx.createGain(); fxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = mode === 'all' && songOn ? 1 : 0; musicBus.connect(master);
    // a soft room echo shared by everything that asks for it
    const verb = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir; verbIn = ctx.createGain(); verbIn.gain.value = .5;
    verbIn.connect(verb); verb.connect(master);
    return true;
  }

  // a short silent WAV, made here so nothing has to download
  function silentLoop() {
    const n = 4000, b = new ArrayBuffer(44 + n), v = new DataView(b);
    const s = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    s(0, 'RIFF'); v.setUint32(4, 36 + n, true); s(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); s(36, 'data'); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    const a = document.createElement('audio');
    a.src = URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
    a.loop = true; a.setAttribute('playsinline', ''); a.setAttribute('x-webkit-airplay', 'deny'); a.preload = 'auto';
    return a;
  }

  function unlock() {
    if (mode === 'off') return;
    if (!ctx && !build()) return;
    try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) {}
    if (IOS && !navigator.audioSession) {
      if (!keepAlive) keepAlive = silentLoop();
      if (keepAlive.paused) keepAlive.play().catch(() => {});
    }
    if (ctx.state !== 'running') {
      ctx.resume().catch(() => {});
      // older iPhones also want a sound started inside the tap itself
      try { const src = ctx.createBufferSource(); src.buffer = ctx.createBuffer(1, 1, 22050); src.connect(ctx.destination); src.start(0); } catch (e) {}
    }
  }
  ['pointerdown', 'pointerup', 'touchend', 'mousedown', 'click', 'keydown'].forEach(t => addEventListener(t, unlock, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { ctx.suspend().catch(() => {}); if (keepAlive) keepAlive.pause(); }
    else if (mode !== 'off') { ctx.resume().catch(() => {}); if (keepAlive) keepAlive.play().catch(() => {}); }
  });
  addEventListener('pagehide', () => { if (ctx) ctx.suspend().catch(() => {}); if (keepAlive) keepAlive.pause(); });

  const live = () => ctx && ctx.state === 'running' && !document.hidden;
  const busOf = o => (o && o.bus === 'music') ? musicBus : fxBus;

  // envelope + optional echo send + optional pan, then on to a bus
  function chain(node, o, t, dur) {
    const g = ctx.createGain(), vol = o.vol == null ? .2 : o.vol, a = o.attack || .004;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    node.connect(g);
    let end = g;
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; g.connect(p); end = p; }
    end.connect(busOf(o));
    if (o.verb) { const s = ctx.createGain(); s.gain.value = o.verb; end.connect(s); s.connect(verbIn); }
  }

  // a plain tone that can glide: tone(440, .2, {type:'triangle', to:220, vol:.2, at:0})
  function tone(freq, dur, o = {}) {
    if (!live()) return;
    const t = ctx.currentTime + (o.at || 0), osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
    if (o.detune) osc.detune.value = o.detune;
    chain(osc, o, t, dur); osc.start(t); osc.stop(t + dur + .05);
  }

  let noiseBuf = null;
  // filtered noise for hits, swishes, crunches and booms: noise(.3, {filter:'lowpass', freq:900, to:80})
  function noise(dur, o = {}) {
    if (!live()) return;
    if (!noiseBuf) { const n = ctx.sampleRate; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    const t = ctx.currentTime + (o.at || 0), src = ctx.createBufferSource(), f = ctx.createBiquadFilter();
    src.buffer = noiseBuf; src.loop = true;
    f.type = o.filter || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.freq || 1200, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
    src.connect(f); chain(f, o, t, dur);
    src.start(t, Math.random()); src.stop(t + dur + .05);
  }

  // plucked string (Karplus-Strong), cached per pitch: santur, dutar, kalimba-like notes.
  // Made at 22 kHz (plenty for a plucked string) so a new note costs well under a millisecond on a phone.
  const strings = new Map();
  function stringBuf(freq, dur, bright, damp) {
    const key = Math.round(freq * 10) + '|' + dur + '|' + bright + '|' + damp;
    let b = strings.get(key);
    if (b) return b;
    const sr = 22050, n = Math.floor(sr * dur), y = new Float32Array(n), k = Math.pow(damp, ctx.sampleRate / sr);
    const per = sr / freq, P = Math.max(2, Math.floor(per)), w = per - P;
    let lp = 0, peak = 0;
    for (let i = 0; i < P + 1 && i < n; i++) { lp += (Math.random() * 2 - 1 - lp) * bright; y[i] = lp; peak = Math.max(peak, Math.abs(lp)); }
    const g = peak > 0 ? 1 / peak : 1;
    for (let i = 0; i < P + 1 && i < n; i++) y[i] *= g;
    for (let i = P + 1; i < n; i++) y[i] = k * ((1 - w) * y[i - P] + w * y[i - P - 1]);
    b = ctx.createBuffer(1, n, sr); b.getChannelData(0).set(y);
    if (strings.size > 120) strings.clear();
    strings.set(key, b); return b;
  }
  function pluck(freq, dur, o = {}) {
    if (!live()) return;
    const t = ctx.currentTime + (o.at || 0), src = ctx.createBufferSource();
    src.buffer = stringBuf(freq, dur, o.bright == null ? .6 : o.bright, o.damp || .996);
    if (o.rate) src.playbackRate.value = o.rate;
    chain(src, Object.assign({ attack: .001 }, o), t, dur); src.start(t); src.stop(t + dur + .05);
  }

  // background music: a step function called for every beat a little ahead of time.
  // music({beat:.25, step(i, at){ ... call tone/pluck/noise with {at, bus:'music'} ... }})
  let song = null, songOn = false, nextAt = 0, beatN = 0;
  function music(s) { song = s; beatN = 0; nextAt = 0; }
  function play(on) {
    songOn = !!on;
    if (!ctx) return;
    const t = ctx.currentTime, g = musicBus.gain, want = songOn && mode === 'all' ? 1 : 0;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(want, t + (want ? .6 : .8));
  }
  setInterval(() => {
    if (!song || !songOn || mode !== 'all' || !live()) { nextAt = 0; return; }
    const now = ctx.currentTime;
    if (!nextAt || nextAt < now) nextAt = now + .05;
    while (nextAt < now + .3) {
      try { song.step(beatN, nextAt - now); } catch (e) {}
      beatN++; nextAt += song.beat;
    }
  }, 60);

  // speaker button: cycles music + effects → effects only → off
  const ICON = {
    all: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    fx: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    off: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };
  const LABEL = { all: 'Sound: music and effects', fx: 'Sound: effects only', off: 'Sound off' };
  function paint() { buttons.forEach(b => { b.innerHTML = ICON[mode]; b.setAttribute('aria-label', LABEL[mode]); b.title = LABEL[mode]; }); }
  function setMode(m) {
    mode = m;
    try { localStorage.setItem(KEY, m); } catch (e) {}
    if (m === 'off') { if (ctx) ctx.suspend().catch(() => {}); if (keepAlive) keepAlive.pause(); }
    else unlock();
    play(songOn); paint();
  }
  function button(el) {
    buttons.push(el);
    // the games listen for taps on the whole page; a tap on this button is only for the sound
    ['pointerdown', 'touchstart', 'mousedown'].forEach(t => el.addEventListener(t, e => e.stopPropagation()));
    el.addEventListener('click', e => { e.stopPropagation(); setMode(MODES[(MODES.indexOf(mode) + 1) % 3]); if (mode !== 'off' && ctx) ctx.resume().then(() => tone(880, .12, { vol: .12 }), () => {}); el.blur(); });
    el.addEventListener('keydown', e => e.stopPropagation());
    paint(); return el;
  }

  window.GameSound = {
    tone, noise, pluck, music, play, button, unlock,
    get mode() { return mode; },
    get ctx() { return ctx; },
    // pitch of scale step n (any whole number), from a base frequency and a list of semitones in one octave
    note(base, scale, n) { const o = Math.floor(n / scale.length), k = ((n % scale.length) + scale.length) % scale.length; return base * Math.pow(2, o + scale[k] / 12); },
  };
})();
