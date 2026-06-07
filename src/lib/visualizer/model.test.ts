// src/lib/visualizer/model.test.ts
import { describe, it, expect } from 'vitest';
import { computeTotalDuration, DEFAULT_VIZ_STYLE, VIZ_TITLE_THEME } from './model';
import type { LyricBand, MontageSettings } from '$lib/montage/model';

const settings: MontageSettings = { openingDuration: 2.5, tailDuration: 1.5, fps: 30 };
const bands = (end: number): LyricBand[] => [{ id: 'a', start: 0, end, primary: 'hi' }];

describe('computeTotalDuration', () => {
  it('uses the song duration when it is the longest', () => {
    expect(computeTotalDuration(30, bands(10), settings)).toBe(30);
  });
  it('falls back to lastBandEnd + tail when audio metadata is missing/shorter', () => {
    expect(computeTotalDuration(0, bands(10), settings)).toBe(11.5);
    expect(computeTotalDuration(5, bands(10), settings)).toBe(11.5);
  });
  it('guards Infinity/NaN song duration', () => {
    expect(computeTotalDuration(Infinity, bands(10), settings)).toBe(11.5);
    expect(computeTotalDuration(NaN, bands(10), settings)).toBe(11.5);
  });
  it('never returns less than the opening duration', () => {
    expect(computeTotalDuration(0, [], settings)).toBe(2.5);
  });
  it('uses the max band end, not the last (bands need not be sorted)', () => {
    const unsorted: LyricBand[] = [
      { id: 'a', start: 0, end: 10, primary: 'first' },
      { id: 'b', start: 11, end: 3, primary: 'shorter end' },
    ];
    // max end = 10 -> 10 + 1.5 tail = 11.5 (last-element logic would give 4.5)
    expect(computeTotalDuration(0, unsorted, settings)).toBe(11.5);
  });
});

describe('constants', () => {
  it('defaults the style and exposes a title-card theme', () => {
    expect(DEFAULT_VIZ_STYLE).toBe('bars');
    expect(typeof VIZ_TITLE_THEME.background).toBe('string');
    expect(typeof VIZ_TITLE_THEME.accent).toBe('string');
  });
});
