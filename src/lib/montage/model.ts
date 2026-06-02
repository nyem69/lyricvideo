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
  styleId: string;
  settings: MontageSettings;
  updatedAt: number;
}
