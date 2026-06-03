// src/lib/renderer/image-cache.ts
export const MAX_DIM = 1920;

export function computeDownscaledSize(
  w: number,
  h: number,
  maxDim: number
): { width: number; height: number } {
  if (w <= maxDim && h <= maxDim) return { width: w, height: h };
  const scale = maxDim / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

/** Decode a user file, downscale to a canvas-safe size, return a JPEG blob + dims. */
export async function downscaleToBlob(
  file: File,
  maxDim = MAX_DIM
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = computeDownscaledSize(bitmap.width, bitmap.height, maxDim);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.9);
  });
  return { blob, width, height };
}

/** LRU-ish ImageBitmap cache backed by an async blob loader (the IDB asset store). */
export class ImageCache {
  private cache = new Map<string, ImageBitmap>();
  private order: string[] = [];
  // Dedupe concurrent cold loads: the renderer's rAF loop issues overlapping
  // get(sameKey) before the first decode resolves. Without this, both decode,
  // one ImageBitmap leaks, and a duplicate `order` entry later evicts (closes)
  // the live, displayed bitmap mid-render.
  private inflight = new Map<string, Promise<ImageBitmap | null>>();

  constructor(
    private loader: (key: string) => Promise<Blob | null>,
    private maxEntries = 12
  ) {}

  async get(key: string): Promise<ImageBitmap | null> {
    const existing = this.cache.get(key);
    if (existing) return existing;

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const p = this.load(key).finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  private async load(key: string): Promise<ImageBitmap | null> {
    const blob = await this.loader(key);
    if (!blob) return null;
    const bmp = await createImageBitmap(blob);
    this.cache.set(key, bmp);
    this.order.push(key);
    while (this.order.length > this.maxEntries) {
      const evict = this.order.shift();
      if (evict !== undefined && evict !== key) {
        this.cache.get(evict)?.close();
        this.cache.delete(evict);
      }
    }
    return bmp;
  }

  clear(): void {
    for (const b of this.cache.values()) b.close();
    this.cache.clear();
    this.order = [];
  }
}
