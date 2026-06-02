# Photo-Lyric Montage UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browser-only photo-montage mode to the lyricvideo app — load photos + song + lyric timestamps, preview a Ken-Burns montage with synced lyric bands on a single canvas, download it as WebM, and have the project survive a page refresh.

**Architecture:** A new `/montage` route drives a montage-specific `MontageRenderer` that paints photos + Ken Burns + lyric bands onto one `<canvas>`. Preview is that canvas live; export records the same canvas via `captureStream()` mixed with audio through `MediaRecorder`. Pure logic (band derivation, photo-cut timeline, downscale math, project (de)serialization) is DOM-free and unit-tested with vitest; canvas/IndexedDB/MediaRecorder code is browser-only and verified manually in `pnpm dev`.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript strict, Tailwind v4, vitest (node env), nanoid, `@lucide/svelte`, `svelte-sonner`. IndexedDB for blobs, localStorage for metadata, Canvas 2D + WebAudio + MediaRecorder for render/export.

**Spec:** `docs/superpowers/specs/2026-06-03-photo-lyric-montage-ui-design.md`

---

## File Structure

Created:
- `src/lib/montage/model.ts` — montage types + default settings
- `src/lib/montage/bands.ts` — PURE: `Song -> LyricBand[]`
- `src/lib/montage/bands.test.ts`
- `src/lib/montage/timeline.ts` — PURE: photo-cut derivation
- `src/lib/montage/timeline.test.ts`
- `src/lib/montage/export.ts` — `exportMontage()` controller
- `src/lib/storage/asset-store.ts` — IndexedDB blob store
- `src/lib/storage/project-store.ts` — metadata persistence behind a KV interface
- `src/lib/storage/project-store.test.ts`
- `src/lib/renderer/image-cache.ts` — downscale-on-import + ImageBitmap cache
- `src/lib/renderer/image-cache.test.ts` — (downscale math only)
- `src/lib/renderer/montage-renderer.ts` — canvas renderer
- `src/lib/montage/style.ts` — the one v1 montage style ("Warm Memory")
- `src/lib/stores/montage.svelte.ts` — singleton montage store
- `src/lib/components/Montage/PhotoTray.svelte`
- `src/lib/components/Montage/MontageStage.svelte`
- `src/lib/components/Montage/ExportButton.svelte`
- `src/routes/montage/+page.svelte`

Reused unchanged: `src/lib/parser/suno.ts`, `src/lib/stores/player.svelte.ts`, `src/lib/components/Editor/LyricsImport.svelte` (pattern reference), `src/lib/model/types.ts`.

---

## Task 1: Montage data model

**Files:**
- Create: `src/lib/montage/model.ts`

