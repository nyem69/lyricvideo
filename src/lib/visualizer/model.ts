// src/lib/visualizer/model.ts
import type { TextStyle, MontageSettings, LyricBand } from '$lib/montage/model';

export type VizStyleId = 'bars' | 'mirror' | 'radial' | 'wave' | 'area' | 'orb';
export const DEFAULT_VIZ_STYLE: VizStyleId = 'bars';

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
