// src/lib/montage/timeline.ts
import type { LyricBand, PhotoCut, MontageSettings, KenBurns } from './model';

const KEN_BURNS_CYCLE: KenBurns[] = ['in', 'out', 'pan-l', 'pan-r'];

export function buildTimeline(
  photoIds: string[],
  songDuration: number,
  bands: LyricBand[],
  settings: MontageSettings
): PhotoCut[] {
  const n = photoIds.length;
  if (n === 0) return [];

  const lastBandEnd = bands.length > 0 ? Math.max(...bands.map((b) => b.end)) : 0;
  const rawSpanEnd = lastBandEnd > 0 ? lastBandEnd + settings.tailDuration : songDuration;
  const spanEnd = Math.max(rawSpanEnd, settings.openingDuration + 1);
  const step = (spanEnd - settings.openingDuration) / n;

  const cuts: PhotoCut[] = [];
  for (let i = 0; i < n; i++) {
    const start = settings.openingDuration + i * step;
    cuts.push({
      photoId: photoIds[i],
      start,
      end: start + step,
      kenBurns: KEN_BURNS_CYCLE[i % KEN_BURNS_CYCLE.length],
    });
  }

  return cuts;
}
