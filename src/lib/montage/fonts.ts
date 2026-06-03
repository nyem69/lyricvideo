// src/lib/montage/fonts.ts
import type { TextStyle } from './model';
// Curated font catalog. Only families whose webfonts are loaded in app.html
// belong here — the canvas renderer can only draw glyphs the browser has, so
// offering an unloaded family would silently fall back to a system font.

export interface FontFamily {
  id: string;
  label: string;
  stack: string; // CSS font-family value passed to ctx.font / document.fonts.load
  weights: number[]; // ascending; the weights actually loaded in app.html
  defaultWeight: number;
}

export const FONT_FAMILIES: FontFamily[] = [
  {
    id: 'playfair',
    label: 'Playfair Display',
    stack: "'Playfair Display', serif",
    weights: [400, 700, 900],
    defaultWeight: 400,
  },
  {
    id: 'great-vibes',
    label: 'Great Vibes',
    stack: "'Great Vibes', cursive",
    weights: [400],
    defaultWeight: 400,
  },
  {
    id: 'bebas',
    label: 'Bebas Neue',
    stack: "'Bebas Neue', sans-serif",
    weights: [400],
    defaultWeight: 400,
  },
  {
    id: 'raleway',
    label: 'Raleway',
    stack: "'Raleway', sans-serif",
    weights: [100, 200, 300, 400, 600],
    defaultWeight: 400,
  },
];

const FALLBACK = FONT_FAMILIES[0]; // playfair

/** Resolve a family id to its catalog entry, falling back to Playfair. */
export function getFontFamily(id: string): FontFamily {
  return FONT_FAMILIES.find((f) => f.id === id) ?? FALLBACK;
}

/**
 * The SINGLE place weights are validated against a family. Returns `weight` if
 * the (resolved) family supports it, otherwise the family's default weight.
 * Callers must route every weight/family change through here so the UI and the
 * persisted project never hold an invalid family/weight combination.
 */
export function coerceWeight(familyId: string, weight: number): number {
  const family = getFontFamily(familyId);
  return family.weights.includes(weight) ? weight : family.defaultWeight;
}

/**
 * Return a TextStyle with its weight re-validated against its family. The store
 * routes every edit and restore through here, so an in-memory or persisted
 * TextStyle can never hold a family/weight combination the family doesn't have.
 */
export function coerceTextStyle(style: TextStyle): TextStyle {
  const fontWeight = coerceWeight(style.fontFamilyId, style.fontWeight);
  return fontWeight === style.fontWeight ? style : { ...style, fontWeight };
}

/**
 * Ask the browser to load a font face before the canvas tries to draw it, so a
 * freshly-picked family isn't rendered as a system fallback for the first few
 * frames. Browser-safe: a no-op resolved promise when document.fonts is absent
 * (SSR/node), and it never rejects (a load failure just means the next render
 * falls back, which is acceptable).
 */
export async function ensureFontLoaded(stack: string, weight: number): Promise<void> {
  const fonts = (globalThis as { document?: { fonts?: { load?: (s: string) => Promise<unknown> } } })
    .document?.fonts;
  if (!fonts || typeof fonts.load !== 'function') return;
  try {
    await fonts.load(`${weight} 16px ${stack}`);
  } catch {
    // font failed to load — the renderer will fall back; not fatal
  }
}
