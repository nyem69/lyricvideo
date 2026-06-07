// src/lib/visualizer/viz-styles.test.ts
import { describe, it, expect } from 'vitest';
import { VIZ_STYLES, VIZ_STYLE_MAP, type VizFrame } from './viz-styles';

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
  it('exposes all six styles', () => {
    expect(VIZ_STYLES.map((s) => s.id)).toEqual(['bars', 'mirror', 'radial', 'wave', 'area', 'orb']);
    expect(Object.keys(VIZ_STYLE_MAP).sort()).toEqual(
      ['area', 'bars', 'mirror', 'orb', 'radial', 'wave']
    );
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
});
