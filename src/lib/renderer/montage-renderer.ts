// src/lib/renderer/montage-renderer.ts
import type {
  Photo,
  PhotoCut,
  LyricBand,
  MontageStyle,
  MontageSettings,
  TextStyle,
} from '$lib/montage/model';
import { DEFAULT_TITLE_STYLE, DEFAULT_BAND_STYLE } from '$lib/montage/model';
import { ImageCache } from './image-cache';
import { drawLyricBand, drawTitleCard } from './text-overlays';

interface RendererDeps {
  canvas: HTMLCanvasElement;
  imageCache: ImageCache;
}

export class MontageRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cache: ImageCache;

  private photos = new Map<string, Photo>();
  private cuts: PhotoCut[] = [];
  private bands: LyricBand[] = [];
  private style!: MontageStyle;
  private settings!: MontageSettings;
  private title = '';
  // Resolved text styling passed in by the caller (never read from the store).
  // Seeded with defaults so a renderAt before setTextStyles still draws sanely.
  private titleStyle: TextStyle = DEFAULT_TITLE_STYLE;
  private bandStyle: TextStyle = DEFAULT_BAND_STYLE;

  constructor({ canvas, imageCache }: RendererDeps) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.cache = imageCache;
  }

  setPhotos(photos: Photo[]) {
    this.photos = new Map(photos.map((p) => [p.id, p]));
  }
  setCuts(cuts: PhotoCut[]) {
    this.cuts = cuts;
  }
  setBands(bands: LyricBand[]) {
    this.bands = bands;
  }
  setStyle(style: MontageStyle) {
    this.style = style;
  }
  setSettings(settings: MontageSettings) {
    this.settings = settings;
  }
  setTitle(title: string) {
    this.title = title;
  }
  setTextStyles(title: TextStyle, band: TextStyle) {
    this.titleStyle = title;
    this.bandStyle = band;
  }
  getCanvas() {
    return this.canvas;
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /** Prefetch bitmaps for the cut active at time t (and the next), so draws don't flash. */
  async warm(t: number) {
    const idx = this.cuts.findIndex((c) => t >= c.start && t < c.end);
    for (const i of [idx, idx + 1]) {
      const cut = this.cuts[i];
      const photo = cut && this.photos.get(cut.photoId);
      if (photo) await this.cache.get(photo.assetKey);
    }
  }

  renderAt(t: number) {
    // Caller contract: setStyle()/setSettings() must run before the first
    // renderAt. Guard so a premature call is a debuggable no-op, not a cryptic
    // "cannot read properties of undefined" deep inside a draw call.
    if (!this.style || !this.settings) {
      console.error('MontageRenderer.renderAt called before setStyle/setSettings');
      return;
    }
    const { ctx, canvas, style } = this;
    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, W, H);

    const cut = this.cuts.find((c) => t >= c.start && t < c.end) ?? null;
    if (cut) {
      const photo = this.photos.get(cut.photoId);
      const bmp = photo ? this.cacheSync(photo.assetKey) : null;
      if (bmp) {
        const progress = (t - cut.start) / Math.max(0.001, cut.end - cut.start);
        this.drawBlurFill(bmp, W, H);
        this.drawPhoto(bmp, W, H, cut.kenBurns, progress);
      }
    }

    if (t < this.settings.openingDuration && this.title) {
      drawTitleCard(ctx, this.title, W, H, this.titleStyle, this.style);
    }

    const band = this.bands.find((b) => t >= b.start && t < b.end) ?? null;
    if (band) drawLyricBand(ctx, band, W, H, this.bandStyle);
  }

  // The ImageCache is the single owner of decoded bitmaps. renderAt must paint
  // synchronously, so it reads via the cache's synchronous peek() (which returns
  // null for not-yet-decoded OR evicted+closed keys — never a stale bitmap). A
  // miss kicks an async load so a later frame can draw it; warm() guarantees the
  // active cut is present before the export pipeline's renderAt.
  private cacheSync(key: string): ImageBitmap | null {
    const bmp = this.cache.peek(key);
    if (bmp) return bmp;
    void this.cache.get(key); // populate for a subsequent frame (live preview)
    return null;
  }

  private drawBlurFill(bmp: ImageBitmap, W: number, H: number) {
    const { ctx, style } = this;
    ctx.save();
    ctx.filter = `blur(${style.blurFillBlurPx}px)`;
    // cover-fit (fill the frame), zoomed slightly so blurred edges don't show
    const scale = Math.max(W / bmp.width, H / bmp.height) * 1.1;
    const w = bmp.width * scale;
    const h = bmp.height * scale;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(bmp, (W - w) / 2, (H - h) / 2, w, h);
    ctx.restore();
  }

  private drawPhoto(bmp: ImageBitmap, W: number, H: number, kb: PhotoCut['kenBurns'], p: number) {
    const { ctx, style } = this;
    // contain-fit
    const fit = Math.min(W / bmp.width, H / bmp.height);
    const baseW = bmp.width * fit;
    const baseH = bmp.height * fit;

    // Ken Burns: zoom and/or pan via eased progress
    const z = style.kenBurnsZoom;
    const ease = p * p * (3 - 2 * p); // smoothstep
    let zoom = 1;
    let dx = 0;
    let dy = 0;
    const panAmt = 0.06; // fraction of frame
    if (kb === 'in') zoom = 1 + z * ease;
    else if (kb === 'out') zoom = 1 + z * (1 - ease);
    else if (kb === 'pan-l') {
      zoom = 1 + z;
      dx = (panAmt * W) * (0.5 - ease);
    } else if (kb === 'pan-r') {
      zoom = 1 + z;
      dx = (panAmt * W) * (ease - 0.5);
    }

    const w = baseW * zoom;
    const h = baseH * zoom;
    ctx.drawImage(bmp, (W - w) / 2 + dx, (H - h) / 2 + dy, w, h);
  }
}
