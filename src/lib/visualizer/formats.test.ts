// src/lib/visualizer/formats.test.ts
import { describe, it, expect } from 'vitest';
import { FORMATS, FORMAT_MAP, DEFAULT_FORMAT, coerceCustomDims, resolveFormat } from './formats';

describe('format presets', () => {
  it('has the four platform presets with even dims', () => {
    expect(FORMATS.map((f) => f.id)).toEqual(['youtube', 'tiktok', 'ig-feed', 'ig-story']);
    for (const f of FORMATS) {
      expect(f.width % 2).toBe(0);
      expect(f.height % 2).toBe(0);
    }
  });

  it('DEFAULT_FORMAT resolves to 1920x1080', () => {
    expect(resolveFormat({ formatId: DEFAULT_FORMAT })).toEqual({ width: 1920, height: 1080 });
  });

  it('resolveFormat returns preset dims', () => {
    expect(resolveFormat({ formatId: 'tiktok' })).toEqual({ width: 1080, height: 1920 });
    expect(resolveFormat({ formatId: 'ig-feed' })).toEqual({ width: 1080, height: 1080 });
  });

  it('unknown formatId falls back to the default preset', () => {
    expect(resolveFormat({ formatId: 'nope' })).toEqual({ width: 1920, height: 1080 });
  });

  it('custom format coerces the custom dims', () => {
    expect(resolveFormat({ formatId: 'custom', customWidth: 1281, customHeight: 721 })).toEqual({
      width: 1280,
      height: 720,
    });
  });
});

describe('coerceCustomDims', () => {
  it('rounds odd dims down to even', () => {
    expect(coerceCustomDims(1281, 721)).toEqual({ width: 1280, height: 720 });
  });
  it('clamps to [256, 3840]', () => {
    expect(coerceCustomDims(10, 99999)).toEqual({ width: 256, height: 3840 });
  });
  it('falls back to 1920x1080 on NaN/zero/negative', () => {
    expect(coerceCustomDims(NaN, 0)).toEqual({ width: 1920, height: 1080 });
    expect(coerceCustomDims(-5, Infinity)).toEqual({ width: 1920, height: 1080 });
  });
  it('uses FORMAT_MAP for lookups', () => {
    expect(FORMAT_MAP.youtube.width).toBe(1920);
  });
});
