// src/lib/renderer/visualizer-renderer.test.ts
import { describe, it, expect } from 'vitest';
import { VisualizerRenderer } from './visualizer-renderer';
import { DEFAULT_SETTINGS } from '$lib/montage/model';

// A canvas whose 2d context records every translate() call. Other ctx methods
// are recording no-ops; gradient factories return an addColorStop stub.
function rendererWithTranslateSpy(width: number, height: number) {
  const translates: Array<[number, number]> = [];
  const ctx = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'translate')
          return (x: number, y: number) => {
            translates.push([x, y]);
          };
        if (prop === 'measureText') return (s: string) => ({ width: String(s).length * 6 });
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
          return () => ({ addColorStop() {} });
        if (prop === 'getByteFrequencyData' || prop === 'getByteTimeDomainData')
          return () => {};
        return () => {};
      },
      set() {
        return true;
      },
    }
  );
  const canvas = { width, height, getContext: () => ctx } as unknown as HTMLCanvasElement;
  const renderer = new VisualizerRenderer({ canvas });
  renderer.setSettings(DEFAULT_SETTINGS);
  return { renderer, translates };
}

describe('VisualizerRenderer placement', () => {
  const H = 1080;

  it('translates the visualizer by (frac-0.5)*H for each anchor', () => {
    // 'wave' is a center-anchored style, so no floor clamp applies.
    for (const [anchor, expected] of [
      ['top', (1 / 3 - 0.5) * H],
      ['center', 0],
      ['bottom', (2 / 3 - 0.5) * H],
    ] as const) {
      const { renderer, translates } = rendererWithTranslateSpy(1920, H);
      renderer.setStyle('wave');
      renderer.setAnchors(anchor, 'bottom');
      renderer.renderAt(0);
      // The viz draw is wrapped in exactly one translate.
      expect(translates.length).toBe(1);
      expect(translates[0][1]).toBeCloseTo(expected, 5);
    }
  });

  it('defaults (center viz anchor) apply zero shift — no regression', () => {
    const { renderer, translates } = rendererWithTranslateSpy(1920, H);
    renderer.setStyle('bars');
    renderer.renderAt(0); // no setAnchors -> defaults
    expect(translates[0][1]).toBeCloseTo(0, 5);
  });
});
