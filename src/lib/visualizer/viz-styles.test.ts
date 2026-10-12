// src/lib/visualizer/viz-styles.test.ts
import { describe, it, expect } from 'vitest';
import { VIZ_STYLES, VIZ_STYLE_MAP, rgba, type VizFrame, type VizText } from './viz-styles';

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
  it('exposes all nineteen styles', () => {
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
      'rain',
      'snow',
      'starfield',
      'fog',
      'flower',
      'garden',
      'sakura',
      'helix',
    ]);
    expect(Object.keys(VIZ_STYLE_MAP).sort()).toEqual([
      'area',
      'bars',
      'blob',
      'flower',
      'fog',
      'garden',
      'glitch',
      'helix',
      'matrix',
      'mirror',
      'orb',
      'radial',
      'rain',
      'ringwave',
      'sakura',
      'smoke',
      'snow',
      'starfield',
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

  describe('helix (lyric-owning)', () => {
    const text = (words: string[], activeTo: number): VizText => ({
      words,
      activeFrom: 0,
      activeTo,
      fontStack: "'Playfair Display', serif",
      fontWeight: 700,
      color: '#fdf6e3',
    });
    const WORDS = 'I DONT WANT YOUR BODY BUT I HATE TO THINK ABOUT YOU WITH SOMEBODY ELSE'.split(' ');

    // A ctx that records fillText calls with the fill colour in force.
    function textCtx() {
      const draws: { word: string; x: number; y: number; color: string; font: string }[] = [];
      let fill = '';
      let font = '';
      const ctx = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === '__draws') return draws;
            if (prop === 'fillText')
              return (word: string, x: number, y: number) => draws.push({ word, x, y, color: fill, font });
            return () => {};
          },
          set(_t, prop: string, value: unknown) {
            if (prop === 'fillStyle') fill = String(value);
            if (prop === 'font') font = String(value);
            return true;
          },
        }
      ) as unknown as CanvasRenderingContext2D;
      return { ctx, draws };
    }
    const frameWith = (ctx: CanvasRenderingContext2D, t: number, tx?: VizText): VizFrame => ({
      ctx,
      w: 1080,
      h: 1920,
      freq: new Uint8Array(1024).fill(120),
      wave: new Uint8Array(2048).fill(128),
      t,
      accent: '#1234ff',
      text: tx,
    });

    it('declares ownership of the lyric layer', () => {
      expect(VIZ_STYLE_MAP.helix.ownsLyrics).toBe(true);
      // and is the only one — every other style still relies on the band
      expect(VIZ_STYLES.filter((s) => s.ownsLyrics).map((s) => s.id)).toEqual(['helix']);
    });

    it('draws every word on both helices, in the lyric font', () => {
      const { ctx, draws } = textCtx();
      VIZ_STYLE_MAP.helix.draw(frameWith(ctx, 1.0, text(WORDS, 4)));
      const main = draws.filter((d) => d.color.endsWith(', 1)') || !d.color.startsWith('rgba'));
      // the full-alpha copy: 15 words x 2 helices
      expect(draws.length).toBeGreaterThanOrEqual(WORDS.length * 2);
      for (const w of WORDS) expect(draws.some((d) => d.word === w)).toBe(true);
      expect(draws.every((d) => d.font.includes("'Playfair Display'") && d.font.startsWith('700 '))).toBe(true);
      void main;
    });

    it('paints the active line in the accent and the rest in the lyric colour', () => {
      const { ctx, draws } = textCtx();
      VIZ_STYLE_MAP.helix.draw(frameWith(ctx, 1.0, text(WORDS, 4)));
      // 'I' recurs at index 6 (inactive), so check the unique active words only.
      const active = draws.filter((d) => ['DONT', 'WANT', 'YOUR'].includes(d.word));
      const rest = draws.filter((d) => d.word === 'ELSE');
      expect(active.every((d) => d.color.includes('18, 52, 255'))).toBe(true);
      expect(rest.every((d) => d.color.includes('253, 246, 227'))).toBe(true);
    });

    it('is a pure function of t (same frame twice => identical draws)', () => {
      const a = textCtx();
      const b = textCtx();
      VIZ_STYLE_MAP.helix.draw(frameWith(a.ctx, 2.345, text(WORDS, 4)));
      VIZ_STYLE_MAP.helix.draw(frameWith(b.ctx, 2.345, text(WORDS, 4)));
      expect(a.draws).toEqual(b.draws);
      const c = textCtx();
      VIZ_STYLE_MAP.helix.draw(frameWith(c.ctx, 2.5, text(WORDS, 4)));
      expect(c.draws).not.toEqual(a.draws);
    });

    it('front words are drawn larger and brighter than back words', () => {
      const { ctx, draws } = textCtx();
      VIZ_STYLE_MAP.helix.draw(frameWith(ctx, 0, text(WORDS, 0)));
      const px = (d: { font: string }) => Number.parseFloat(d.font.split(' ')[1]);
      const alpha = (d: { color: string }) => Number.parseFloat(d.color.slice(d.color.lastIndexOf(',') + 1));
      // The last draw is the front-most particle (sorted back to front).
      const front = draws[draws.length - 1];
      const smallest = draws.reduce((m, d) => (px(d) < px(m) ? d : m), draws[0]);
      expect(px(front)).toBeGreaterThan(px(smallest) * 2);
      expect(alpha(front)).toBeGreaterThan(alpha(smallest));
    });

    it('falls back to an accent-dot ribbon when there are no words', () => {
      const f = frame(1080, 1920, 120);
      VIZ_STYLE_MAP.helix.draw(f);
      const calls = (f.ctx as unknown as { __calls: string[] }).__calls;
      expect(calls).toContain('arc');
      expect(calls).not.toContain('fillText');
    });
  });
});
