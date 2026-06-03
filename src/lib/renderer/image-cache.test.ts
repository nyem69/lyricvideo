// src/lib/renderer/image-cache.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeDownscaledSize, ImageCache } from './image-cache';

describe('computeDownscaledSize', () => {
  it('leaves small images untouched', () => {
    expect(computeDownscaledSize(800, 600, 1920)).toEqual({ width: 800, height: 600 });
  });

  it('scales landscape down to maxDim on the long edge', () => {
    expect(computeDownscaledSize(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 });
  });

  it('scales portrait down to maxDim on the long edge', () => {
    expect(computeDownscaledSize(3000, 4000, 1920)).toEqual({ width: 1440, height: 1920 });
  });
});

describe('ImageCache concurrency', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('dedupes concurrent cold get() for the same key into a single decode', async () => {
    // Fake ImageBitmap factory — one bitmap object per decode call.
    const decode = vi.fn(async () => ({ close: vi.fn() }) as unknown as ImageBitmap);
    vi.stubGlobal('createImageBitmap', decode);

    // Loader resolves on demand so both get() calls overlap while the first is pending.
    let release!: (b: Blob) => void;
    const loader = vi.fn(
      (_key: string) => new Promise<Blob | null>((res) => (release = res as (b: Blob) => void))
    );

    const cache = new ImageCache(loader);
    const p1 = cache.get('k');
    const p2 = cache.get('k'); // overlaps p1 before it resolves
    release(new Blob(['x']));
    const [a, b] = await Promise.all([p1, p2]);

    expect(loader).toHaveBeenCalledTimes(1); // single IDB read
    expect(decode).toHaveBeenCalledTimes(1); // single decode — no leaked bitmap
    expect(a).toBe(b); // both callers share the one bitmap

    // A subsequent get() is served from cache (no further loads).
    const c = await cache.get('k');
    expect(c).toBe(a);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
