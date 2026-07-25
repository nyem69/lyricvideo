// src/lib/visualizer/quality.ts
import { videoBitrateFor, AUDIO_BITS_PER_SECOND } from '$lib/montage/export';

/** Export quality = a scale factor on the chosen format's dimensions.
 *
 *  This works because the renderer is fully resolution-independent — every size
 *  it draws is proportional (`H * sizePct` for type, `W * 0.82` for wrapping,
 *  `H * 0.003` for rules). A scaled export is the same composition, just fewer
 *  pixels, so the preview stays a faithful WYSIWYG at full format size.
 *
 *  File size falls faster than the scale itself: bitrate tracks pixel COUNT
 *  (see `videoBitrateFor`), so 0.5 scale is a quarter of the pixels and roughly
 *  a quarter of the bytes. That is the lever for getting a 5-minute song down to
 *  something shareable without a transcode.
 */
export interface QualityLevel {
  id: string;
  label: string;
  /** Multiplier applied to both format dimensions. */
  scale: number;
  /** Short hint shown under the picker. */
  hint: string;
}

export const QUALITY_LEVELS: QualityLevel[] = [
  { id: 'full', label: 'Full', scale: 1, hint: 'Best quality, largest file' },
  { id: 'balanced', label: 'Balanced', scale: 2 / 3, hint: 'Good quality, ~half the size' },
  { id: 'small', label: 'Small', scale: 1 / 2, hint: 'Easy to share, ~quarter the size' },
];

export const QUALITY_MAP: Record<string, QualityLevel> = Object.fromEntries(
  QUALITY_LEVELS.map((q) => [q.id, q])
);

/** Full resolution stays the default so existing exports are unchanged — the
 *  picker plus a live size estimate is what makes the trade-off visible. */
export const DEFAULT_QUALITY = 'full';

const MIN_DIM = 256;

/** Scale dims, rounding DOWN to even (encoder-friendly, same rule as
 *  `coerceCustomDims`) and never below the 256px floor. An unknown quality id
 *  falls back to full size rather than throwing. */
export function scaleDims(
  dims: { width: number; height: number },
  qualityId: string
): { width: number; height: number } {
  const scale = QUALITY_MAP[qualityId]?.scale ?? 1;
  const clamp = (n: number) => {
    const c = Math.max(MIN_DIM, Math.round(n * scale));
    return c % 2 === 0 ? c : c - 1;
  };
  return { width: clamp(dims.width), height: clamp(dims.height) };
}

/** Rough encoded size in bytes: (video + audio) bitrate over the duration.
 *  Real files vary with content — this is for choosing between options, not a
 *  promise. Returns 0 for a zero/invalid duration. */
export function estimateBytes(width: number, height: number, durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  const bitsPerSec = videoBitrateFor(width, height) + AUDIO_BITS_PER_SECOND;
  return Math.round((bitsPerSec * durationSec) / 8);
}

/** Human-readable size, e.g. "73 MB" / "1.2 GB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}
