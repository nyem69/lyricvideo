// src/lib/montage/model.ts
export interface Photo {
  id: string;          // nanoid
  name: string;
  width: number;       // post-downscale (matches the stored blob)
  height: number;
  assetKey: string;    // IndexedDB key for the DOWNSCALED blob
}

export type KenBurns = 'in' | 'out' | 'pan-l' | 'pan-r';

export interface PhotoCut {
  photoId: string;
  start: number;       // seconds
  end: number;         // seconds
  kenBurns: KenBurns;
}

export interface LyricBand {
  id: string;
  start: number;
  end: number;
  primary: string;
  secondary?: string;  // translation — unused in v1, typed for the future
  wordTimings?: { word: string; t: number }[];
}

export interface MontageSettings {
  openingDuration: number; // title card before photos
  tailDuration: number;    // after last band
  fps: number;
}

export const DEFAULT_SETTINGS: MontageSettings = {
  openingDuration: 2.5,
  tailDuration: 1.5,
  fps: 30,
};

// User-editable text styling for the title card and the lyric band. Stored
// separately from MontageStyle (which owns palette/motion), so the curated
// style and the per-project text tweaks evolve independently.
export interface TextStyle {
  fontFamilyId: string; // id into the fonts.ts catalog
  fontWeight: number;   // must be a weight the family supports (see coerceWeight)
  sizePct: number;      // glyph height as a fraction of the 1080p frame height
  color: string;        // hex fill
}

export const DEFAULT_TITLE_STYLE: TextStyle = {
  fontFamilyId: 'playfair',
  fontWeight: 700,
  sizePct: 0.08,
  color: '#fdf6e3',
};

export const DEFAULT_BAND_STYLE: TextStyle = {
  fontFamilyId: 'playfair',
  fontWeight: 400,
  sizePct: 0.05,
  color: '#fdf6e3',
};

export interface MontageStyle {
  id: string;
  name: string;
  titleFontFamily: string;
  bandFontFamily: string;
  bandColor: string;       // lyric text color
  scrim: string;           // rgba behind the band text
  background: string;      // fallback fill behind photos
  accent: string;          // divider / title accent
  kenBurnsZoom: number;    // zoom amplitude, e.g. 0.08
  blurFillBlurPx: number;  // blur radius applied to the quarter-res fill
}

export interface MontageProject {
  version: 1;
  photoOrder: string[];    // photo ids in display order
  photos: Photo[];         // metadata only (blobs in IDB)
  audioKey?: string;       // IndexedDB key for the audio blob
  songDuration?: number;   // seconds
  lyricsText: string;      // raw imported timestamp text
  videoTitle?: string;     // user-set title card text; absent on pre-title saves
  titleStyle?: TextStyle;  // absent on saves predating text-style controls
  bandStyle?: TextStyle;   // absent on saves predating text-style controls
  styleId: string;
  settings: MontageSettings;
  updatedAt: number;
}
