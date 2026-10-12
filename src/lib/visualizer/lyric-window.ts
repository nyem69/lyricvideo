// src/lib/visualizer/lyric-window.ts
//
// Builds the word window a text-driven style (VizStyle.ownsLyrics) draws at
// playback time `t`: the line playing now (or the next one, between lines)
// plus following lines until at least `minWords` are collected, capped at
// `maxWords`. Pure and deterministic — the renderer calls it every frame.

import type { LyricBand } from '$lib/montage/model';

export interface LyricWindow {
  words: string[];
  activeFrom: number;
  activeTo: number;
}

export function splitWords(line: string): string[] {
  return line.split(/\s+/).filter((w) => w.length > 0);
}

export function lyricWindow(
  bands: LyricBand[],
  t: number,
  minWords: number,
  maxWords: number
): LyricWindow {
  const sorted = bands.slice().sort((a, b) => a.start - b.start);
  let start = sorted.findIndex((b) => t >= b.start && t < b.end);
  const playing = start !== -1;
  if (!playing) start = sorted.findIndex((b) => b.start > t);
  if (start === -1) {
    // Past the last line: keep showing the tail of the song rather than nothing.
    start = Math.max(0, sorted.length - 1);
  }
  const words: string[] = [];
  let activeTo = 0;
  for (let i = start; i < sorted.length && words.length < minWords; i++) {
    const ws = splitWords(sorted[i].primary);
    words.push(...ws);
    if (i === start && playing) activeTo = ws.length;
  }
  if (words.length > maxWords) words.length = maxWords;
  return { words, activeFrom: 0, activeTo: Math.min(activeTo, words.length) };
}
