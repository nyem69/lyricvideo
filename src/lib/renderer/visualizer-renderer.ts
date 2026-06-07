// src/lib/renderer/visualizer-renderer.ts
import type { LyricBand, TextStyle, MontageSettings } from '$lib/montage/model';
import { DEFAULT_TITLE_STYLE, DEFAULT_BAND_STYLE } from '$lib/montage/model';
import { VIZ_STYLE_MAP } from '$lib/visualizer/viz-styles';
import { VIZ_TITLE_THEME, type VizStyleId } from '$lib/visualizer/model';
import { drawLyricBand, drawTitleCard } from './text-overlays';

const SURFACE = '#0a1a0a';
const ACCENT = '#d4af37';
// Teal cue used ONLY for the idle (no-signal) shimmer, mirroring the
// audio-reactive accent in the editor chrome. Live playback uses gold (ACCENT).
const IDLE_ACCENT = '#46d6c8';

export class VisualizerRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private analyser: AnalyserNode | null = null;
  // Seeded with zeroed buffers so renderAt before setAnalyser draws a quiet
  // frame instead of dividing by an empty array inside the style helpers.
  private freq: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(1024));
  private wave: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(2048));

  private styleId: VizStyleId = 'bars';
  private bands: LyricBand[] = [];
  private title = '';
  private titleStyle: TextStyle = DEFAULT_TITLE_STYLE;
  private bandStyle: TextStyle = DEFAULT_BAND_STYLE;
  private settings: MontageSettings | null = null;
  private bg: ImageBitmap | null = null;
  private bgDim = 0.45; // overlay alpha over a bg image so text/viz stay legible
  // Frame counter for the idle shimmer. Driven per-frame, NOT by the playback
  // clock `t` — so the stage still breathes while paused (currentTime frozen at
  // 0) and an idle export stays frame-deterministic.
  private idleFrame = 0;

  constructor({ canvas }: { canvas: HTMLCanvasElement }) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
  }

  setAnalyser(a: AnalyserNode) {
    this.analyser = a;
    this.freq = new Uint8Array(new ArrayBuffer(a.frequencyBinCount));
    this.wave = new Uint8Array(new ArrayBuffer(a.fftSize));
  }
  setStyle(id: VizStyleId) {
    this.styleId = id;
  }
  setBands(bands: LyricBand[]) {
    this.bands = bands;
  }
  setTitle(title: string) {
    this.title = title;
  }
  setTextStyles(title: TextStyle, band: TextStyle) {
    this.titleStyle = title;
    this.bandStyle = band;
  }
  setSettings(s: MontageSettings) {
    this.settings = s;
  }
  setBackground(bmp: ImageBitmap | null) {
    this.bg = bmp;
  }
  getCanvas() {
    return this.canvas;
  }
  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  renderAt(t: number) {
    if (!this.settings) {
      console.error('VisualizerRenderer.renderAt called before setSettings');
      return;
    }
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;

    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.freq);
      this.analyser.getByteTimeDomainData(this.wave);
    }

    this.drawBackground(W, H);

    // When there's no live signal (no audio attached, or attached-but-paused),
    // the byte buffers are all-zero and every style draws a flat/blank frame —
    // which reads as "broken". Fall back to a gentle animated idle shimmer so
    // the stage always looks alive. Live playback (energy > 0) takes over.
    let energy = 0;
    for (let i = 0; i < this.freq.length; i++) energy += this.freq[i];
    if (energy === 0) {
      this.drawIdle(W, H, this.idleFrame++ / 60);
    } else {
      const style = VIZ_STYLE_MAP[this.styleId] ?? VIZ_STYLE_MAP.bars;
      style.draw({ ctx, w: W, h: H, freq: this.freq, wave: this.wave, t, accent: ACCENT });
    }

    if (t < this.settings.openingDuration && this.title) {
      drawTitleCard(ctx, this.title, W, H, this.titleStyle, VIZ_TITLE_THEME);
    }

    const band = this.bands.find((b) => t >= b.start && t < b.end) ?? null;
    if (band) drawLyricBand(ctx, band, W, H, this.bandStyle);
  }

  // A calm centered EQ that breathes via a few out-of-phase sine waves — no
  // randomness so a paused/seeking preview stays deterministic and an idle
  // export is reproducible. Teal, low alpha, so it never competes with a title.
  private drawIdle(W: number, H: number, t: number) {
    const { ctx } = this;
    const bars = 48;
    const gap = Math.max(2, Math.round(W * 0.004));
    const bw = (W - gap * (bars - 1)) / bars;
    const mid = H / 2;
    const maxH = H * 0.16;
    ctx.save();
    ctx.fillStyle = IDLE_ACCENT;
    for (let i = 0; i < bars; i++) {
      const phase = t * 1.6 + i * 0.32;
      const env = 0.55 + 0.45 * Math.sin(i / bars * Math.PI); // taller in the middle
      const amp = (0.5 + 0.5 * Math.sin(phase)) * env;
      const h = Math.max(bw * 0.5, amp * maxH);
      const x = i * (bw + gap);
      ctx.globalAlpha = 0.12 + 0.18 * amp;
      ctx.fillRect(x, mid - h, bw, h * 2);
    }
    ctx.restore();
  }

  private drawBackground(W: number, H: number) {
    const { ctx, bg } = this;
    if (bg) {
      // cover-fit
      const scale = Math.max(W / bg.width, H / bg.height);
      const w = bg.width * scale;
      const h = bg.height * scale;
      ctx.drawImage(bg, (W - w) / 2, (H - h) / 2, w, h);
      // dim so a bright cover doesn't drown the visualizer/text
      ctx.fillStyle = `rgba(10,26,10,${this.bgDim})`;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = SURFACE;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