- [ ] **Step 1: Write `model.ts`**

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS (no errors in `model.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/montage/model.ts
git commit -m "feat(montage): data model + default settings"
```

---

## Task 2: Band derivation (`bands.ts`) — TDD

**Files:**
- Create: `src/lib/montage/bands.ts`
- Test: `src/lib/montage/bands.test.ts`

Rule: one band per lyric line (flattened across sections). `start` = line's first-word onset; `lastWord` = last-word onset; `computedEnd = min(nextLineOnset - 0.25, lastWord + 1.8)` (last line: `lastWord + 1.8`); minimum-visible guard `end = max(start + 0.4, computedEnd)`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/montage/bands.test.ts
import { describe, it, expect } from 'vitest';
import { parseSunoTimestamps } from '$lib/parser/suno';
import { deriveBands } from './bands';

describe('deriveBands', () => {
  it('returns [] for null song', () => {
    expect(deriveBands(null)).toEqual([]);
  });

  it('derives one band per line with primary text', () => {
    const song = parseSunoTimestamps(
      '[00:10.000] hello [00:11.000] world\n[00:20.000] second [00:21.000] line'
    );
    const bands = deriveBands(song);
    expect(bands).toHaveLength(2);
    expect(bands[0].primary).toBe('hello world');
    expect(bands[0].start).toBe(10);
  });

  it('clamps end to hand off 0.25s before the next line onset', () => {
    // line1 lastWord = 11.0 -> lastWord+1.8 = 12.8; nextOnset 20 -> 19.75; min = 12.8
    const song = parseSunoTimestamps(
      '[00:10.000] a [00:11.000] b\n[00:20.000] c [00:21.000] d'
    );
    const bands = deriveBands(song);
    expect(bands[0].end).toBeCloseTo(12.8, 3);
  });

  it('uses nextOnset-0.25 when lines are close together', () => {
    // line1 lastWord = 10.2 -> +1.8 = 12.0; nextOnset 11 -> 10.75; min = 10.75
    const song = parseSunoTimestamps(
      '[00:10.000] a [00:10.200] b\n[00:11.000] c'
    );
    const bands = deriveBands(song);
    expect(bands[0].end).toBeCloseTo(10.75, 3);
  });

  it('enforces a 0.4s minimum visible duration on dense lines', () => {
    // line1 start 10.0, lastWord 10.0 -> +1.8 = 11.8; nextOnset 10.1 -> 9.85; min = 9.85
    // guard: max(10.0 + 0.4, 9.85) = 10.4
    const song = parseSunoTimestamps('[00:10.000] a\n[00:10.100] b');
    const bands = deriveBands(song);
    expect(bands[0].end).toBeCloseTo(10.4, 3);
    expect(bands[0].end).toBeGreaterThan(bands[0].start);
  });

  it('ends the last line at lastWord + 1.8', () => {
    const song = parseSunoTimestamps('[00:10.000] a [00:12.000] b');
    const bands = deriveBands(song);
    expect(bands[0].end).toBeCloseTo(13.8, 3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/montage/bands.test.ts`
Expected: FAIL — "Cannot find module './bands'" / `deriveBands is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/montage/bands.ts
import type { Song } from '$lib/model/types';
import type { LyricBand } from './model';

const MIN_VISIBLE = 0.4;
const HANGOVER = 1.8;
const HANDOFF_GAP = 0.25;

export function deriveBands(song: Song | null): LyricBand[] {
  if (!song) return [];
  const lines = song.sections.flatMap((s) => s.lines);
  const bands: LyricBand[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const start = line.startTime;
    const lastWord =
      line.words.length > 0 ? line.words[line.words.length - 1].startTime : start;
    const nextOnset = i < lines.length - 1 ? lines[i + 1].startTime : undefined;

    const computedEnd =
      nextOnset !== undefined
        ? Math.min(nextOnset - HANDOFF_GAP, lastWord + HANGOVER)
        : lastWord + HANGOVER;

    const end = Math.max(start + MIN_VISIBLE, computedEnd);
    bands.push({ id: line.id, start, end, primary: line.text });
  }

  return bands;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/montage/bands.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/montage/bands.ts src/lib/montage/bands.test.ts
git commit -m "feat(montage): derive lyric bands from Song with min-visible guard"
```

---

## Task 3: Photo-cut timeline (`timeline.ts`) — TDD

**Files:**
- Create: `src/lib/montage/timeline.ts`
- Test: `src/lib/montage/timeline.test.ts`

Photos span `openingDuration -> (lastBandEnd + tailDuration)`, or `songDuration` when there are no bands. `step = (spanEnd - openingDuration) / n`; cuts are contiguous; `kenBurns` cycles `in, out, pan-l, pan-r`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/montage/timeline.test.ts
import { describe, it, expect } from 'vitest';
import { buildTimeline } from './timeline';
import { DEFAULT_SETTINGS, type LyricBand } from './model';

const band = (start: number, end: number): LyricBand => ({
  id: `${start}`, start, end, primary: 'x',
});

describe('buildTimeline', () => {
  it('returns [] when there are no photos', () => {
    expect(buildTimeline([], 100, [], DEFAULT_SETTINGS)).toEqual([]);
  });

  it('spans opening -> lastBandEnd + tail when bands exist', () => {
    const cuts = buildTimeline(['a', 'b'], 100, [band(10, 30)], DEFAULT_SETTINGS);
    // spanEnd = 30 + 1.5 = 31.5; step = (31.5 - 2.5)/2 = 14.5
    expect(cuts).toHaveLength(2);
    expect(cuts[0].start).toBeCloseTo(2.5, 3);
    expect(cuts[0].end).toBeCloseTo(17.0, 3);
    expect(cuts[1].start).toBeCloseTo(17.0, 3);
    expect(cuts[1].end).toBeCloseTo(31.5, 3);
  });

  it('falls back to songDuration when there are no bands', () => {
    const cuts = buildTimeline(['a', 'b', 'c'], 60, [], DEFAULT_SETTINGS);
    // spanEnd = 60; step = (60 - 2.5)/3 = 19.1667
    expect(cuts[2].end).toBeCloseTo(60, 3);
  });

  it('cycles ken burns variants by index', () => {
    const cuts = buildTimeline(['a', 'b', 'c', 'd', 'e'], 100, [band(5, 80)], DEFAULT_SETTINGS);
    expect(cuts.map((c) => c.kenBurns)).toEqual(['in', 'out', 'pan-l', 'pan-r', 'in']);
  });

  it('never produces zero/negative-length cuts even with a tiny span', () => {
    const cuts = buildTimeline(['a', 'b'], 1, [], DEFAULT_SETTINGS);
    for (const c of cuts) expect(c.end).toBeGreaterThan(c.start);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/montage/timeline.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/montage/timeline.ts
import type { LyricBand, PhotoCut, MontageSettings, KenBurns } from './model';

const KEN_BURNS_CYCLE: KenBurns[] = ['in', 'out', 'pan-l', 'pan-r'];

export function buildTimeline(
  photoIds: string[],
  songDuration: number,
  bands: LyricBand[],
  settings: MontageSettings
): PhotoCut[] {
  const n = photoIds.length;
  if (n === 0) return [];

  const lastBandEnd = bands.length > 0 ? Math.max(...bands.map((b) => b.end)) : 0;
  const rawSpanEnd = lastBandEnd > 0 ? lastBandEnd + settings.tailDuration : songDuration;
  // Guarantee a positive span so steps are never zero/negative.
  const spanEnd = Math.max(rawSpanEnd, settings.openingDuration + 1);

  const step = (spanEnd - settings.openingDuration) / n;
  const cuts: PhotoCut[] = [];
  for (let i = 0; i < n; i++) {
    const start = settings.openingDuration + i * step;
    cuts.push({
      photoId: photoIds[i],
      start,
      end: start + step,
      kenBurns: KEN_BURNS_CYCLE[i % KEN_BURNS_CYCLE.length],
    });
  }
  return cuts;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/montage/timeline.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/montage/timeline.ts src/lib/montage/timeline.test.ts
git commit -m "feat(montage): derive photo-cut timeline from photos + bands"
```

---

## Task 4: Project metadata store (`project-store.ts`) — TDD

**Files:**
- Create: `src/lib/storage/project-store.ts`
- Test: `src/lib/storage/project-store.test.ts`

A tiny KV abstraction so metadata can move off localStorage later without touching call sites. Save/load logic is pure and tested with an in-memory backend.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/storage/project-store.test.ts
import { describe, it, expect } from 'vitest';
import { saveProject, loadProject, clearProject, type KvBackend } from './project-store';
import { DEFAULT_SETTINGS, type MontageProject } from '$lib/montage/model';

function memoryBackend(): KvBackend {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const sample: MontageProject = {
  version: 1,
  photoOrder: ['p1'],
  photos: [{ id: 'p1', name: 'a.jpg', width: 800, height: 600, assetKey: 'asset:p1' }],
  lyricsText: '[00:01.000] hi',
  styleId: 'warm-memory',
  settings: DEFAULT_SETTINGS,
  updatedAt: 123,
};

describe('project-store', () => {
  it('returns null when nothing saved', () => {
    expect(loadProject(memoryBackend())).toBeNull();
  });

  it('round-trips a saved project', () => {
    const b = memoryBackend();
    saveProject(sample, b);
    expect(loadProject(b)).toEqual(sample);
  });

  it('returns null on a version mismatch', () => {
    const b = memoryBackend();
    b.setItem('montage:lastProject', JSON.stringify({ ...sample, version: 99 }));
    expect(loadProject(b)).toBeNull();
  });

  it('returns null on corrupt JSON', () => {
    const b = memoryBackend();
    b.setItem('montage:lastProject', '{not json');
    expect(loadProject(b)).toBeNull();
  });

  it('clears a saved project', () => {
    const b = memoryBackend();
    saveProject(sample, b);
    clearProject(b);
    expect(loadProject(b)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/storage/project-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/storage/project-store.ts
import type { MontageProject } from '$lib/montage/model';

export interface KvBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY = 'montage:lastProject';

export function saveProject(project: MontageProject, backend: KvBackend): void {
  backend.setItem(KEY, JSON.stringify(project));
}

export function loadProject(backend: KvBackend): MontageProject | null {
  const raw = backend.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1) return parsed as MontageProject;
    return null;
  } catch {
    return null;
  }
}

export function clearProject(backend: KvBackend): void {
  backend.removeItem(KEY);
}

export const localStorageBackend: KvBackend = {
  getItem: (k) => (typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null),
  setItem: (k, v) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(k, v);
  },
  removeItem: (k) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/storage/project-store.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/project-store.ts src/lib/storage/project-store.test.ts
git commit -m "feat(montage): KV-backed project metadata persistence"
```

---

## Task 5: IndexedDB asset store (`asset-store.ts`)

**Files:**
- Create: `src/lib/storage/asset-store.ts`

Browser-only (IndexedDB is unavailable in the vitest node env), so verify manually in the browser console.

- [ ] **Step 1: Write `asset-store.ts`**

```ts
// src/lib/storage/asset-store.ts
const DB_NAME = 'lyricvideo';
const STORE = 'assets';
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putAsset(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function getAsset(key: string): Promise<Blob | null> {
  const db = await openDb();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function deleteAsset(key: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function listAssetKeys(): Promise<string[]> {
  const db = await openDb();
  try {
    return await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Manual verify (browser console)**

Run `pnpm dev`, open `http://localhost:5178/lyricvideo`, then in the DevTools console:

```js
const m = await import('/src/lib/storage/asset-store.ts');
await m.putAsset('t1', new Blob(['hi'], { type: 'text/plain' }));
console.log(await (await m.getAsset('t1')).text()); // "hi"
console.log(await m.listAssetKeys());               // ["t1"]
await m.deleteAsset('t1');
console.log(await m.getAsset('t1'));                // null
```

Expected: logs `hi`, `["t1"]`, `null`. (Application tab → IndexedDB → `lyricvideo` → `assets` shows the row while present.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage/asset-store.ts
git commit -m "feat(montage): IndexedDB blob asset store"
```

---

## Task 6: Image cache + downscale (`image-cache.ts`) — partial TDD

**Files:**
- Create: `src/lib/renderer/image-cache.ts`
- Test: `src/lib/renderer/image-cache.test.ts` (downscale math only)

`computeDownscaledSize` is pure and tested. `downscaleToBlob` and `ImageCache` use canvas/ImageBitmap (browser-only) and are verified in Task 11's preview.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/renderer/image-cache.test.ts
import { describe, it, expect } from 'vitest';
import { computeDownscaledSize } from './image-cache';

describe('computeDownscaledSize', () => {
  it('leaves small images untouched', () => {
    expect(computeDownscaledSize(800, 600, 1920)).toEqual({ width: 800, height: 600 });
  });

  it('scales landscape down to maxDim on the long edge', () => {
    expect(computeDownscaledSize(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 });
  });

  it('scales portrait down to maxDim on the long edge', () => {
    expect(computeDownscaledSize(3000, 4000, 1920)).toEqual({ width: 1440, height: 1920 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/renderer/image-cache.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `image-cache.ts`**

```ts
// src/lib/renderer/image-cache.ts
export const MAX_DIM = 1920;

export function computeDownscaledSize(
  w: number,
  h: number,
  maxDim: number
): { width: number; height: number } {
  if (w <= maxDim && h <= maxDim) return { width: w, height: h };
  const scale = maxDim / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

/** Decode a user file, downscale to a canvas-safe size, return a JPEG blob + dims. */
export async function downscaleToBlob(
  file: File,
  maxDim = MAX_DIM
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = computeDownscaledSize(bitmap.width, bitmap.height, maxDim);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.9);
  });
  return { blob, width, height };
}

/** LRU-ish ImageBitmap cache backed by an async blob loader (the IDB asset store). */
export class ImageCache {
  private cache = new Map<string, ImageBitmap>();
  private order: string[] = [];

  constructor(
    private loader: (key: string) => Promise<Blob | null>,
    private maxEntries = 12
  ) {}

  async get(key: string): Promise<ImageBitmap | null> {
    const existing = this.cache.get(key);
    if (existing) return existing;
    const blob = await this.loader(key);
    if (!blob) return null;
    const bmp = await createImageBitmap(blob);
    this.cache.set(key, bmp);
    this.order.push(key);
    while (this.order.length > this.maxEntries) {
      const evict = this.order.shift();
      if (evict !== undefined) {
        this.cache.get(evict)?.close();
        this.cache.delete(evict);
      }
    }
    return bmp;
  }

  clear(): void {
    for (const b of this.cache.values()) b.close();
    this.cache.clear();
    this.order = [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/renderer/image-cache.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/renderer/image-cache.ts src/lib/renderer/image-cache.test.ts
git commit -m "feat(montage): image downscale + ImageBitmap cache"
```

---

## Task 7: The v1 montage style (`style.ts`)

**Files:**
- Create: `src/lib/montage/style.ts`

- [ ] **Step 1: Write `style.ts`**

```ts
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
```

- [ ] **Step 2: Ensure Playfair Display is available**

Check `src/app.html` for a Playfair Display `<link>`. If absent, add inside `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap" rel="stylesheet" />
```

(Per CLAUDE.md, fonts are loaded via Google Fonts `<link>` in `src/app.html`.)

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm check`
Expected: PASS.

```bash
git add src/lib/montage/style.ts src/app.html
git commit -m "feat(montage): Warm Memory style preset + Playfair font"
```

---

## Task 8: Canvas renderer (`montage-renderer.ts`)

**Files:**
- Create: `src/lib/renderer/montage-renderer.ts`

Browser-only; verified by the preview in Task 10. `renderAt(t)` is deterministic: same `t` → same frame. It draws (1) a blur-fill background of the active photo, (2) the photo `contain`-fit with a Ken Burns transform, (3) the opening title card while `t < openingDuration`, and (4) the active lyric band with a scrim.

- [ ] **Step 1: Write `montage-renderer.ts`**

```ts
// src/lib/renderer/montage-renderer.ts
import type { Photo, PhotoCut, LyricBand, MontageStyle, MontageSettings } from '$lib/montage/model';
import { ImageCache } from './image-cache';

interface RendererDeps {
  canvas: HTMLCanvasElement;
  imageCache: ImageCache;
}

export class MontageRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cache: ImageCache;

  private photos = new Map<string, Photo>();
  private cuts: PhotoCut[] = [];
  private bands: LyricBand[] = [];
  private style!: MontageStyle;
  private settings!: MontageSettings;
  private title = '';

  constructor({ canvas, imageCache }: RendererDeps) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
  }

  setPhotos(photos: Photo[]) {
    this.photos = new Map(photos.map((p) => [p.id, p]));
  }
  setCuts(cuts: PhotoCut[]) {
    this.cuts = cuts;
  }
  setBands(bands: LyricBand[]) {
    this.bands = bands;
  }
  setStyle(style: MontageStyle) {
    this.style = style;
  }
  setSettings(settings: MontageSettings) {
    this.settings = settings;
  }
  setTitle(title: string) {
    this.title = title;
  }
  getCanvas() {
    return this.canvas;
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /** Prefetch bitmaps for the cut active at time t (and the next), so draws don't flash. */
  async warm(t: number) {
    const idx = this.cuts.findIndex((c) => t >= c.start && t < c.end);
    for (const i of [idx, idx + 1]) {
      const cut = this.cuts[i];
      const photo = cut && this.photos.get(cut.photoId);
      if (photo) await this.cache.get(photo.assetKey);
    }
  }

  renderAt(t: number) {
    const { ctx, canvas, style } = this;
    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, W, H);

    const cut = this.cuts.find((c) => t >= c.start && t < c.end) ?? null;
    if (cut) {
      const photo = this.photos.get(cut.photoId);
      const bmp = photo ? this.cacheSync(photo.assetKey) : null;
      if (bmp) {
        const progress = (t - cut.start) / Math.max(0.001, cut.end - cut.start);
        this.drawBlurFill(bmp, W, H);
        this.drawPhoto(bmp, W, H, cut.kenBurns, progress);
      }
    }

    if (t < this.settings.openingDuration && this.title) {
      this.drawTitleCard(this.title, W, H);
    }

    const band = this.bands.find((b) => t >= b.start && t < b.end) ?? null;
    if (band) this.drawBand(band, W, H);
  }

  // --- ImageCache exposes async get(); keep a tiny sync mirror the cache fills via warm()
  private bitmapMirror = new Map<string, ImageBitmap>();
  private cacheSync(key: string): ImageBitmap | null {
    const cached = this.bitmapMirror.get(key);
    if (cached) return cached;
    // kick off async load; mirror is populated on resolve for the next frame
    void this.cache.get(key).then((b) => {
      if (b) this.bitmapMirror.set(key, b);
    });
    return null;
  }

  private drawBlurFill(bmp: ImageBitmap, W: number, H: number) {
    const { ctx, style } = this;
    ctx.save();
    ctx.filter = `blur(${style.blurFillBlurPx}px)`;
    // cover-fit (fill the frame), zoomed slightly so blurred edges don't show
    const scale = Math.max(W / bmp.width, H / bmp.height) * 1.1;
    const w = bmp.width * scale;
    const h = bmp.height * scale;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(bmp, (W - w) / 2, (H - h) / 2, w, h);
    ctx.restore();
  }

  private drawPhoto(bmp: ImageBitmap, W: number, H: number, kb: PhotoCut['kenBurns'], p: number) {
    const { ctx, style } = this;
    // contain-fit
    const fit = Math.min(W / bmp.width, H / bmp.height);
    const baseW = bmp.width * fit;
    const baseH = bmp.height * fit;

    // Ken Burns: zoom and/or pan via eased progress
    const z = style.kenBurnsZoom;
    const ease = p * p * (3 - 2 * p); // smoothstep
    let zoom = 1;
    let dx = 0;
    let dy = 0;
    const panAmt = 0.06; // fraction of frame
    if (kb === 'in') zoom = 1 + z * ease;
    else if (kb === 'out') zoom = 1 + z * (1 - ease);
    else if (kb === 'pan-l') {
      zoom = 1 + z;
      dx = (panAmt * W) * (0.5 - ease);
    } else if (kb === 'pan-r') {
      zoom = 1 + z;
      dx = (panAmt * W) * (ease - 0.5);
    }

    const w = baseW * zoom;
    const h = baseH * zoom;
    ctx.drawImage(bmp, (W - w) / 2 + dx, (H - h) / 2 + dy, w, h);
  }

  private drawBand(band: LyricBand, W: number, H: number) {
    const { ctx, style } = this;
    const fontPx = Math.round(H * 0.05);
    ctx.font = `italic 500 ${fontPx}px ${style.bandFontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = wrapText(ctx, band.primary, W * 0.82);
    const lineH = fontPx * 1.25;
    const bottomY = H * 0.86;
    const blockH = lines.length * lineH;

    // scrim
    const scrimTop = bottomY - blockH - fontPx * 0.6;
    ctx.fillStyle = style.scrim;
    ctx.fillRect(0, scrimTop, W, H - scrimTop);

    ctx.fillStyle = style.bandColor;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = fontPx * 0.4;
    lines.forEach((ln, i) => {
      const y = bottomY - blockH + i * lineH + lineH / 2;
      ctx.fillText(ln, W / 2, y);
    });
    ctx.shadowBlur = 0;
  }

  private drawTitleCard(title: string, W: number, H: number) {
    const { ctx, style } = this;
    ctx.save();
    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, W, H);
    const fontPx = Math.round(H * 0.08);
    ctx.font = `500 ${fontPx}px ${style.titleFontFamily}`;
    ctx.fillStyle = style.bandColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, W / 2, H / 2 - fontPx * 0.3);
    // gold divider
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = Math.max(1, H * 0.003);
    ctx.beginPath();
    ctx.moveTo(W / 2 - W * 0.08, H / 2 + fontPx * 0.5);
    ctx.lineTo(W / 2 + W * 0.08, H / 2 + fontPx * 0.5);
    ctx.stroke();
    ctx.restore();
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const tentative = current ? `${current} ${word}` : word;
    if (ctx.measureText(tentative).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = tentative;
    }
  }
  if (current) lines.push(current);
  return lines;
}
```

> **Note on the bitmap mirror:** the renderer must paint synchronously inside `renderAt`, but the cache loads bitmaps asynchronously. `setPhotos`/`setCuts` plus calling `await renderer.warm(t)` before the rAF tick (done in Task 10) keeps the mirror populated so frames don't flash. Wire the `ImageCache` instance into the renderer via the constructor in Task 10; the `cache` field is assigned there.

- [ ] **Step 2: Fix the cache wiring**

The constructor destructures `imageCache` but the field is named `cache`. Update the constructor body to assign it:

```ts
  constructor({ canvas, imageCache }: RendererDeps) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.cache = imageCache;
  }
```

- [ ] **Step 3: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/renderer/montage-renderer.ts
git commit -m "feat(montage): canvas renderer (photo + ken burns + lyric band + title card)"
```

---

## Task 9: Montage store (`montage.svelte.ts`)

**Files:**
- Create: `src/lib/stores/montage.svelte.ts`

Singleton rune store (mirrors `projectStore`). Owns photos/order/lyrics/settings/style; derives bands + cuts; persists metadata (localStorage) and blobs (IDB); restores on construction.

- [ ] **Step 1: Write `montage.svelte.ts`**

```ts
// src/lib/stores/montage.svelte.ts
import { nanoid } from 'nanoid';
import type { Photo, MontageProject } from '$lib/montage/model';
import { DEFAULT_SETTINGS } from '$lib/montage/model';
import { deriveBands } from '$lib/montage/bands';
import { buildTimeline } from '$lib/montage/timeline';
import { parseSunoTimestamps } from '$lib/parser/suno';
import { downscaleToBlob } from '$lib/renderer/image-cache';
import { putAsset, getAsset, deleteAsset } from '$lib/storage/asset-store';
import { saveProject, loadProject, localStorageBackend } from '$lib/storage/project-store';
import { playerStore } from './player.svelte';

export const PHOTO_SOFT_CAP = 50;

class MontageStore {
  photos = $state<Photo[]>([]);
  lyricsText = $state('');
  styleId = $state('warm-memory');
  settings = $state({ ...DEFAULT_SETTINGS });
  audioKey = $state<string | undefined>(undefined);
  songDuration = $state(0);
  ready = $state(false);

  private song = $derived(this.lyricsText ? parseSunoTimestamps(this.lyricsText) : null);
  readonly bands = $derived(deriveBands(this.song));
  readonly cuts = $derived(
    buildTimeline(
      this.photos.map((p) => p.id),
      this.songDuration || (this.song?.duration ?? 0),
      this.bands,
      this.settings
    )
  );
  readonly title = $derived(this.song?.title || 'Montage');

  async addPhotos(files: File[]) {
    for (const file of files) {
      if (this.photos.length >= PHOTO_SOFT_CAP) break;
      const { blob, width, height } = await downscaleToBlob(file);
      const id = nanoid();
      const assetKey = `photo:${id}`;
      await putAsset(assetKey, blob);
      this.photos = [...this.photos, { id, name: file.name, width, height, assetKey }];
    }
    this.persist();
  }

  async removePhoto(id: string) {
    const photo = this.photos.find((p) => p.id === id);
    if (photo) await deleteAsset(photo.assetKey);
    this.photos = this.photos.filter((p) => p.id !== id);
    this.persist();
  }

  reorder(fromIndex: number, toIndex: number) {
    const next = [...this.photos];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    this.photos = next;
    this.persist();
  }

  importLyrics(text: string) {
    this.lyricsText = text;
    const song = parseSunoTimestamps(text);
    if (!this.audioKey) {
      this.songDuration = song.duration;
      playerStore.setDuration(song.duration);
    }
    this.persist();
  }

  async loadAudio(file: File) {
    const key = `audio:${nanoid()}`;
    await putAsset(key, file);
    this.audioKey = key;
    playerStore.loadAudio(file);
    // playerStore reads duration async on loadedmetadata; mirror it shortly after
    setTimeout(() => {
      if (playerStore.duration > 0) {
        this.songDuration = playerStore.duration;
        this.persist();
      }
    }, 300);
    this.persist();
  }

  setStyle(id: string) {
    this.styleId = id;
    this.persist();
  }

  private persist() {
    const project: MontageProject = {
      version: 1,
      photoOrder: this.photos.map((p) => p.id),
      photos: this.photos,
      audioKey: this.audioKey,
      songDuration: this.songDuration,
      lyricsText: this.lyricsText,
      styleId: this.styleId,
      settings: this.settings,
      updatedAt: Date.now(),
    };
    saveProject(project, localStorageBackend);
  }

  async restore() {
    const project = loadProject(localStorageBackend);
    if (project) {
      // photoOrder is authoritative; re-sort the stored metadata by it
      const byId = new Map(project.photos.map((p) => [p.id, p]));
      this.photos = project.photoOrder.map((id) => byId.get(id)).filter((p): p is Photo => !!p);
      this.lyricsText = project.lyricsText;
      this.styleId = project.styleId;
      this.settings = project.settings;
      this.audioKey = project.audioKey;
      this.songDuration = project.songDuration ?? 0;

      if (this.lyricsText && !this.audioKey) {
        playerStore.setDuration(this.songDuration);
      }
      if (this.audioKey) {
        const blob = await getAsset(this.audioKey);
        if (blob) playerStore.loadAudio(new File([blob], 'audio'));
      }
    }
    this.ready = true;
  }
}

export const montageStore = new MontageStore();
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/montage.svelte.ts
git commit -m "feat(montage): singleton store wiring photos, lyrics, persistence, restore"
```

---

## Task 10: PhotoTray + MontageStage components

**Files:**
- Create: `src/lib/components/Montage/PhotoTray.svelte`
- Create: `src/lib/components/Montage/MontageStage.svelte`

- [ ] **Step 1: Write `PhotoTray.svelte`**

```svelte
<!-- src/lib/components/Montage/PhotoTray.svelte -->
<script lang="ts">
  import { montageStore, PHOTO_SOFT_CAP } from '$lib/stores/montage.svelte';
  import { toast } from 'svelte-sonner';
  import { X } from '@lucide/svelte';

  let fileInput: HTMLInputElement;

  async function onFiles(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    if (montageStore.photos.length + files.length > PHOTO_SOFT_CAP) {
      toast.warning(`Soft limit is ${PHOTO_SOFT_CAP} photos; extra files past the cap are skipped.`);
    }
    await montageStore.addPhotos(files);
    toast.success(`${montageStore.photos.length} photos loaded`);
    input.value = '';
  }
</script>

<div class="flex flex-col gap-3">
  <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif">
    Photos ({montageStore.photos.length}/{PHOTO_SOFT_CAP})
  </span>
  <input bind:this={fileInput} type="file" accept="image/*" multiple class="hidden" onchange={onFiles} />
  <button
    onclick={() => fileInput.click()}
    class="bg-gold/15 border border-gold/30 text-gold px-4 py-2 text-sm tracking-widest uppercase rounded cursor-pointer hover:bg-gold/30 hover:border-gold transition-all"
    style="font-family:'Raleway',sans-serif"
  >
    Add Photos
  </button>

  <div class="grid grid-cols-4 gap-2">
    {#each montageStore.photos as photo, i (photo.id)}
      <div class="relative aspect-square bg-white/5 border border-gold/10 rounded overflow-hidden text-[10px] text-white/40 flex items-center justify-center">
        <span class="px-1 text-center break-all">{i + 1}. {photo.name}</span>
        <button
          onclick={() => montageStore.removePhoto(photo.id)}
          class="absolute top-0 right-0 bg-black/60 text-white/70 hover:text-white p-0.5"
          aria-label="Remove photo"
        >
          <X size={12} />
        </button>
      </div>
    {/each}
  </div>
</div>
```

> Reorder UI is intentionally minimal in v1 (upload order = display order; delete supported). `montageStore.reorder()` exists for a future drag handle — do not block v1 on it.

- [ ] **Step 2: Write `MontageStage.svelte`**

```svelte
<!-- src/lib/components/Montage/MontageStage.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { montageStore } from '$lib/stores/montage.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { MontageRenderer } from '$lib/renderer/montage-renderer';
  import { ImageCache } from '$lib/renderer/image-cache';
  import { getMontageStyle } from '$lib/montage/style';
  import { getAsset } from '$lib/storage/asset-store';

  let canvas = $state<HTMLCanvasElement>();
  let renderer: MontageRenderer | null = null;
  let raf = 0;

  // Expose the canvas for the export controller (Task 11).
  export function getCanvas(): HTMLCanvasElement | undefined {
    return canvas;
  }

  onMount(() => {
    if (!canvas) return;
    const cache = new ImageCache((key) => getAsset(key));
    renderer = new MontageRenderer({ canvas, imageCache: cache });
    renderer.resize(1920, 1080);
    renderer.setSettings(montageStore.settings);

    const loop = async () => {
      if (renderer) {
        renderer.setPhotos(montageStore.photos);
        renderer.setCuts(montageStore.cuts);
        renderer.setBands(montageStore.bands);
        renderer.setStyle(getMontageStyle(montageStore.styleId));
        renderer.setSettings(montageStore.settings);
        renderer.setTitle(montageStore.title);
        await renderer.warm(playerStore.currentTime);
        renderer.renderAt(playerStore.currentTime);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  });

  onDestroy(() => cancelAnimationFrame(raf));
</script>

<div class="w-full aspect-video bg-black rounded overflow-hidden border border-gold/10">
  <canvas bind:this={canvas} class="w-full h-full object-contain"></canvas>
</div>
```

- [ ] **Step 3: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/Montage/PhotoTray.svelte src/lib/components/Montage/MontageStage.svelte
git commit -m "feat(montage): PhotoTray + canvas MontageStage preview"
```

---

## Task 11: Export controller + button

**Files:**
- Create: `src/lib/montage/export.ts`
- Create: `src/lib/components/Montage/ExportButton.svelte`

Records the live canvas + audio via `MediaRecorder`, driven by an export-local clock independent of `playerStore`.

- [ ] **Step 1: Write `export.ts`**

```ts
// src/lib/montage/export.ts
export interface ExportOptions {
  canvas: HTMLCanvasElement;
  audioFile: Blob | null;
  durationSec: number;
  fps: number;
  renderFrame: (t: number) => void; // paints the canvas at export-local time t
  onProgress?: (frac: number) => void;
}

function pickMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return 'video/webm';
}

/** Record the canvas + (optional) audio to a WebM blob. Resolves when recording stops. */
export async function exportMontage(opts: ExportOptions): Promise<Blob> {
  const { canvas, audioFile, durationSec, fps, renderFrame, onProgress } = opts;

  const videoStream = canvas.captureStream(fps);
  const tracks = [...videoStream.getVideoTracks()];

  let audioCtx: AudioContext | null = null;
  let audioEl: HTMLAudioElement | null = null;
  if (audioFile) {
    audioCtx = new AudioContext();
    audioEl = new Audio();
    audioEl.src = URL.createObjectURL(audioFile);
    await audioEl.play().catch(() => {}); // unlock; will be restarted below
    audioEl.pause();
    audioEl.currentTime = 0;
    const source = audioCtx.createMediaElementSource(audioEl);
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);
    source.connect(audioCtx.destination);
    tracks.push(...dest.stream.getAudioTracks());
  }

  const mixed = new MediaStream(tracks);
  const recorder = new MediaRecorder(mixed, { mimeType: pickMimeType() });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
  });

  recorder.start();
  if (audioEl && audioCtx) {
    await audioCtx.resume();
    audioEl.currentTime = 0;
    void audioEl.play();
  }

  // Export-local clock: drive frames from elapsed wall time, not playerStore.
  const startMs = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = (performance.now() - startMs) / 1000;
      if (t >= durationSec) {
        renderFrame(durationSec);
        resolve();
        return;
      }
      renderFrame(t);
      onProgress?.(t / durationSec);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  recorder.stop();
  if (audioEl) {
    audioEl.pause();
    URL.revokeObjectURL(audioEl.src);
  }
  await audioCtx?.close();

  return done;
}
```

- [ ] **Step 2: Write `ExportButton.svelte`**

```svelte
<!-- src/lib/components/Montage/ExportButton.svelte -->
<script lang="ts">
  import { montageStore } from '$lib/stores/montage.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { exportMontage } from '$lib/montage/export';
  import { MontageRenderer } from '$lib/renderer/montage-renderer';
  import { ImageCache } from '$lib/renderer/image-cache';
  import { getMontageStyle } from '$lib/montage/style';
  import { getAsset } from '$lib/storage/asset-store';
  import { toast } from 'svelte-sonner';

  let { getCanvas }: { getCanvas: () => HTMLCanvasElement | undefined } = $props();

  let recording = $state(false);
  let progress = $state(0);

  async function onExport() {
    const canvas = getCanvas();
    if (!canvas) return toast.error('Canvas not ready');
    if (montageStore.photos.length === 0) return toast.error('Add photos first');

    const duration = montageStore.songDuration || playerStore.duration;
    if (!duration) return toast.error('Add a song or lyrics to set the duration');

    recording = true;
    progress = 0;
    playerStore.pause();

    // Dedicated renderer bound to the SAME canvas, driven by the export clock.
    const cache = new ImageCache((key) => getAsset(key));
    const renderer = new MontageRenderer({ canvas, imageCache: cache });
    renderer.resize(1920, 1080);
    renderer.setPhotos(montageStore.photos);
    renderer.setCuts(montageStore.cuts);
    renderer.setBands(montageStore.bands);
    renderer.setStyle(getMontageStyle(montageStore.styleId));
    renderer.setSettings(montageStore.settings);
    renderer.setTitle(montageStore.title);

    const audioBlob = montageStore.audioKey ? await getAsset(montageStore.audioKey) : null;

    try {
      const blob = await exportMontage({
        canvas,
        audioFile: audioBlob,
        durationSec: duration,
        fps: montageStore.settings.fps,
        renderFrame: (t) => {
          // warm() is async; for export we accept the mirror filling within a frame
          void renderer.warm(t);
          renderer.renderAt(t);
        },
        onProgress: (f) => (progress = f),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${montageStore.title.replace(/\s+/g, '-').toLowerCase()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Video downloaded');
    } catch (err) {
      toast.error('Export failed — try Chrome or Edge');
      console.error(err);
    } finally {
      recording = false;
      playerStore.restart();
    }
  }
</script>

<button
  onclick={onExport}
  disabled={recording}
  class="bg-gold/20 border border-gold/40 text-gold px-4 py-2 text-sm tracking-widest uppercase rounded cursor-pointer hover:bg-gold/30 disabled:opacity-50 disabled:cursor-wait transition-all"
  style="font-family:'Raleway',sans-serif"
>
  {recording ? `Recording… ${Math.round(progress * 100)}%` : 'Download Video'}
</button>
```

- [ ] **Step 3: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/montage/export.ts src/lib/components/Montage/ExportButton.svelte
git commit -m "feat(montage): WebM export via captureStream + MediaRecorder"
```

---

## Task 12: `/montage` route + full manual smoke

**Files:**
- Create: `src/routes/montage/+page.svelte`

- [ ] **Step 1: Write `+page.svelte`**

```svelte
<!-- src/routes/montage/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import LyricsImport from '$lib/components/Editor/LyricsImport.svelte';
  import Controls from '$lib/components/Player/Controls.svelte';
  import PhotoTray from '$lib/components/Montage/PhotoTray.svelte';
  import MontageStage from '$lib/components/Montage/MontageStage.svelte';
  import ExportButton from '$lib/components/Montage/ExportButton.svelte';
  import { montageStore } from '$lib/stores/montage.svelte';
  import { playerStore } from '$lib/stores/player.svelte';

  let stage = $state<ReturnType<typeof MontageStage>>();
  let audioInput: HTMLInputElement;

  onMount(() => {
    montageStore.restore();
  });

  function onAudio(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) montageStore.loadAudio(file);
  }

  function onImportLyrics() {
    // LyricsImport writes to projectStore; for montage we mirror raw text.
    // Simpler: use a local textarea instead. See Step 2 note.
  }
</script>

<div class="min-h-screen bg-surface text-white">
  <header class="flex items-center justify-between px-6 py-4 border-b border-gold/10">
    <h1 class="text-gold text-lg tracking-[0.3em] uppercase" style="font-family:'Raleway',sans-serif">Photo Montage</h1>
    <a href="{import.meta.env.BASE_URL}" class="text-gold/40 hover:text-gold text-xs uppercase tracking-wider">Lyrics-only mode →</a>
  </header>

  <div class="flex flex-col lg:flex-row gap-6 p-6">
    <aside class="w-full lg:w-96 flex-shrink-0 flex flex-col gap-6">
      <PhotoTray />

      <div class="flex flex-col gap-2">
        <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif">Song</span>
        <input bind:this={audioInput} type="file" accept="audio/*" class="hidden" onchange={onAudio} />
        <button
          onclick={() => audioInput.click()}
          class="bg-gold/15 border border-gold/30 text-gold px-4 py-2 text-sm tracking-widest uppercase rounded cursor-pointer hover:bg-gold/30 transition-all"
          style="font-family:'Raleway',sans-serif"
        >
          Add Song
        </button>
      </div>

      <!-- Lyrics: bind directly to the montage store -->
      <div class="flex flex-col gap-2">
        <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif">Lyrics (timestamps)</span>
        <textarea
          value={montageStore.lyricsText}
          oninput={(e) => montageStore.importLyrics((e.target as HTMLTextAreaElement).value)}
          rows="8"
          placeholder={"[00:11.162] Sembah [00:11.392] berlalu..."}
          class="w-full bg-white/5 border border-gold/20 rounded px-3 py-2 text-sm text-white/80 font-mono placeholder:text-white/20 focus:outline-none focus:border-gold/50 resize-y"
        ></textarea>
      </div>
    </aside>

    <main class="flex-1 flex flex-col gap-4">
      <MontageStage bind:this={stage} />
      <Controls />
      {#if stage}
        <ExportButton getCanvas={() => stage?.getCanvas()} />
      {/if}
    </main>
  </div>
</div>
```

> **Note:** the standalone `onImportLyrics` stub and the unused `LyricsImport` import in the draft above are leftovers — delete both; the textarea bound to `montageStore.importLyrics` is the montage lyrics input (the existing `LyricsImport` writes to the *lyrics-only* `projectStore`, which we do not use here).

- [ ] **Step 2: Clean up the stub**

Remove `import LyricsImport ...`, the `onImportLyrics` function, and any reference to them from `+page.svelte`. Keep the textarea wired to `montageStore.importLyrics`.

- [ ] **Step 3: Typecheck + run the full test suite**

Run: `pnpm check && pnpm test`
Expected: typecheck PASS; all vitest tests PASS (existing `suno.test.ts` + new `bands`, `timeline`, `project-store`, `image-cache`).

- [ ] **Step 4: Manual smoke — including refresh-restore**

Run `pnpm dev`, open `http://localhost:5178/lyricvideo/montage` in **Chrome or Edge**:

1. **Add Photos** — select 3–6 images. Thumbnails (numbered) appear; count updates.
2. **Add Song** — select an mp3. (Controls shows its duration.)
3. **Lyrics** — paste a short timestamped block (reuse `extracted-ec0e721d-clean.txt` lines or the parser test samples).
4. **Refresh the page.** Confirm: photos, lyrics text, and song all restore (count + textarea + duration). *(This is the P3 gate.)*
5. **Preview** — press Space / Play in Controls. Photos Ken-Burns under the lyric band; the title card shows for the first ~2.5s; no card/band collision.
6. **Download Video** — click it; button shows `Recording… N%` for ~song length, then a `.webm` downloads. Play it back: photos + audio + bands present.

Expected: all six pass. If export errors in Safari, that is expected (v1 supports Chrome/Edge export).

- [ ] **Step 5: Commit**

```bash
git add src/routes/montage/+page.svelte
git commit -m "feat(montage): /montage route wiring tray + stage + controls + export"
```

---

## Self-Review Notes (already reconciled)

- **Spec coverage:** P1 preview (Tasks 7–10), P2 export (Task 11), P3 persistence (Tasks 4, 5, 9 restore + Task 12 smoke step 4), pure logic (Tasks 2, 3, 6), single style (Task 7), `/montage` route (Task 12), MontageRenderer's own API (Task 7), abstract storage boundary (Task 4 `KvBackend`), explicit `{openingDuration, tailDuration}` (Tasks 1, 3), `LyricBand` future-typed (Task 1), explicit export clock (Task 11), derived-not-persisted cuts (Task 9 — `cuts` is `$derived`, never in `MontageProject`), downscaled-blob storage (Tasks 1, 6, 9), ~50 soft cap (Task 9 `PHOTO_SOFT_CAP`, Task 10 warning).
- **Type consistency:** `MontageRenderer` setter names (`setPhotos/setCuts/setBands/setStyle/setSettings/setTitle/warm/renderAt/getCanvas/resize`) are identical across Tasks 7, 10, 11. `KvBackend`, `MontageProject`, `Photo`, `LyricBand`, `PhotoCut`, `MontageSettings` match their Task 1 definitions everywhere.
- **Known v1 limitation to verify during execution:** the renderer's sync `bitmapMirror` may drop the first frame of a brand-new photo until `warm()` resolves. Acceptable for preview; during export the realtime clock gives each cut multiple frames to fill. If export shows blank leading frames, pre-warm all cuts before `recorder.start()` (loop `await cache.get(p.assetKey)` for every photo) — note this as the first fix if the Task 11 smoke reveals it.
