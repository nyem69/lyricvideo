// src/lib/montage/bands.ts
import type { Song } from '$lib/model/types';
import type { LyricBand } from './model';

const MIN_VISIBLE = 0.4;
const HANGOVER = 1.8;
const HANDOFF_GAP = 0.25;

export function deriveBands(song: Song | null): LyricBand[] {
  if (!song) return [];
  const lines = song.sections.flatMap((s) => s.lines);
  const bands: LyricBand[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const start = line.startTime;
    const lastWord =
      line.words.length > 0 ? line.words[line.words.length - 1].startTime : start;
    const nextOnset = i < lines.length - 1 ? lines[i + 1].startTime : undefined;

    const computedEnd =
      nextOnset !== undefined
        ? Math.min(nextOnset - HANDOFF_GAP, lastWord + HANGOVER)
        : lastWord + HANGOVER;

    const end = Math.max(start + MIN_VISIBLE, computedEnd);
    bands.push({ id: line.id, start, end, primary: line.text });
  }

  return bands;
}
