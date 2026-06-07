// src/lib/visualizer/formats.ts
export interface VideoFormat {
  id: string;
  label: string;
  group: string;
  width: number;
  height: number;
}

export const FORMATS: VideoFormat[] = [
  { id: 'youtube', label: 'YouTube (16:9)', group: 'YouTube', width: 1920, height: 1080 },
  { id: 'tiktok', label: 'TikTok / Reels (9:16)', group: 'TikTok', width: 1080, height: 1920 },
  { id: 'ig-feed', label: 'Instagram Square (1:1)', group: 'Instagram', width: 1080, height: 1080 },
  { id: 'ig-story', label: 'Instagram Story (9:16)', group: 'Instagram', width: 1080, height: 1920 },
];

export const FORMAT_MAP: Record<string, VideoFormat> = Object.fromEntries(
  FORMATS.map((f) => [f.id, f])
);

export const DEFAULT_FORMAT = 'youtube';

const MIN_DIM = 256;
const MAX_DIM = 3840;

/** Clamp custom dims to [256,3840], round DOWN to even (encoder-friendly).
 *  Bad input (NaN / <=0 / Infinity) falls back to the default preset's dims
 *  (single source of truth — no hardcoded duplicate of YouTube's 1920x1080). */
export function coerceCustomDims(w: number, h: number): { width: number; height: number } {
  const fallback = FORMAT_MAP[DEFAULT_FORMAT];
  const clamp = (n: number, fb: number) => {
    if (!Number.isFinite(n) || n <= 0) return fb;
    const c = Math.min(MAX_DIM, Math.max(MIN_DIM, Math.round(n)));
    return c % 2 === 0 ? c : c - 1;
  };
  return { width: clamp(w, fallback.width), height: clamp(h, fallback.height) };
}

export function resolveFormat(opts: {
  formatId: string;
  customWidth?: number;
  customHeight?: number;
}): { width: number; height: number } {
  if (opts.formatId === 'custom') {
    return coerceCustomDims(opts.customWidth ?? 1920, opts.customHeight ?? 1080);
  }
  const f = FORMAT_MAP[opts.formatId] ?? FORMAT_MAP[DEFAULT_FORMAT];
  return { width: f.width, height: f.height };
}
