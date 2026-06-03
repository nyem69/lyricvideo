// src/lib/montage/timeline.test.ts
import { describe, it, expect } from 'vitest';
import { buildTimeline } from './timeline';
import { DEFAULT_SETTINGS, type LyricBand } from './model';

const band = (start: number, end: number): LyricBand => ({
  id: `${start}`, start, end, primary: 'x',
});

describe('buildTimeline', () => {
  it('returns [] when there are no photos', () => {
    expect(buildTimeline([], 100, [], DEFAULT_SETTINGS)).toEqual([]);
  });

  it('spans opening -> lastBandEnd + tail when bands exist', () => {
    const cuts = buildTimeline(['a', 'b'], 100, [band(10, 30)], DEFAULT_SETTINGS);
    expect(cuts).toHaveLength(2);
    expect(cuts[0].start).toBeCloseTo(2.5, 3);
    expect(cuts[0].end).toBeCloseTo(17.0, 3);
    expect(cuts[1].start).toBeCloseTo(17.0, 3);
    expect(cuts[1].end).toBeCloseTo(31.5, 3);
  });

  it('falls back to songDuration when there are no bands', () => {
    const cuts = buildTimeline(['a', 'b', 'c'], 60, [], DEFAULT_SETTINGS);
    expect(cuts[2].end).toBeCloseTo(60, 3);
  });

  it('cycles ken burns variants by index', () => {
    const cuts = buildTimeline(['a', 'b', 'c', 'd', 'e'], 100, [band(5, 80)], DEFAULT_SETTINGS);
    expect(cuts.map((c) => c.kenBurns)).toEqual(['in', 'out', 'pan-l', 'pan-r', 'in']);
  });

  it('never produces zero/negative-length cuts even with a tiny span', () => {
    const cuts = buildTimeline(['a', 'b'], 1, [], DEFAULT_SETTINGS);
    for (const c of cuts) expect(c.end).toBeGreaterThan(c.start);
  });
});
