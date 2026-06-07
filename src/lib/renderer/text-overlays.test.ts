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
