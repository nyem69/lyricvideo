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
  }
}

export const playerStore = new PlayerStore();
