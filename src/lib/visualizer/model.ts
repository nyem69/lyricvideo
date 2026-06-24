// src/lib/visualizer/model.ts
import type { TextStyle, MontageSettings, LyricBand } from '$lib/montage/model';

export type VizStyleId =
  | 'bars'
  | 'mirror'
  | 'radial'
  | 'wave'
  | 'area'
  | 'orb'
  | 'ringwave'
  | 'blob'
  | 'matrix'
  | 'glitch'
  | 'smoke'
  | 'rain'
  | 'snow'
  | 'starfield'
  | 'fog'
  | 'flower'
  | 'garden'
  | 'sakura';
export const DEFAULT_VIZ_STYLE: VizStyleId = 'bars';

/** Preset vertical placement for the visualizer graphics and the lyric band.
 *  Values are the element's vertical CENTRE as a fraction of canvas height:
 *  top = 1/3 from the top, bottom = 1/3 from the bottom, center = halfway. */
export type VAnchor = 'top' | 'center' | 'bottom';
export const V_ANCHOR_FRAC: Record<VAnchor, number> = {
  top: 1 / 3,
  center: 1 / 2,
  bottom: 2 / 3,
};
// Defaults preserve the prior look as closely as the 3 presets allow:
// the visualizer keeps its per-style home (center => zero shift), and the
// lyric sits low (the 1/3-from-bottom line).
export const DEFAULT_VIZ_ANCHOR: VAnchor = 'center';
export const DEFAULT_LYRIC_ANCHOR: VAnchor = 'bottom';

/** Accent color the visualizer graphics are drawn in (antique gold by default).
 *  A `#rrggbb` hex — every style derives its fills/strokes/glows from this. */
export const DEFAULT_VIZ_COLOR = '#d4af37';

/** Surface (background) color painted behind the visualizer when no background
 *  image is set. A `#rrggbb` hex; defaults to the deep-forest stage green. When
 *  a background IMAGE is present this color also tints its dim overlay and the
 *  opening title-card backdrop, so the whole stage stays cohesive. */
export const DEFAULT_VIZ_BG = '#0a1a0a';

/** Colors the shared title-card overlay needs (a subset of MontageStyle):
 *  dark-green surface background + antique-gold divider/accent. */
export const VIZ_TITLE_THEME = { background: '#0a1a0a', accent: '#d4af37' };

export interface VisualizerProject {
  version: 1;
  lyricsText: string;
  videoTitle?: string;
  titleStyle?: TextStyle;
  bandStyle?: TextStyle;
  vizStyleId: VizStyleId;
  // Optional for back-compat: projects saved before placement presets existed
  // restore to the defaults above.
  vizAnchor?: VAnchor;
  lyricAnchor?: VAnchor;
  // Optional for back-compat: projects saved before the color control existed
  // restore to DEFAULT_VIZ_COLOR (gold).
  vizColor?: string;
  // Optional for back-compat: projects saved before the background-color control
  // existed restore to DEFAULT_VIZ_BG (forest green).
  vizBg?: string;
  formatId: string;
  customWidth?: number;
  customHeight?: number;
  backgroundKey?: string;
  audioKey?: string;
  // Non-optional (unlike MontageProject.songDuration?) by design: the store
  // always holds a number here, defaulting to 0 when no audio is loaded.
  songDuration: number;
  settings: MontageSettings;
  updatedAt: number;
}

/** Export duration that never truncates timestamped lyrics: the longest of the
 *  (finite) audio duration, the lyric coverage + tail, and the opening card. */
export function computeTotalDuration(
  songDuration: number,
  bands: LyricBand[],
  settings: MontageSettings
): number {
  const finite = Number.isFinite(songDuration) && songDuration > 0 ? songDuration : 0;
  // Defensive (matches buildTimeline): don't assume bands are sorted by end.
  const lastBandEnd = bands.length ? Math.max(...bands.map((b) => b.end)) : 0;
  return Math.max(finite, lastBandEnd + settings.tailDuration, settings.openingDuration);
}
