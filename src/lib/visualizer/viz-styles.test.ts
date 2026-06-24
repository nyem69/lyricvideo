// src/lib/visualizer/viz-styles.test.ts
import { describe, it, expect } from 'vitest';
import { VIZ_STYLES, VIZ_STYLE_MAP, rgba, type VizFrame } from './viz-styles';

// A ctx that records every color assigned to fill/stroke/shadow and every
// gradient color stop, so we can assert a style actually paints in the accent
// it was handed (the stub below only records call names).
function recordingCtx() {
  const colors: string[] = [];
  const grad = {
    addColorStop(_p: number, c: string) {
      colors.push(c);
    },
  };
  return new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === '__colors') return colors;
        if (prop === 'measureText') return (s: string) => ({ width: String(s).length * 6 });
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => grad;
        return () => {};
      },
      set(_t, prop: string, value: unknown) {
        if (
          (prop === 'fillStyle' || prop === 'strokeStyle' || prop === 'shadowColor') &&
          typeof value === 'string'
        )
          colors.push(value);
        return true;
      },
    }
  ) as unknown as CanvasRenderingContext2D;
}

function stubCtx() {
  const calls: string[] = [];
  return new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === '__calls') return calls;
        if (prop === 'measureText') return (s: string) => ({ width: String(s).length * 6 });
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
          return () => ({ addColorStop() {} });
        return (...a: unknown[]) => {
          void a;
          calls.push(prop);
        };
      },
      set() {
        return true;
      },
    }
  ) as unknown as CanvasRenderingContext2D;
}

function frame(w: number, h: number, fill: number): VizFrame {
  const freq = new Uint8Array(1024).fill(fill);
  const wave = new Uint8Array(2048).fill(fill);
  return { ctx: stubCtx(), w, h, freq, wave, t: 1.23, accent: '#d4af37' };
}

describe('viz styles', () => {
  it('exposes all eleven styles', () => {
    expect(VIZ_STYLES.map((s) => s.id)).toEqual([
      'bars',
      'mirror',
      'radial',
      'wave',
      'area',
      'orb',
      'ringwave',
      'blob',
      'matrix',
      'glitch',
      'smoke',
    ]);
    expect(Object.keys(VIZ_STYLE_MAP).sort()).toEqual([
      'area',
      'bars',
      'blob',
      'glitch',
      'matrix',
      'mirror',
      'orb',
      'radial',
      'ringwave',
      'smoke',
      'wave',
    ]);
  });

  it('every style declares a valid anchor', () => {
    for (const s of VIZ_STYLES) expect(['center', 'bottom']).toContain(s.anchor);
  });

  it('every style draws across aspect ratios and freq levels without throwing', () => {
    const dims: [number, number][] = [
      [1920, 1080],
      [1080, 1920],
      [1080, 1080],
    ];
    for (const style of VIZ_STYLES) {
      for (const [w, h] of dims) {
        for (const fill of [0, 200]) {
          const f = frame(w, h, fill);
          expect(() => style.draw(f)).not.toThrow();
          expect((f.ctx as unknown as { __calls: string[] }).__calls.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('bars issues fillRect (renders bars, does not no-op)', () => {
    const f = frame(1920, 1080, 200);
    VIZ_STYLE_MAP.bars.draw(f);
    expect((f.ctx as unknown as { __calls: string[] }).__calls).toContain('fillRect');
  });

  it('every style paints in the supplied accent (no hardcoded gold)', () => {
    // A distinctive accent no neutral (cream/well) would coincidentally produce.
    const accent = '#1234ff'; // -> rgb 18,52,255
    for (const style of VIZ_STYLES) {
      const ctx = recordingCtx();
      const freq = new Uint8Array(1024).fill(200);
      const wave = new Uint8Array(2048).fill(200);
      style.draw({ ctx, w: 1080, h: 1920, freq, wave, t: 1.23, accent });
      const colors = (ctx as unknown as { __colors: string[] }).__colors;
      const usesAccent = colors.some((c) => c === accent || c.includes('18, 52, 255'));
      expect(usesAccent, `${style.id} should paint in the accent`).toBe(true);
      // And must NOT carry the old hardcoded gold.
      const hasOldGold = colors.some(
        (c) => c.includes('212,175,55') || c.toLowerCase().includes('#d4af37')
      );
      expect(hasOldGold, `${style.id} must not hardcode gold`).toBe(false);
    }
  });

  it('rgba() expands #rgb and #rrggbb hex', () => {
    expect(rgba('#1234ff', 0.5)).toBe('rgba(18, 52, 255, 0.5)');
    expect(rgba('#fff')).toBe('rgba(255, 255, 255, 1)');
    expect(rgba('d4af37', 0.35)).toBe('rgba(212, 175, 55, 0.35)');
  });
});
