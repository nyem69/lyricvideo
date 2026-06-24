// src/lib/renderer/text-overlays.test.ts
import { describe, it, expect } from 'vitest';
import { wrapText, drawLyricBand, drawTitleCard } from './text-overlays';
import { DEFAULT_TITLE_STYLE, DEFAULT_BAND_STYLE } from '$lib/montage/model';

// A Proxy ctx: every method is a recording no-op; measureText returns width by
// length; gradient factories return an object with addColorStop.
function stubCtx() {
  const calls: string[] = [];
  const ctx = new Proxy(
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
  return ctx;
}

describe('wrapText', () => {
  it('keeps a short line on one row', () => {
    expect(wrapText(stubCtx(), 'hello world', 1000)).toEqual(['hello world']);
  });
  it('wraps when the row exceeds maxWidth', () => {
    // each char = 6px; "aaaaa bbbbb" = 11 chars = 66px > 60 -> each word its own line
    const lines = wrapText(stubCtx(), 'aaaaa bbbbb ccccc', 60);
    expect(lines).toEqual(['aaaaa', 'bbbbb', 'ccccc']);
  });
});

describe('overlay draws (smoke)', () => {
  it('drawLyricBand issues fill + stroke calls without throwing', () => {
    const ctx = stubCtx();
    drawLyricBand(ctx, { id: 'a', start: 0, end: 2, primary: 'a lyric line' }, 1920, 1080, DEFAULT_BAND_STYLE);
    expect((ctx as unknown as { __calls: string[] }).__calls).toContain('fillText');
    expect((ctx as unknown as { __calls: string[] }).__calls).toContain('strokeText');
  });
  // Capture the y-coord passed to fillText so we can assert vertical placement.
  function yCapturingCtx() {
    const ys: number[] = [];
    const ctx = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === '__ys') return ys;
          if (prop === 'measureText') return (s: string) => ({ width: String(s).length * 6 });
          if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
            return () => ({ addColorStop() {} });
          if (prop === 'fillText')
            return (_s: string, _x: number, y: number) => {
              ys.push(y);
            };
          return () => {};
        },
        set() {
          return true;
        },
      }
    ) as unknown as CanvasRenderingContext2D;
    return ctx;
  }

  const BAND = { id: 'a', start: 0, end: 2, primary: 'a lyric line' };

  it('drawLyricBand moves the block up as anchorY decreases', () => {
    const top = yCapturingCtx();
    const center = yCapturingCtx();
    const bottom = yCapturingCtx();
    drawLyricBand(top, BAND, 1920, 1080, DEFAULT_BAND_STYLE, 1 / 3);
    drawLyricBand(center, BAND, 1920, 1080, DEFAULT_BAND_STYLE, 1 / 2);
    drawLyricBand(bottom, BAND, 1920, 1080, DEFAULT_BAND_STYLE, 2 / 3);
    const yTop = (top as unknown as { __ys: number[] }).__ys[0];
    const yCenter = (center as unknown as { __ys: number[] }).__ys[0];
    const yBottom = (bottom as unknown as { __ys: number[] }).__ys[0];
    expect(yTop).toBeLessThan(yCenter);
    expect(yCenter).toBeLessThan(yBottom);
    // center preset centres a single line near the canvas midline
    expect(yCenter).toBeCloseTo(540, 0);
  });

  it('drawLyricBand legacy (no anchorY) keeps the historical bottom placement', () => {
    const ctx = yCapturingCtx();
    drawLyricBand(ctx, BAND, 1920, 1080, DEFAULT_BAND_STYLE);
    // One line: topY = 0.86*H - blockH, y = topY + lineH/2 = 0.86*H - lineH/2.
    const fontPx = Math.round(1080 * DEFAULT_BAND_STYLE.sizePct);
    const expected = 0.86 * 1080 - (fontPx * 1.25) / 2;
    expect((ctx as unknown as { __ys: number[] }).__ys[0]).toBeCloseTo(expected, 0);
  });

  it('glitch band adds chromatic-split passes (3 fillText/line vs 1)', () => {
    const plain = stubCtx();
    const glitch = stubCtx();
    drawLyricBand(plain, BAND, 1920, 1080, DEFAULT_BAND_STYLE, 1 / 2, 1.5);
    drawLyricBand(glitch, BAND, 1920, 1080, { ...DEFAULT_BAND_STYLE, glitch: true }, 1 / 2, 1.5);
    const count = (c: CanvasRenderingContext2D) =>
      (c as unknown as { __calls: string[] }).__calls.filter((k) => k === 'fillText').length;
    expect(count(plain)).toBe(1); // single line: one fill
    expect(count(glitch)).toBe(3); // cyan ghost + magenta ghost + main fill
  });

  it('drawTitleCard issues fill + stroke calls without throwing', () => {
    const ctx = stubCtx();
    drawTitleCard(ctx, 'My Title', 1920, 1080, DEFAULT_TITLE_STYLE, {
      background: '#000',
      accent: '#d4af37',
    });
    expect((ctx as unknown as { __calls: string[] }).__calls).toContain('fillText');
    expect((ctx as unknown as { __calls: string[] }).__calls).toContain('stroke');
  });
});
