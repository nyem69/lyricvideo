# Audio Visualizer — Design Spec

**Date:** 2026-06-07
**Status:** Approved (production design, locked)
**Author:** brainstorming session with Nyem
**Sibling of:** `2026-06-03-photo-lyric-montage-ui-design.md`

## 1. Summary

A new browser-only route **`/visualizer`** — a sibling to `/montage`. Instead of a
slideshow of user photos, the canvas renders an **audio-reactive visualizer** driven
by the song's live frequency/waveform data, with the same synced lyric bands, editable
title card, and text styling as the montage feature. Output is the same client-side
WebM export (video + mixed audio). Adds a **video-format preset** selector so a single
project can target YouTube, TikTok, Instagram, or a custom resolution.

Everything is fully client-side (SvelteKit 2 / Svelte 5, `adapter-static`, SPA mode).
No server, no upload of the user's media.

## 2. Goals / Non-goals

**Goals**
- `/visualizer` route mirroring the montage editor shell.
- Six audio-reactive visualizer styles (all of them), user-selectable via a picker.
- Reuse the montage title card + synced lyric bands (timestamped Suno lyrics).
- Reuse the montage per-element text styling (font family/weight/size/color).
- Support a background image (album cover / artwork), behind the visualizer.
- Video-format presets: YouTube (16:9), TikTok/Reels (9:16), Instagram square (1:1),
  plus a custom width×height.
- Reuse the existing real-time WebM export (canvas + mixed audio).

