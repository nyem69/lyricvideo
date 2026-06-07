function formatTime(s: number): string {
  return Math.floor(s / 60) + ':' + Math.floor(s % 60).toString().padStart(2, '0');
}

class PlayerStore {
  currentTime = $state(0);
  isPlaying = $state(false);
  duration = $state(0);
  isSeeking = $state(false);

  private audioEl: HTMLAudioElement | null = null;
  private animFrame: number | null = null;
  private lastTimestamp: number | null = null;

  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private srcNode: MediaElementAudioSourceNode | null = null;
  private srcEl: HTMLAudioElement | null = null; // element srcNode belongs to
  private analyserWanted = false;

  readonly progress = $derived(this.duration > 0 ? this.currentTime / this.duration : 0);
  readonly formattedTime = $derived(formatTime(this.currentTime));
  readonly formattedDuration = $derived(formatTime(this.duration));
  readonly hasAudio = $derived(this.audioEl !== null);

  constructor() {
    if (typeof window !== 'undefined') {
      this.startLoop();
    }
  }

  private startLoop() {
    const update = (timestamp: number) => {
      if (!this.lastTimestamp) this.lastTimestamp = timestamp;
      const delta = (timestamp - this.lastTimestamp) / 1000;
      this.lastTimestamp = timestamp;

      if (this.isPlaying) {
        if (this.audioEl) {
          this.currentTime = this.audioEl.currentTime;
        } else {
          this.currentTime += delta;
        }

        if (this.currentTime >= this.duration) {
          this.currentTime = this.duration;
          this.isPlaying = false;
          if (this.audioEl) this.audioEl.pause();
        }
      }

      this.animFrame = requestAnimationFrame(update);
    };
    this.animFrame = requestAnimationFrame(update);
  }

  play() {
    if (this.currentTime >= this.duration) this.seekTo(0);
    this.isPlaying = true;
    if (this.audioCtx?.state === 'suspended') void this.audioCtx.resume();
    this.audioEl?.play();
  }

  pause() {
    this.isPlaying = false;
    this.audioEl?.pause();
  }

  toggle() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  seekTo(time: number) {
    this.currentTime = Math.max(0, Math.min(time, this.duration));
    if (this.audioEl) this.audioEl.currentTime = this.currentTime;
    this.lastTimestamp = null;
  }

  loadAudio(file: File) {
    if (this.audioEl) {
      this.audioEl.pause();
      URL.revokeObjectURL(this.audioEl.src);
    }
    this.audioEl = new Audio();
    this.audioEl.src = URL.createObjectURL(file);
    this.audioEl.addEventListener('loadedmetadata', () => {
      this.duration = this.audioEl!.duration;
    });
    this.audioEl.addEventListener('ended', () => {
      this.isPlaying = false;
    });
    this.seekTo(0);
    this.isPlaying = false;
    // If an analyser was attached, rebuild the source against the new element.
    this.connectSource();
  }

  /** Opt-in: build (once) and return the analyser tapping the current audio.
   *  Safe to call before any song is loaded — the source is connected later,
   *  on the first loadAudio. The returned AnalyserNode instance is stable. */
  attachAnalyser(): AnalyserNode {
    this.analyserWanted = true;
    if (!this.audioCtx) this.audioCtx = new AudioContext();
    if (!this.analyser) {
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      this.analyser.connect(this.audioCtx.destination);
    }
    this.connectSource();
    return this.analyser;
  }

  // Connect the CURRENT audio element to the analyser. A given <audio> may be
  // wrapped by createMediaElementSource only once in its lifetime, so the source
  // node is cached per element and rebuilt ONLY when the element itself changes.
  private connectSource() {
    if (!this.analyserWanted || !this.audioCtx || !this.analyser) return;
    if (!this.audioEl) return; // no element yet — connect on the next loadAudio
    if (this.srcEl === this.audioEl && this.srcNode) return; // already connected
    if (this.srcNode) {
      try {
        this.srcNode.disconnect();
      } catch {
        // old node already detached — ignore
      }
    }
    this.srcNode = this.audioCtx.createMediaElementSource(this.audioEl);
    this.srcNode.connect(this.analyser);
    this.srcEl = this.audioEl;
  }

  setDuration(d: number) {
    if (!this.audioEl) this.duration = d;
  }

  restart() {
    this.seekTo(0);
    this.isPlaying = false;
    this.lastTimestamp = null;
  }

  destroy() {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    if (this.audioEl) {
      this.audioEl.pause();
      URL.revokeObjectURL(this.audioEl.src);
    }
    void this.audioCtx?.close();
  }
}

export const playerStore = new PlayerStore();
