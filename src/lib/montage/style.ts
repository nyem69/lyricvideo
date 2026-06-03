// src/lib/montage/style.ts
import type { MontageStyle } from './model';

export const WARM_MEMORY: MontageStyle = {
  id: 'warm-memory',
  name: 'Warm Memory',
  titleFontFamily: "'Playfair Display', serif",
  bandFontFamily: "'Playfair Display', serif",
  bandColor: '#fdf6e3',
  scrim: 'rgba(0, 0, 0, 0.45)',
  background: '#1a120b',
  accent: '#d4af37',
  kenBurnsZoom: 0.08,
  blurFillBlurPx: 28,
};

export const montageStyles: Record<string, MontageStyle> = {
  'warm-memory': WARM_MEMORY,
};

export function getMontageStyle(id: string): MontageStyle {
  return montageStyles[id] ?? WARM_MEMORY;
}
