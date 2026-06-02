# Photo-Lyric Montage — Browser UI (v1) Design

**Date:** 2026-06-03
**Status:** Approved (pending implementation plan)
**Repo:** `nyem69/lyricvideo` (SvelteKit 2 + Svelte 5 runes, browser-only, static deploy)

## Summary

Add a browser-only **photo montage** mode to the lyricvideo app: the user loads
personal photos + a song, imports word-level lyric timestamps, picks a style,
previews a Ken-Burns photo montage with synced lyric bands, and downloads the
result as a video — all client-side, with the project surviving a page refresh.

This is the browser equivalent of the server-side `photo-lyric-montage`
OpenMontage/Remotion skill, redesigned for a non-technical user: **no Python,
Node, Remotion, ffmpeg, or terminal.**

The six-step user journey:

1. Add photos
2. Add song
3. Paste/import lyric timestamps
4. Pick a style
5. Preview
6. Click **Download Video**

## Scope

This spec is **one coherent MVP** covering three phases that the single-canvas
decision makes inseparable:

- **P1 — Preview:** photos + Ken Burns + synced lyric bands, live on a `<canvas>`.
- **P2 — Export:** record the same canvas + audio → downloadable WebM.
- **P3 — Persistence:** IndexedDB blobs + abstracted metadata store; auto-restore
  the last project on load. (Bundled, not deferred — losing uploaded
  photos/audio on refresh is a product failure for non-technical users.)

### Out of scope (v1 — future specs)

- Bilingual lyric bands (primary + translation). *Typed for, not built.*
- `edit_decisions.json` advanced/Remotion export (Phase 4).
- MP4 via ffmpeg.wasm (WebM only in v1).
- Beat / emotional-arc photo curation (even auto-distribution + manual reorder only).
- Per-photo manual timing.
- Multi-project management (single "last project" only).

## Key Decisions

1. **Separate `/montage` route**, leaving `/` as the existing lyrics-only app.
   Different workflow, assets, persistence, and export behavior — keep it
   purpose-built rather than bloating the current page.
2. **Single canvas renderer drives both preview and export (WYSIWYG).** The most
   important architectural decision: what the user previews is pixel-identical to
   what downloads. No CSS-preview / canvas-export drift.
3. **`MontageRenderer` has a montage-specific API**, *not* force-fit into the
   existing section-based `Renderer` interface (which was shaped for lyric
   sections). The existing `CssRenderer` / `Renderer` interface is untouched and
   continues to serve the lyrics-only mode at `/`.
4. **Single-language lyric bands in v1**, but `LyricBand` is typed so bilingual /
   section captions can be added without a renderer rewrite.
5. **WebM-first export** via `MediaRecorder`; Chrome/Edge are the supported export
   browsers for v1. ffmpeg.wasm → MP4 deferred.

## Architecture

```
/                       existing lyrics-only app (CssRenderer) — UNTOUCHED
/montage                new photo-montage mode (MontageRenderer)

src/lib/
  montage/
    model.ts            types: Photo, PhotoCut, LyricBand, MontageProject, MontageSettings, MontageStyle
    bands.ts            PURE: Song -> LyricBand[]
    timeline.ts         PURE: (nPhotos, songDuration, bands, settings) -> PhotoCut[]
    export.ts           ExportController: seek->record->play->stop->restore -> WebM
  renderer/
    montage-renderer.ts MontageRenderer: draws photos + Ken Burns + bands; renderAt(t)
    image-cache.ts      sliding-window ImageBitmap cache + downscale-on-decode
  storage/
    asset-store.ts      IndexedDB blob store (photos + audio), key -> Blob
    project-store.ts    metadata persistence behind an abstract interface (localStorage v1)
  stores/
    montage.svelte.ts   singleton rune store: photos, order, timeline, styleId, settings
  components/Montage/
    PhotoTray.svelte    upload / reorder / delete / count+size warnings
    MontageStage.svelte canvas mount + rAF preview loop, player wiring
    ExportButton.svelte triggers ExportController, shows "Recording..." state

src/routes/montage/
    +page.svelte        the montage workflow layout
```