**Non-goals (v1)**
- Auto-extracting embedded ID3 album art from the audio file (deferred — parsing +
  browser-compat risk doesn't belong in the first slice; user uploads the cover image).
- Live mini-thumbnails inside the in-editor style picker (static labels in v1).
- Retrofitting montage to support format presets (montage stays 1920×1080; presets are
  visualizer-only for now — see §10 future work).
- Removing the `/dev/visualizer/*` mockups (they stay deployed; later cleanup).

## 3. Architecture overview

```
/visualizer route
├─ visualizerStore (visualizer.svelte.ts)   state: lyrics, title, styles, vizStyleId,
│                                            backgroundKey, audioKey, formatId/custom dims
├─ playerStore (REUSED + attachAnalyser())   transport clock + the analyser tap
├─ VisualizerStage.svelte                    canvas + RAF preview loop; attaches analyser
│   └─ VisualizerRenderer (NEW)              layered renderAt(t)
│       ├─ background (image cover-fit + blur/dim)  OR solid surface
│       ├─ viz style draw fn (NEW, draw-only, from promoted mockup)
│       ├─ drawTitleCard  ── shared text-overlays.ts (extracted from MontageRenderer)
│       └─ drawLyricBand  ──┘
├─ VizStylePicker.svelte (NEW)               6 labeled style buttons
├─ FormatPicker.svelte (NEW)                 platform presets + custom W×H
├─ TextStylePanel.svelte (REUSED)            title/lyric font controls
├─ Controls.svelte (REUSED)                  play/pause/seek
└─ ExportButton (viz variant)                exportMontage() + analyser hook
```

**Layering principle (same as montage):** the renderer owns the frame composition
(background → visualizer → title → lyric band). Each visualizer style is a pure
draw-only function that paints *only* its graphics over whatever the renderer already
laid down — it does not clear the background or draw text. This is the change from the
mockup styles (which clear + draw their own title for standalone preview).

## 4. The audio-analysis layer

The visualizer needs live FFT data both in preview and during export.

### 4.1 Preview — `playerStore.attachAnalyser()`

`playerStore` currently plays its private `<audio>` element directly (no Web Audio
graph). We add an **opt-in** analyser tap. Montage never calls it, so montage is
unaffected.

```
// playerStore (new private fields)
private audioCtx: AudioContext | null = null;
private analyser: AnalyserNode | null = null;
private srcNode: MediaElementAudioSourceNode | null = null;
private srcEl: HTMLAudioElement | null = null;   // which element srcNode belongs to
private analyserWanted = false;

attachAnalyser(): AnalyserNode {
  this.analyserWanted = true;
  this.buildAnalyserGraph();
  return this.analyser!;   // stable instance — safe for the renderer to cache
}
```

**MediaElementSource footgun (per review):** a given `<audio>` element can be connected
to a `MediaElementAudioSourceNode` **only once in its lifetime**. So:

- `buildAnalyserGraph()` creates `audioCtx` + `analyser` once and reuses them forever.
- It creates `srcNode = audioCtx.createMediaElementSource(el)` **only when the current
  element differs from `srcEl`** (i.e. cache the source node per element). Repeat
  `attachAnalyser()` / `play()` calls do **not** recreate it.
- `playerStore.loadAudio()` swaps in a new `<audio>` element; *after* it does, if
  `analyserWanted` it rebuilds the source node against the new element (and reconnects
  `srcNode → analyser → destination`). This is the ONLY rebuild trigger.
- `play()` resumes a suspended `audioCtx` (Web Audio autoplay-gesture rule).

Because preview transport and analysis share the **same** playing element, lyric-band
timing (`playerStore.currentTime`) and the visualizer never drift.

### 4.2 Export — additive hook on `export.ts`

`exportMontage()` already builds its own `AudioContext` + `<audio>` graph for recording
(`source → dest` + `source → destination`). We add one optional field:

```
interface ExportOptions {
  ...existing...
  onAnalyserReady?: (analyser: AnalyserNode) => void;  // NEW, optional
}
```

When present, after building the source it connects an `AnalyserNode`
(`source → analyser`) and invokes the callback **before** recording starts, so the
renderer can hold the analyser. Montage passes nothing → identical behavior. Export is
real-time (audio plays in real time, frames driven by the wall clock), so per-frame
analyser reads inside `renderFrame` are correctly synced.

Preview and export use **separate** analysers, but never run simultaneously
(`exporting` flag stands the preview loop down — same mechanism as montage).

## 5. VisualizerRenderer (new)

`src/lib/renderer/visualizer-renderer.ts`, parallels `MontageRenderer`.

State setters: `setAnalyser(a)`, `setStyle(id)`, `setBackground(bmp | null)`,
`setBands(bands)`, `setTitle(title)`, `setTextStyles(title, band)`, `setSettings(s)`,
`resize(w, h)`.

```
renderAt(t):
  1. read analyser → freq[] (getByteFrequencyData), wave[] (getByteTimeDomainData)
     (if no analyser yet: leave buffers zeroed → a flat/quiet frame, no throw)
  2. background:
       if backgroundBmp: cover-fit draw, then a dim overlay (configurable alpha) and
                         optional blur, so bright art doesn't kill text/viz legibility
       else: fill solid `surface` color
  3. style.draw({ ctx, w, h, freq, wave, t, accent })   // viz graphics only
  4. if t < settings.openingDuration && title: drawTitleCard(...)   // shared helper
  5. band = active band at t; if band: drawLyricBand(...)           // shared helper
```

The renderer is dimension-agnostic: it draws to `canvas.width × canvas.height`, which
the format preset sets (§7). All style + overlay math is W/H-relative, so any aspect
ratio renders correctly.

## 6. Shared text-overlays extraction (refactor)

`MontageRenderer.drawBand`, `drawTitleCard`, and the module-level `wrapText` move
**verbatim** into `src/lib/renderer/text-overlays.ts` as pure functions:

```
drawLyricBand(ctx, band, W, H, bandStyle): void   // shadow + thin outline + fill
drawTitleCard(ctx, title, W, H, titleStyle, montageStyle): void  // title + gold divider
wrapText(ctx, text, maxWidth): string[]
```

- **Narrowly mechanical:** same inputs, same visual math, same constants. No behavior
  change. `MontageRenderer` is updated to delegate to these helpers; `VisualizerRenderer`
  calls the same ones → lyric/title look is pixel-identical across both features.
- `drawTitleCard` keeps its dependency on the montage `style` (background + accent
  colors) — the visualizer passes a style object (its own `surface`/`gold`) so the title
  card composes the same way.
- **Verification:** a montage smoke check (browser-verify recipe from the montage
  handoff) after the extraction to confirm zero rendering drift.

## 7. Video format presets (new)

`src/lib/visualizer/formats.ts`:

```
interface VideoFormat { id, label, group, width, height }   // group e.g. 'YouTube'
FORMATS: [
  { id: 'youtube',        label: 'YouTube (16:9)',        width: 1920, height: 1080 },
  { id: 'tiktok',         label: 'TikTok / Reels (9:16)', width: 1080, height: 1920 },
  { id: 'ig-feed',        label: 'Instagram Square (1:1)',width: 1080, height: 1080 },
  { id: 'ig-story',       label: 'Instagram Story (9:16)',width: 1080, height: 1920 },
  // 'custom' handled separately via customWidth/customHeight in the store
]
DEFAULT_FORMAT = 'youtube'
coerceCustomDims(w, h): clamp to [256, 3840], even numbers (encoder-friendly)
resolveFormat(store): { width, height }   // preset dims, or coerced custom dims
```

Effects of the active format:
- `VisualizerStage` resizes the canvas to the resolved `width × height`.
- The stage preview container uses the matching aspect ratio (inline
  `aspect-ratio: w / h`, not the fixed `aspect-video`).
- Export records at the canvas resolution (no extra work — `captureStream` follows
  canvas size).

`custom` reveals two number inputs (W, H), routed through `coerceCustomDims`. Invalid /
extreme values snap to bounds — the single place dims are validated (mirrors the
`coerceWeight`/`coerceTextStyle` invariant from montage).

## 8. Store, model, persistence

`src/lib/visualizer/model.ts`:

```
type VizStyleId = 'bars' | 'mirror' | 'radial' | 'wave' | 'area' | 'orb';

interface VisualizerProject {
  version: 1;
  lyricsText: string;
  videoTitle?: string;
  titleStyle?: TextStyle;       // reused from montage/model
  bandStyle?: TextStyle;
  vizStyleId: VizStyleId;
  formatId: string;             // preset id or 'custom'
  customWidth?: number;
  customHeight?: number;
  backgroundKey?: string;       // asset-store key for the bg image blob
  audioKey?: string;
  songDuration: number;
  settings: MontageSettings;    // reuse (openingDuration, tail, etc.)
  updatedAt: number;
}
```

`src/lib/stores/visualizer.svelte.ts` — `visualizerStore`, mirrors `montageStore`
minus photos/cuts:

- `$state`: `lyricsText`, `videoTitle`, `titleStyle`, `bandStyle`, `vizStyleId`,
  `formatId`, `customWidth`, `customHeight`, `backgroundKey`, `audioKey`,
  `songDuration`, `settings`, `ready`, `exporting`.
- `$derived`: `song` (parsed), `bands` (deriveBands), `title` (videoTitle || 'Visualizer'),
  `dims` (resolveFormat), `totalDuration` (= songDuration, clamped finite; no photo cuts).
- Methods: `importLyrics`, `loadAudio` (reuses asset-store + playerStore + metadata
  probe, same as montage), `setBackground(file)` / `removeBackground`, `setVizStyle`,
  `setFormat(id)` / `setCustomDims(w,h)`, `setTitle`, `setTitleStyle`/`setBandStyle`
  (route through `coerceTextStyle`), `persist`, `restore` (default-backfill + coerce).
- **Separate localStorage key** (e.g. `visualizer-project-v1`) so it never collides
  with the montage project. Audio + background blobs in the shared IndexedDB asset-store
  under namespaced keys (`audio:*`, `vizbg:*`).

`project-store.ts` is generalized to take a storage key (or a thin viz-specific
save/load is added) so both projects persist independently.

## 9. Styles — promotion from mockup

The six draw functions in `src/lib/dev/visualizer/viz-styles.ts` move to
`src/lib/visualizer/viz-styles.ts`, refactored to **draw-only**:

- Remove `clearBg(...)` and `drawTitle(...)` from each (renderer owns bg + title).
- Keep the `buckets`/`bass` helpers and the gold/accent palette.
- Signature: `draw({ ctx, w, h, freq, wave, t, accent })` — `accent` lets the renderer
  pass the active gold so styles aren't hardcoded if we theme later.
- Export `VIZ_STYLES` (ordered) + `VIZ_STYLE_MAP`.

The `/dev/visualizer/*` mockup keeps its own copy (standalone, self-clearing) until the
later cleanup — the production module is the refactored draw-only version.

## 10. UI / route

`src/routes/visualizer/+page.svelte` — montage's sidebar layout:

- Video Title input
- Song upload ("Add Song")
- Lyrics textarea (timestamps) — same import path as montage
- **Background image** upload + remove (shows filename / clear)
- **Visualizer style** picker (`VizStylePicker.svelte` — 6 labeled buttons, selected
  highlighted)
- **Video format** picker (`FormatPicker.svelte` — platform presets + custom W×H)
- TextStylePanel (reused)
- Stage: `VisualizerStage.svelte` (canvas, RAF loop, analyser attach, dynamic aspect)
- Controls (reused)
- Export button (viz variant, wires `onAnalyserReady`, filename from title)

Nav cross-links: montage ↔ visualizer ↔ lyrics-only home. Links use `base` from
`$app/paths` (not `import.meta.env.BASE_URL`).

## 11. Testing

Test env is `node` with **no** Svelte plugin → only pure modules get unit tests;
`*.svelte.ts` stores are browser-verified.

**Unit (vitest):**
- `viz-styles`: each draw fn against a stub `CanvasRenderingContext2D` (records calls) —
  asserts it draws without throwing across aspect ratios (landscape/portrait/square) and
  with all-zero vs full-scale freq buffers.
- `text-overlays`: `wrapText` line-breaking; `drawLyricBand`/`drawTitleCard` smoke
  (stub ctx, no throw, expected fill/stroke calls).
- `formats`: `resolveFormat` for each preset + `coerceCustomDims` clamping (bounds, odd
  → even, NaN/Infinity → default).
- `visualizer` model: `VisualizerProject` persistence round-trip (save → load → equal),
  default-backfill of optional fields.

**Browser-verified (handoff recipe — `pnpm build` + `pnpm preview`, drive via Playwright
`browser_evaluate`):**
- Preview reacts to loaded audio (analyser non-zero while playing).
- Style switch repaints; format switch resizes canvas + container aspect.
- Background image draws under the visualizer; title card + lyric band render on top.
- Export produces a playable WebM with audio at the selected resolution.
- **Montage regression smoke** — montage still renders identically after the
  text-overlays extraction.

## 12. File inventory

**New**
- `src/lib/visualizer/model.ts`
- `src/lib/visualizer/viz-styles.ts` (draw-only, promoted)
- `src/lib/visualizer/formats.ts`
- `src/lib/renderer/visualizer-renderer.ts`
- `src/lib/renderer/text-overlays.ts` (extracted shared helpers)
- `src/lib/stores/visualizer.svelte.ts`
- `src/lib/components/Visualizer/VisualizerStage.svelte`
- `src/lib/components/Visualizer/VizStylePicker.svelte`
- `src/lib/components/Visualizer/FormatPicker.svelte`
- `src/lib/components/Visualizer/ExportButton.svelte`
- `src/routes/visualizer/+page.svelte`
- tests: `viz-styles.test.ts`, `text-overlays.test.ts`, `formats.test.ts`,
  `visualizer-store`/model round-trip test.

**Modified**
- `src/lib/stores/player.svelte.ts` — `attachAnalyser()` + per-element source caching.
- `src/lib/montage/export.ts` — optional `onAnalyserReady` hook.
- `src/lib/renderer/montage-renderer.ts` — delegate band/title/wrap to `text-overlays.ts`.
- `src/lib/storage/project-store.ts` — parameterize storage key (or add viz save/load).
- nav links in montage/home (cross-link the new route).

**Unchanged**
- All visualizer styles are W/H-relative → no special-casing per aspect.
- Montage visual output (guarded by the smoke check).

## 13. Future work (noted, not in v1)
- ID3 embedded album-art auto-extract (fallback to upload).
- Live mini-thumbnails in the in-editor style picker.
- Format presets for montage (same `formats.ts`).
- Drag-to-reorder + per-style tuning params (sensitivity, color themes).
- Remove `/dev/visualizer/*` mockups once the production feature ships.
