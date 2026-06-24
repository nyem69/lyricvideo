// src/lib/montage/fonts.test.ts
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  FONT_FAMILIES,
  getFontFamily,
  coerceWeight,
  coerceTextStyle,
  ensureFontLoaded,
} from './fonts';
import { DEFAULT_TITLE_STYLE } from './model';

describe('font catalog', () => {
  it('exposes only families whose webfonts are actually loaded', () => {
    // Keep in lockstep with the <link> in app.html — a family here that isn't
    // loaded there silently renders as a system fallback on the canvas.
    expect(FONT_FAMILIES.map((f) => f.id).sort()).toEqual([
      'anton',
      'bebas',
      'bungee',
      'great-vibes',
      'metal-mania',
      'nosifer',
      'playfair',
      'raleway',
      'rubik-distressed',
      'rubik-spray',
      'special-elite',
    ]);
  });

  it('every catalog family is loaded by the app.html font link', () => {
    const html = readFileSync('src/app.html', 'utf8');
    const link = html.match(/fonts\.googleapis\.com\/css2\?[^"']+/)?.[0] ?? '';
    expect(link).not.toBe('');
    for (const f of FONT_FAMILIES) {
      const name = f.stack.match(/'([^']+)'/)?.[1] ?? '';
      const token = name.replace(/ /g, '+');
      expect(link, `${f.id} (${name}) must be in the app.html font link`).toContain(
        `family=${token}`
      );
    }
  });

  it('every family has a defaultWeight that is one of its weights', () => {
    for (const f of FONT_FAMILIES) {
      expect(f.weights).toContain(f.defaultWeight);
      expect(f.weights).toEqual([...f.weights].sort((a, b) => a - b)); // ascending
    }
  });

  it('getFontFamily falls back to playfair for an unknown id', () => {
    expect(getFontFamily('does-not-exist').id).toBe('playfair');
    expect(getFontFamily('raleway').id).toBe('raleway');
  });
});

describe('coerceWeight (the only place weights are snapped)', () => {
  it('keeps a weight the family supports', () => {
    expect(coerceWeight('playfair', 700)).toBe(700);
    expect(coerceWeight('raleway', 600)).toBe(600);
  });

  it('snaps an unsupported weight to the family default', () => {
    expect(coerceWeight('playfair', 500)).toBe(getFontFamily('playfair').defaultWeight);
    expect(coerceWeight('great-vibes', 700)).toBe(400); // script has only 400
    expect(coerceWeight('bebas', 900)).toBe(400);
  });

  it('resolves an unknown family before snapping', () => {
    expect(coerceWeight('nope', 999)).toBe(getFontFamily('playfair').defaultWeight);
  });
});

describe('coerceTextStyle', () => {
  it('snaps an invalid weight for the family, leaving other fields intact', () => {
    const styled = { ...DEFAULT_TITLE_STYLE, fontFamilyId: 'great-vibes', fontWeight: 700 };
    const out = coerceTextStyle(styled);
    expect(out.fontWeight).toBe(400); // great-vibes only has 400
    expect(out.fontFamilyId).toBe('great-vibes');
    expect(out.color).toBe(DEFAULT_TITLE_STYLE.color);
    expect(out.sizePct).toBe(DEFAULT_TITLE_STYLE.sizePct);
  });

  it('returns the same object reference when already valid (no needless churn)', () => {
    const styled = { ...DEFAULT_TITLE_STYLE, fontFamilyId: 'playfair', fontWeight: 900 };
    expect(coerceTextStyle(styled)).toBe(styled);
  });
});

describe('ensureFontLoaded browser-safety', () => {
  it('resolves to undefined when document.fonts is unavailable (SSR/node)', async () => {
    // vitest runs in the node environment — no document here.
    await expect(ensureFontLoaded("'Playfair Display', serif", 700)).resolves.toBeUndefined();
  });

  it('never rejects even if fonts.load throws', async () => {
    const g = globalThis as unknown as { document?: unknown };
    g.document = { fonts: { load: () => { throw new Error('boom'); } } };
    try {
      await expect(ensureFontLoaded("'Bebas Neue', sans-serif", 400)).resolves.toBeUndefined();
    } finally {
      delete g.document;
    }
  });
});