Reused as-is: `Editor/LyricsImport.svelte`, `Player/Controls.svelte`,
`stores/player.svelte.ts` (the clock), `parser/suno.ts`.

## Data Model

```ts
// Photo metadata — the DOWNSCALED, render-safe blob lives in IndexedDB under assetKey.
// v1 does NOT keep the original upload: we downscale on import and store only the
// canvas-safe blob, so restore/export are predictable and giant photos can't blow memory.
type Photo = {
  id: string;            // nanoid
  name: string;
  width: number;         // post-downscale (matches the stored blob)
  height: number;
  assetKey: string;      // IndexedDB key for the downscaled Blob
};

// One on-screen photo cut, computed by timeline.ts
type PhotoCut = {
  photoId: string;
  start: number;         // seconds
  end: number;           // seconds
  kenBurns: 'in' | 'out' | 'pan-l' | 'pan-r'; // cycled
};

// Typed for the future (bilingual/word highlight) but v1 fills only id/start/end/primary
type LyricBand = {
  id: string;
  start: number;
  end: number;
  primary: string;
  secondary?: string;    // translation — v1 leaves undefined
  wordTimings?: { word: string; t: number }[]; // future word highlight
};

type MontageSettings = {
  openingDuration: number; // default 2.5  — title card before photos
  tailDuration: number;    // default 1.5  — after last band
  fps: number;             // default 30
};

type MontageStyle = {
  id: string;              // 'warm-memory' (v1 ships one)
  // band typography, scrim, Ken Burns easing, blur-fill params...
};

type MontageProject = {
  version: 1;
  photoOrder: string[];        // photo ids in display order
  photos: Photo[];             // metadata only (blobs in IDB)
  audioKey?: string;           // IndexedDB key for the audio Blob
  songDuration?: number;       // seconds
  lyricsText: string;          // raw imported timestamp text
  styleId: string;
  settings: MontageSettings;
  updatedAt: number;
};
```

## Pure Logic (DOM-free, unit-tested)

### `bands.ts` — `Song -> LyricBand[]`

One band per lyric line. Mirrors the skill's rule:

- `start` = first word onset of the line.
- `computedEnd` = `min(nextLineOnset - 0.25, lastWordOfLine + 1.8)` so lines hand
  off and fade across instrumental gaps.
- Last line: `computedEnd = lastWord + 1.8`.
- **Minimum-visible guard (dense/overlapping lyrics):**
  `end = max(start + 0.4, computedEnd)`. Prevents zero/negative-duration bands
  when fast lines push `nextLineOnset - 0.25` at or before `start`.

### `timeline.ts` — `(nPhotos, songDuration, bands, settings) -> PhotoCut[]`

- Photos span `settings.openingDuration -> lastBand.end + settings.tailDuration`
  (or `songDuration` if no bands), so photos run *under* every lyric line and
  cards never collide with the band.
- `step = (spanEnd - openingDuration) / nPhotos`; each cut
  `start = openingDuration + i*step`, `end = start + step`.
- `kenBurns` cycles through the four variants by index.
- `openingDuration` / `tailDuration` are **inputs**, never hardcoded — keeps the
  function pure and free of style assumptions.

**`PhotoCut[]` is derived, not persisted (v1).** Cuts are recomputed from
`photoOrder` + `songDuration` + `settings` + `bands` on load and on any change.
`MontageProject` deliberately stores none of them — there is no per-photo manual
timing in v1, so persisting cuts would only risk drift from their inputs.

## Renderer — `MontageRenderer`

Montage-specific API (not the section `Renderer` interface):

```ts
loadAssets({ photos, imageCache })
setBands(bands: LyricBand[])
setCuts(cuts: PhotoCut[])
setStyle(style: MontageStyle)
resize(width, height)
renderAt(timeSeconds): void   // deterministic — same t -> same frame
getCanvas(): HTMLCanvasElement
```

