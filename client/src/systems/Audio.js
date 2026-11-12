// Trilha e efeitos 100% procedurais com Web Audio (ADR-007).
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const PROGRESSION = [
  { root: 50, q: [0, 4, 7] }, // D
  { root: 55, q: [0, 4, 7] }, // G
  { root: 57, q: [0, 4, 7] }, // A
  { root: 50, q: [0, 4, 7] }, // D
  { root: 59, q: [0, 3, 7] }, // Bm
  { root: 55, q: [0, 4, 7] }, // G
  { root: 52, q: [0, 3, 7] }, // Em
  { root: 57, q: [0, 4, 7] }, // A
];
const MELODY = [
  [69, 74, 74, 76],
  [78, 76, 74, null],
  [73, 76, 81, 79],
  [78, null, 74, null],
  [74, 78, 83, 81],
  [79, 78, 76, 74],
  [76, 79, 78, 76],
  [73, null, 76, 81],
];

export class Audio {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.intensity = 0;
    this.targetIntensity = 0;
    this.musicOn = (() => {
      try {
        return localStorage.getItem('anahering.music') !== 'off';
      } catch {
        return true;
      }
    })();
    this.bar = 0;
    this.nextBarTime = 0;
    this.lastStep = 0;
    game.events.on('queen:step', ({ run }) => this.step(run));
    game.events.on('queen:jump', () => this.sfx('jump'));
    game.events.on('quest:step', () => this.sfx('chime'));
    game.events.on('quest:progress', () => this.sfx('chime'));
    game.events.on('quest:completed', () => {
      this.fanfare();
      setTimeout(() => this.sfx('chime'), 900);
    });
    game.events.on('tribute:collected', () => this.sfx('pickup'));
    game.events.on('title:new', () => setTimeout(() => this.fanfare(), 1200));
    game.events.on('queen:wave', () => this.applause(1.5, 0.35));
    game.events.on('zone:enter', ({ id }) => {
      if (id === 'plaza' || id === 'throne_hall') this.applause(2.5, 0.5);
    });
  }

  /** Precisa ser chamado num gesto do usuário. */
  init() {
    if (this.ctx) return this.ctx.resume();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.gain.value = this.musicOn ? 0.32 : 0;
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.7;
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.music.connect(this.master);
    this.music.connect(this.reverb);
    this.sfxBus.connect(this.master);
    this.sfxBus.connect(this.reverb);
    this.reverb.connect(wet).connect(this.master);
    this.noise = this._noiseBuffer(2);
    this.nextBarTime = ctx.currentTime + 0.2;
    this.timer = setInterval(() => this._schedule(), 60);
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    try {
      localStorage.setItem('anahering.music', this.musicOn ? 'on' : 'off');
    } catch {
      /* ignora */
    }
    if (this.music) this.music.gain.setTargetAtTime(this.musicOn ? 0.32 : 0, this.ctx.currentTime, 0.3);
    return this.musicOn;
  }

  setIntensity(v) {
    this.targetIntensity = v;
  }

  // ---------- utilidades
  _impulse(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }
  _noiseBuffer(seconds) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  _env(gain, t, a, peak, hold, rel) {
    const g = gain.gain;
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(peak, t + a);
    g.setValueAtTime(peak, t + a + hold);
    g.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  }

  /** Voz sintetizada genérica. */
  _voice(dest, { freq, t, dur, type = 'sawtooth', vol = 0.1, attack = 0.02, release = 0.3, cutoff = 2000, cutoffEnv = 0, detune = 0, unison = 1 }) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(cutoff, t);
    if (cutoffEnv) {
      f.frequency.linearRampToValueAtTime(cutoff + cutoffEnv, t + attack + 0.05);
      f.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.7), t + dur);
    }
    for (let u = 0; u < unison; u++) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune * (u - (unison - 1) / 2);
      o.connect(f);
      o.start(t);
      o.stop(t + dur + release + 0.1);
    }
    f.connect(g).connect(dest);
    this._env(g, t, attack, vol, Math.max(0, dur - attack), release);
  }

  _timpani(t, midi, vol = 0.5) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(mtof(midi) * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(mtof(midi), t + 0.08);
    o.connect(g).connect(this.music);
    this._env(g, t, 0.005, vol, 0.05, 1.2);
    o.start(t);
    o.stop(t + 1.5);
    // ataque de pele
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 600;
    const ng = ctx.createGain();
    n.connect(nf).connect(ng).connect(this.music);
    this._env(ng, t, 0.002, vol * 0.4, 0.01, 0.15);
    n.start(t, Math.random());
    n.stop(t + 0.3);
  }

  _bell(dest, t, midi, vol = 0.06) {
    for (const [mul, v, d] of [[1, 1, 1.8], [2.76, 0.4, 0.9], [5.4, 0.2, 0.5]]) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = mtof(midi) * mul;
      o.connect(g).connect(dest);
      this._env(g, t, 0.003, vol * v, 0, d);
      o.start(t);
      o.stop(t + d + 0.1);
    }
  }

  // ---------- música
  _schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    this.intensity += (this.targetIntensity - this.intensity) * 0.05;
    const beat = 60 / (76 + this.intensity * 14);
    while (this.nextBarTime < ctx.currentTime + 0.4) {
      this._playBar(this.nextBarTime, beat);
      this.nextBarTime += beat * 4;
      this.bar++;
    }
  }

  _playBar(t, beat) {
    const i = this.bar % 8;
    const cycle = Math.floor(this.bar / 8);
    const ch = PROGRESSION[i];
    const I = this.intensity;
    const dest = this.music;
    const notes = ch.q.map((x) => ch.root + 12 + x);

    // cordas (pad)
    for (const n of [...notes, ch.root + 24]) {
      this._voice(dest, { freq: mtof(n), t, dur: beat * 4, type: 'sawtooth', vol: 0.028, attack: 0.5, release: 0.8, cutoff: 900 + I * 900, detune: 10, unison: 2 });
    }
    // baixo
    for (const b of [0, 2]) this._voice(dest, { freq: mtof(ch.root - 12), t: t + b * beat, dur: beat * 1.6, type: 'triangle', vol: 0.12, attack: 0.02, release: 0.3, cutoff: 600 });
    // tímpanos
    this._timpani(t, ch.root - 12, 0.35 + I * 0.25);
    if (I > 0.5 || i === 7) {
      for (let k = 0; k < 6; k++) this._timpani(t + beat * 3 + (k * beat) / 6, ch.root - 12, 0.12 + k * 0.03);
    }
    // metais: acordes em ciclos alternados (e sempre na cerimônia)
    if (cycle % 2 === 1 || I > 0.4) {
      for (const n of notes)
        this._voice(dest, { freq: mtof(n), t, dur: beat * 1.5, type: 'sawtooth', vol: 0.04 + I * 0.03, attack: 0.04, release: 0.4, cutoff: 700, cutoffEnv: 1800 + I * 1500 });
    }
    // melodia de trompa
    const mel = MELODY[i];
    const melOn = cycle % 3 !== 2 || I > 0.4;
    if (melOn) {
      mel.forEach((m, k) => {
        if (m == null) return;
        const len = mel[k + 1] === null ? beat * 1.8 : beat * 0.9;
        this._voice(dest, {
          freq: mtof(m - (I > 0.5 ? 0 : 12)),
          t: t + k * beat,
          dur: len,
          type: 'sawtooth',
          vol: 0.05 + I * 0.04,
          attack: 0.05,
          release: 0.35,
          cutoff: 900,
          cutoffEnv: 1200 + I * 1600,
          detune: 6,
          unison: 2,
        });
      });
    }
    // sinos cintilantes
    if (i % 2 === 0) this._bell(dest, t + beat * 3.5, notes[(this.bar * 7) % 3] + 24, 0.05);
  }

  // ---------- efeitos
  fanfare() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + 0.05;
    const seq = [[62, 0, 0.12], [66, 0.13, 0.12], [69, 0.26, 0.12], [74, 0.39, 0.7], [69, 1.12, 0.14], [74, 1.28, 0.9]];
    for (const [m, dt, d] of seq) {
      for (const h of [0, 4, 7]) {
        if (h && d < 0.5) continue;
        this._voice(this.sfxBus, { freq: mtof(m + h), t: t + dt, dur: d, type: 'sawtooth', vol: h ? 0.05 : 0.09, attack: 0.02, release: 0.25, cutoff: 900, cutoffEnv: 2600, detune: 8, unison: 2 });
      }
    }
    this._timpani(t + 0.39, 50, 0.6);
    this._timpani(t + 1.28, 45, 0.6);
  }

  /** Aplausos da multidão (buffer gerado com milhares de palmas). */
  applause(seconds = 3, vol = 0.6) {
    const ctx = this.ctx;
    if (!ctx) return;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      const claps = Math.floor(seconds * 70);
      for (let k = 0; k < claps; k++) {
        const t0 = Math.floor(Math.random() * len);
        const env = Math.min(1, t0 / (sr * 0.4), (len - t0) / (sr * 0.8));
        const amp = (0.25 + Math.random() * 0.5) * env;
        const L = Math.floor(sr * (0.008 + Math.random() * 0.012));
        for (let i = 0; i < L && t0 + i < len; i++) d[t0 + i] += (Math.random() * 2 - 1) * amp * Math.exp(-i / (L * 0.3));
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200;
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(bp).connect(g).connect(this.sfxBus);
    src.start();
  }

  step(run) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastStep < 0.15) return;
    this.lastStep = now;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = run ? 900 : 650;
    const g = ctx.createGain();
    n.connect(f).connect(g).connect(this.sfxBus);
    this._env(g, now, 0.003, run ? 0.12 : 0.07, 0.01, 0.07);
    n.start(now, Math.random() * 1.5);
    n.stop(now + 0.12);
  }

  boom(delay = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1200, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 0.8);
    const g = ctx.createGain();
    n.connect(f).connect(g).connect(this.sfxBus);
    this._env(g, t, 0.005, 0.45, 0.05, 1.0);
    n.start(t, Math.random());
    n.stop(t + 1.3);
  }

  sfx(kind) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    const B = this.sfxBus;
    switch (kind) {
      case 'ui':
        this._voice(B, { freq: 880, t, dur: 0.05, type: 'sine', vol: 0.06, release: 0.08, cutoff: 4000 });
        break;
      case 'blip':
        this._voice(B, { freq: 660 + Math.random() * 80, t, dur: 0.03, type: 'triangle', vol: 0.04, release: 0.05, cutoff: 3000 });
        break;
      case 'chime':
        [74, 78, 81, 86].forEach((m, i) => this._bell(B, t + i * 0.09, m, 0.09));
        break;
      case 'pickup':
        [81, 85, 88, 93, 97].forEach((m, i) => this._bell(B, t + i * 0.06, m, 0.08));
        break;
      case 'jump': {
        const n = ctx.createBufferSource();
        n.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.setValueAtTime(400, t);
        f.frequency.exponentialRampToValueAtTime(1800, t + 0.25);
        const g = ctx.createGain();
        n.connect(f).connect(g).connect(B);
        this._env(g, t, 0.05, 0.08, 0.05, 0.2);
        n.start(t, Math.random());
        n.stop(t + 0.4);
        break;
      }
      case 'decree':
        this.fanfare();
        [62, 69, 74, 78, 81].forEach((m, i) => this._bell(B, t + 0.4 + i * 0.12, m + 12, 0.08));
        break;
    }
  }
}
