// src/lib/visualizer/quality.test.ts
import { describe, it, expect } from 'vitest';
import {
  QUALITY_LEVELS,
  QUALITY_MAP,
  DEFAULT_QUALITY,
  scaleDims,
  estimateBytes,
  formatBytes,
} from './quality';

const HD = { width: 1920, height: 1080 };
const STORY = { width: 1080, height: 1920 };

describe('quality catalog', () => {
  it('defaults to full resolution so existing exports are unchanged', () => {
    expect(DEFAULT_QUALITY).toBe('full');
    expect(QUALITY_MAP[DEFAULT_QUALITY].scale).toBe(1);
  });

  it('exposes levels in descending size order with unique ids', () => {
    const ids = QUALITY_LEVELS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const scales = QUALITY_LEVELS.map((q) => q.scale);
    expect([...scales].sort((a, b) => b - a)).toEqual(scales);
  });
});

describe('scaleDims', () => {
  it('leaves dims untouched at full quality', () => {
    expect(scaleDims(HD, 'full')).toEqual(HD);
  });

  it('scales 1080p down to 720p at balanced', () => {
    expect(scaleDims(HD, 'balanced')).toEqual({ width: 1280, height: 720 });
  });

  it('halves 1080p at small', () => {
    expect(scaleDims(HD, 'small')).toEqual({ width: 960, height: 540 });
  });

  it('preserves aspect ratio on portrait formats', () => {
    const scaled = scaleDims(STORY, 'small');
    expect(scaled).toEqual({ width: 540, height: 960 });
    expect(scaled.width / scaled.height).toBeCloseTo(STORY.width / STORY.height, 5);
  });

  it('always yields even dimensions (encoders reject odd ones)', () => {
    for (const q of QUALITY_LEVELS) {
      for (const dims of [HD, STORY, { width: 1080, height: 1080 }, { width: 1234, height: 567 }]) {
        const s = scaleDims(dims, q.id);
        expect(s.width % 2, `${q.id} ${dims.width}x${dims.height}`).toBe(0);
        expect(s.height % 2, `${q.id} ${dims.width}x${dims.height}`).toBe(0);
      }
    }
  });

  it('never scales below the 256px floor', () => {
    const s = scaleDims({ width: 256, height: 256 }, 'small');
    expect(s.width).toBeGreaterThanOrEqual(256);
    expect(s.height).toBeGreaterThanOrEqual(256);
  });

  it('falls back to full size for an unknown quality id', () => {
    expect(scaleDims(HD, 'nonsense')).toEqual(HD);
  });
});

describe('estimateBytes', () => {
  const FIVE_MIN = 307; // the 5:07 Suno track that surfaced the 371 MB export

  it('shrinks roughly with pixel count, not linearly with scale', () => {
    const full = estimateBytes(1920, 1080, FIVE_MIN);
    const small = estimateBytes(960, 540, FIVE_MIN);
    // A quarter of the pixels — audio is a fixed floor, so not exactly 4x.
    expect(small).toBeLessThan(full / 3);
  });

  it('puts a full 1080p 5-minute export in the ~150 MB range', () => {
    const mb = estimateBytes(1920, 1080, FIVE_MIN) / 1_000_000;
    expect(mb).toBeGreaterThan(140);
    expect(mb).toBeLessThan(170);
  });

  it('gets a small 5-minute export under 50 MB', () => {
    expect(estimateBytes(960, 540, FIVE_MIN)).toBeLessThan(50_000_000);
  });

  it('returns 0 for an unset or invalid duration', () => {
    expect(estimateBytes(1920, 1080, 0)).toBe(0);
    expect(estimateBytes(1920, 1080, -5)).toBe(0);
    expect(estimateBytes(1920, 1080, NaN)).toBe(0);
  });
});

describe('formatBytes', () => {
  it('renders MB and GB', () => {
    expect(formatBytes(73_000_000)).toBe('73 MB');
    expect(formatBytes(1_400_000_000)).toBe('1.4 GB');
  });

  it('renders KB below a megabyte', () => {
    expect(formatBytes(240_000)).toBe('240 KB');
  });

  it('shows a dash when there is nothing to estimate', () => {
    expect(formatBytes(0)).toBe('—');
    expect(formatBytes(NaN)).toBe('—');
  });
});