Responsibilities owned by the renderer: image draw + object-fit (contain),
quarter-res blur-fill background for aspect mismatch, Ken Burns pan/zoom, lyric
band layout + scrim + text wrapping, title/credit cards, safe margins.
`renderAt(t)` is deterministic so preview and export produce identical frames.

- **Preview:** `MontageStage` runs a `requestAnimationFrame` loop calling
  `renderAt(playerStore.currentTime)`.
- **Export:** the `ExportController` calls `renderAt` on the same canvas.

### `image-cache.ts`

- On import, **downscale to canvas-safe dimensions** (≤ render size) and store
  *that* blob in IDB (see `Photo` above — the original is not kept). Decode the
  stored blob to `ImageBitmap` for rendering.
- Sliding window: keep bitmaps for cuts near the current time; release far ones.

## Export — `ExportController`

Decoupled from live UI playback so pause/resume/seek bugs can't corrupt a
recording:

1. Save current player state (time, paused).
2. Seek to 0.
3. Build the stream: `canvas.captureStream(fps)` video track +
   audio track from a WebAudio `MediaStreamDestination` (reliable mixing, not raw
   `audio.captureStream()`).
4. Start `MediaRecorder` (codec feature-detected: VP9 → VP8 → default).
5. Play; drive `renderAt` from an **export-local clock** — elapsed recording time
   / `AudioContext.currentTime`, **not** `playerStore.currentTime` — so export is
   deterministic and fully decoupled from UI playback. Run to `songDuration`.
6. Stop recorder at duration; assemble Blob; trigger download (`<song>.webm`).
7. Restore saved player state.

UI shows a **"Recording…"** state — capture is real-time, so export takes ~song
length.

### Caveats (surfaced in UI copy)

- Chrome/Edge supported for export in v1. Safari `MediaRecorder`/WebM is
  unreliable → Safari gets preview (and, later, the JSON fallback).
- MP4 via ffmpeg.wasm is a future enhancement; v1 outputs WebM.

## Persistence

- **Blobs (photos + audio):** IndexedDB via `asset-store.ts` (`key -> Blob`).
  Handles hundreds of MB.
- **Metadata (`MontageProject`):** behind an **abstract `ProjectStore`
  interface**; v1 implementation writes JSON to localStorage
  (`montage:lastProject`). Interface keeps a later move to IDB painless if
  lyrics text + cut arrays + photo metadata grow.
- **Restore on load:** read metadata → rehydrate blobs from IDB by key → restore
  store + player duration. Debounced save on change.

### Upload limits (v1)

- Soft cap ~**50 photos**; warn (not hard-block) beyond it.
- Warn on very large images; downscale on decode regardless.

## Styles (v1)

Ship **one** style — **"Warm Memory"** (contain + blur-fill, scrimmed lyric band,
slow Ken Burns; matches the Karabatan reference) — structured as a montage preset
so more can be added. Canvas text kept to a controlled single-band layout with a
wrapping helper.

## Testing

- **vitest (DOM-free), same style as `parser/suno.test.ts`:**
  - `bands.ts` — onset/out rule, hand-off clamping, last-line case.
  - `timeline.ts` — span math, step, opening/tail honored, kenBurns cycling,
    edge cases (0 bands, 1 photo).
- **Manual smoke (must include refresh-restore, since P3 is bundled):**
  1. Upload photos + audio.
  2. Import lyrics.
  3. **Refresh the page → confirm the project restores.**
  4. Preview (photos under bands, no collisions).
  5. Export a short video and play it back.

## Risks / Notes

- Real-time export = export duration ≈ song duration; communicated via UI state.
- Canvas text is less convenient than CSS (wrapping/fonts/shadows) — mitigated by
  a small controlled style set and a wrapping helper rather than arbitrary CSS.
- Base path is `/lyricvideo` (or `''` under `CAPACITOR=true`) — the new route must
  respect it.
- App is `ssr = false` / `prerender = false` (client SPA); all montage code is
  client-only.
