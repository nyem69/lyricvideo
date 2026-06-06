// src/lib/dev/visualizer/audio-harness.ts
//
// DEV MOCKUP harness for the /dev/visualizer/* review pages. Wraps an
// <audio> element in a Web Audio graph (MediaElementSource -> AnalyserNode ->
// destination) and exposes byte frequency + waveform buffers refreshed each
// frame via sample(). When no file is loaded it emits a synthetic, animated
// signal so the preview is never a dead canvas.
//
// This is the same analysis wiring the real visualizer feature will use, so the
// mockup doubles as a prototype of the production audio layer.

export class VizAudio {
  readonly audioEl: HTMLAudioElement;
  readonly freq: Uint8Array<ArrayBuffer>; // 0..255 magnitude per frequency bin
  readonly wave: Uint8Array<ArrayBuffer>; // 0..255 time-domain samples, silence = 128

  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private connected = false;
  private synthClock = 0;

  constructor(private readonly fftSize = 2048) {
    this.audioEl = new Audio();
    this.audioEl.crossOrigin = 'anonymous';
    this.freq = new Uint8Array(new ArrayBuffer(fftSize / 2));
    this.wave = new Uint8Array(new ArrayBuffer(fftSize));
  }

  get hasAudio() {
    return this.analyser !== null;
  }
  get isPlaying() {
    return !this.audioEl.paused && !this.audioEl.ended;
  }
  get currentTime() {
    return this.audioEl.currentTime;
  }
  get duration() {
    return Number.isFinite(this.audioEl.duration) ? this.audioEl.duration : 0;
  }

  /** Load a user file; lazily builds the audio graph on first load. */
  async load(file: File) {
    if (this.audioEl.src) URL.revokeObjectURL(this.audioEl.src);
    this.audioEl.src = URL.createObjectURL(file);
    this.ensureGraph();
    this.audioEl.currentTime = 0;
  }

  private ensureGraph() {
    if (this.connected) return;
    // AudioContext is created lazily (must follow a user gesture to start).
    this.ctx = new AudioContext();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;
    // createMediaElementSource may only be called ONCE per element — the graph
    // is therefore built once and reused for every subsequent load().
    const src = this.ctx.createMediaElementSource(this.audioEl);
    src.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.connected = true;
  }

  async play() {
    if (this.ctx?.state === 'suspended') await this.ctx.resume();
    await this.audioEl.play().catch(() => {});
  }
  pause() {
    this.audioEl.pause();
  }
  toggle() {
    if (this.isPlaying) this.pause();
    else void this.play();
  }
  seek(frac: number) {
    if (this.duration) this.audioEl.currentTime = frac * this.duration;
  }

  /** Refresh freq[] and wave[] for the current frame. Call once per RAF tick. */
  sample() {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.freq);
      this.analyser.getByteTimeDomainData(this.wave);
      return;
    }
    this.synthClock += 1 / 60;
    this.fillSynthetic(this.synthClock);
  }

  // Pleasant fake spectrum so the mockup animates before a song is loaded:
  // a bass-heavy falloff modulated by a few slow LFOs, plus a sine waveform.
  private fillSynthetic(t: number) {
    const n = this.freq.length;
    const beat = 0.5 + 0.5 * Math.sin(t * 3.1); // pseudo "kick"
    for (let i = 0; i < n; i++) {
      const norm = i / n;
      const falloff = Math.pow(1 - norm, 1.6); // bass-weighted
      const wobble = 0.6 + 0.4 * Math.sin(t * 2 + norm * 14);
      const sparkle = 0.15 * Math.sin(t * 9 + i);
      const v = (falloff * wobble + sparkle) * (0.7 + 0.5 * beat);
      this.freq[i] = Math.max(0, Math.min(255, v * 255));
    }
    const m = this.wave.length;
    for (let i = 0; i < m; i++) {
      const p = i / m;
      const s =
        Math.sin(p * Math.PI * 2 * 3 + t * 6) * 0.5 +
        Math.sin(p * Math.PI * 2 * 7 + t * 3) * 0.3 * beat;
      this.wave[i] = Math.max(0, Math.min(255, 128 + s * 90));
    }
  }

  destroy() {
    this.audioEl.pause();
    if (this.audioEl.src) URL.revokeObjectURL(this.audioEl.src);
    void this.ctx?.close();
  }
}
