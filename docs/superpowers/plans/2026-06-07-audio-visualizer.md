# Audio Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/visualizer` route — a sibling to `/montage` — that renders six audio-reactive canvas styles driven by live FFT data, with reused synced lyric bands, title card, text styling, an uploaded background image, video-format presets, and the existing WebM export.

**Architecture:** Bottom-up. Pure modules first (formats, model/duration, shared text overlays, draw-only styles), then the renderer, persistence, the analyser tap on `playerStore`, the export hook, the store, and finally components + route. The renderer composes layers (background → visualizer → title card → lyric band); each visualizer style is a pure draw-only function. Audio analysis taps one shared `<audio>` element in preview (no transport/visual drift) and a separate analyser in the real-time export.

**Tech Stack:** SvelteKit 2 (SPA, `adapter-static`), Svelte 5 runes, TypeScript, Vitest (node env, no Svelte plugin — only pure modules get unit tests; `*.svelte.ts` stores + components are browser-verified), Web Audio `AnalyserNode`, Canvas 2D, `MediaRecorder`.

**Spec:** `docs/superpowers/specs/2026-06-07-audio-visualizer-design.md`

**Conventions that bite (from the montage build):**
- Links MUST use `base` from `$app/paths`, NOT `import.meta.env.BASE_URL` (empty here → resolves relatively).
- `Uint8Array` for Web Audio calls must be typed `Uint8Array<ArrayBuffer>` and constructed `new Uint8Array(new ArrayBuffer(n))` (TS DOM types).
- Browser-verify recipe: `pnpm build` then `pnpm preview --port <free>`; drive via Playwright `browser_evaluate` injecting a synthetic audio `File` + dispatching native `input`/`change`. Screenshots land in the Playwright MCP cwd (`~/.jinn/`), read then delete.
- `pnpm check` must stay 0 errors / 0 warnings; `pnpm test` green.

---

## File structure

**New**
- `src/lib/visualizer/formats.ts` — video-format presets + custom-dim coercion (pure).
- `src/lib/visualizer/model.ts` — `VisualizerProject`, `VizStyleId`, title-card theme, `computeTotalDuration` (pure).
- `src/lib/visualizer/viz-styles.ts` — six draw-only style functions (promoted from the mockup).
- `src/lib/renderer/text-overlays.ts` — shared `drawLyricBand`, `drawTitleCard`, `wrapText` (extracted).
- `src/lib/renderer/visualizer-renderer.ts` — layered `renderAt(t)`.
- `src/lib/stores/visualizer.svelte.ts` — `visualizerStore`.
- `src/lib/components/Visualizer/VizStylePicker.svelte`
- `src/lib/components/Visualizer/FormatPicker.svelte`
- `src/lib/components/Visualizer/VisualizerStage.svelte`
- `src/lib/components/Visualizer/ExportButton.svelte`
- `src/routes/visualizer/+page.svelte`
- Tests: `src/lib/visualizer/formats.test.ts`, `src/lib/visualizer/model.test.ts`, `src/lib/visualizer/viz-styles.test.ts`, `src/lib/renderer/text-overlays.test.ts`, `src/lib/storage/visualizer-store.test.ts`.

**Modified**
- `src/lib/renderer/montage-renderer.ts` — delegate band/title/wrap to `text-overlays.ts`.
- `src/lib/storage/project-store.ts` — add visualizer save/load/clear.
- `src/lib/stores/player.svelte.ts` — `attachAnalyser()` + per-element source caching.
- `src/lib/montage/export.ts` — optional `onAnalyserReady` hook.
- `src/routes/montage/+page.svelte`, `src/routes/+page.svelte` — nav cross-links.

---

## Task 1: Video-format presets (`formats.ts`)

**Files:**
- Create: `src/lib/visualizer/formats.ts`
- Test: `src/lib/visualizer/formats.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/visualizer/formats.test.ts
import { describe, it, expect } from 'vitest';
import { FORMATS, FORMAT_MAP, DEFAULT_FORMAT, coerceCustomDims, resolveFormat } from './formats';

describe('format presets', () => {
  it('has the four platform presets with even dims', () => {
    expect(FORMATS.map((f) => f.id)).toEqual(['youtube', 'tiktok', 'ig-feed', 'ig-story']);
    for (const f of FORMATS) {
      expect(f.width % 2).toBe(0);
      expect(f.height % 2).toBe(0);
    }
  });

  it('DEFAULT_FORMAT resolves to 1920x1080', () => {
    expect(resolveFormat({ formatId: DEFAULT_FORMAT })).toEqual({ width: 1920, height: 1080 });
  });

  it('resolveFormat returns preset dims', () => {
    expect(resolveFormat({ formatId: 'tiktok' })).toEqual({ width: 1080, height: 1920 });
    expect(resolveFormat({ formatId: 'ig-feed' })).toEqual({ width: 1080, height: 1080 });
  });

  it('unknown formatId falls back to the default preset', () => {
    expect(resolveFormat({ formatId: 'nope' })).toEqual({ width: 1920, height: 1080 });
  });

  it('custom format coerces the custom dims', () => {
    expect(resolveFormat({ formatId: 'custom', customWidth: 1281, customHeight: 721 })).toEqual({
      width: 1280,
      height: 720,
    });
  });
});

describe('coerceCustomDims', () => {
  it('rounds odd dims down to even', () => {
    expect(coerceCustomDims(1281, 721)).toEqual({ width: 1280, height: 720 });
  });
  it('clamps to [256, 3840]', () => {
    expect(coerceCustomDims(10, 99999)).toEqual({ width: 256, height: 3840 });
  });
  it('falls back to 1920x1080 on NaN/zero/negative', () => {
    expect(coerceCustomDims(NaN, 0)).toEqual({ width: 1920, height: 1080 });
    expect(coerceCustomDims(-5, Infinity)).toEqual({ width: 1920, height: 1080 });
  });
  it('uses FORMAT_MAP for lookups', () => {
    expect(FORMAT_MAP.youtube.width).toBe(1920);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- formats`
Expected: FAIL — cannot find module `./formats`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/visualizer/formats.ts
export interface VideoFormat {
  id: string;
  label: string;
  group: string;
  width: number;
  height: number;
}

export const FORMATS: VideoFormat[] = [
  { id: 'youtube', label: 'YouTube (16:9)', group: 'YouTube', width: 1920, height: 1080 },
  { id: 'tiktok', label: 'TikTok / Reels (9:16)', group: 'TikTok', width: 1080, height: 1920 },
  { id: 'ig-feed', label: 'Instagram Square (1:1)', group: 'Instagram', width: 1080, height: 1080 },
  { id: 'ig-story', label: 'Instagram Story (9:16)', group: 'Instagram', width: 1080, height: 1920 },
];

export const FORMAT_MAP: Record<string, VideoFormat> = Object.fromEntries(
  FORMATS.map((f) => [f.id, f])
);

export const DEFAULT_FORMAT = 'youtube';

const MIN_DIM = 256;
const MAX_DIM = 3840;

/** Clamp custom dims to [256,3840], round DOWN to even (encoder-friendly).
 *  Bad input (NaN / <=0 / Infinity) falls back to 1920x1080. */
export function coerceCustomDims(w: number, h: number): { width: number; height: number } {
  const clamp = (n: number, fallback: number) => {
    if (!Number.isFinite(n) || n <= 0) return fallback;
    const c = Math.min(MAX_DIM, Math.max(MIN_DIM, Math.round(n)));
    return c % 2 === 0 ? c : c - 1;
  };
  return { width: clamp(w, 1920), height: clamp(h, 1080) };
}

export function resolveFormat(opts: {
  formatId: string;
  customWidth?: number;
  customHeight?: number;
}): { width: number; height: number } {
  if (opts.formatId === 'custom') {
    return coerceCustomDims(opts.customWidth ?? 1920, opts.customHeight ?? 1080);
  }
  const f = FORMAT_MAP[opts.formatId] ?? FORMAT_MAP[DEFAULT_FORMAT];
  return { width: f.width, height: f.height };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- formats`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/visualizer/formats.ts src/lib/visualizer/formats.test.ts
git commit -m "feat(visualizer): video-format presets + custom-dim coercion"
```

---

## Task 2: Visualizer model + duration contract (`model.ts`)

**Files:**
- Create: `src/lib/visualizer/model.ts`
- Test: `src/lib/visualizer/model.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/visualizer/model.test.ts
import { describe, it, expect } from 'vitest';
import { computeTotalDuration, DEFAULT_VIZ_STYLE, VIZ_TITLE_THEME } from './model';
import type { LyricBand, MontageSettings } from '$lib/montage/model';

const settings: MontageSettings = { openingDuration: 2.5, tailDuration: 1.5, fps: 30 };
const bands = (end: number): LyricBand[] => [{ id: 'a', start: 0, end, primary: 'hi' }];

describe('computeTotalDuration', () => {
  it('uses the song duration when it is the longest', () => {
    expect(computeTotalDuration(30, bands(10), settings)).toBe(30);
  });
  it('falls back to lastBandEnd + tail when audio metadata is missing/shorter', () => {
    expect(computeTotalDuration(0, bands(10), settings)).toBe(11.5);
    expect(computeTotalDuration(5, bands(10), settings)).toBe(11.5);
  });
  it('guards Infinity/NaN song duration', () => {
    expect(computeTotalDuration(Infinity, bands(10), settings)).toBe(11.5);
    expect(computeTotalDuration(NaN, bands(10), settings)).toBe(11.5);
  });
  it('never returns less than the opening duration', () => {
    expect(computeTotalDuration(0, [], settings)).toBe(2.5);
  });
});

describe('constants', () => {
  it('defaults the style and exposes a title-card theme', () => {
    expect(DEFAULT_VIZ_STYLE).toBe('bars');
    expect(typeof VIZ_TITLE_THEME.background).toBe('string');
    expect(typeof VIZ_TITLE_THEME.accent).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- visualizer/model`
Expected: FAIL — cannot find module `./model`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/visualizer/model.ts
import type { TextStyle, MontageSettings, LyricBand } from '$lib/montage/model';

export type VizStyleId = 'bars' | 'mirror' | 'radial' | 'wave' | 'area' | 'orb';
export const DEFAULT_VIZ_STYLE: VizStyleId = 'bars';

/** Colors the shared title-card overlay needs (a subset of MontageStyle). */
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
  const lastBandEnd = bands.length ? bands[bands.length - 1].end : 0;
  return Math.max(finite, lastBandEnd + settings.tailDuration, settings.openingDuration);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- visualizer/model`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/visualizer/model.ts src/lib/visualizer/model.test.ts
git commit -m "feat(visualizer): project model + totalDuration contract"
```

---

## Task 3: Extract shared text overlays + refactor MontageRenderer

**Files:**
- Create: `src/lib/renderer/text-overlays.ts`
- Test: `src/lib/renderer/text-overlays.test.ts`
- Modify: `src/lib/renderer/montage-renderer.ts`

- [ ] **Step 1: Write the failing test** (covers the only pure-testable piece, `wrapText`, plus smoke for the draw fns via a stub ctx)

```ts
// src/lib/renderer/text-overlays.test.ts
import { describe, it, expect } from 'vitest';
import { wrapText, drawLyricBand, drawTitleCard } from './text-overlays';
import { DEFAULT_TITLE_STYLE, DEFAULT_BAND_STYLE } from '$lib/montage/model';

// A Proxy ctx: every method is a recording no-op; measureText returns width by
// length; gradient factories return an object with addColorStop.
function stubCtx() {
  const calls: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === '__calls') return calls;
        if (prop === 'measureText') return (s: string) => ({ width: String(s).length * 6 });
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
          return () => ({ addColorStop() {} });
        return (...a: unknown[]) => {
          void a;
          calls.push(prop);
        };
      },
      set() {
        return true;
      },
    }
  ) as unknown as CanvasRenderingContext2D;
  return ctx;
}

describe('wrapText', () => {
  it('keeps a short line on one row', () => {
    expect(wrapText(stubCtx(), 'hello world', 1000)).toEqual(['hello world']);
  });
  it('wraps when the row exceeds maxWidth', () => {
    // each char = 6px; maxWidth 60 -> ~10 chars per line
    const lines = wrapText(stubCtx(), 'aaaaa bbbbb ccccc', 60);
    expect(lines.length).toBeGreaterThan(1);
  });
});

describe('overlay draws (smoke)', () => {
  it('drawLyricBand issues fill + stroke calls without throwing', () => {
    const ctx = stubCtx();
    drawLyricBand(ctx, { id: 'a', start: 0, end: 2, primary: 'a lyric line' }, 1920, 1080, DEFAULT_BAND_STYLE);
    expect((ctx as unknown as { __calls: string[] }).__calls).toContain('fillText');
    expect((ctx as unknown as { __calls: string[] }).__calls).toContain('strokeText');
  });
  it('drawTitleCard issues fill + stroke calls without throwing', () => {
    const ctx = stubCtx();
    drawTitleCard(ctx, 'My Title', 1920, 1080, DEFAULT_TITLE_STYLE, {
      background: '#000',
      accent: '#d4af37',
    });
    expect((ctx as unknown as { __calls: string[] }).__calls).toContain('fillText');
    expect((ctx as unknown as { __calls: string[] }).__calls).toContain('stroke');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- text-overlays`
Expected: FAIL — cannot find module `./text-overlays`.

- [ ] **Step 3: Create `text-overlays.ts`** (move the three functions verbatim from `montage-renderer.ts`; `drawBand`→`drawLyricBand`, and `drawTitleCard` takes a `colors` object instead of a `MontageStyle`)

```ts
// src/lib/renderer/text-overlays.ts
import type { LyricBand, TextStyle } from '$lib/montage/model';
import { getFontFamily } from '$lib/montage/fonts';

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
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

export function drawLyricBand(
  ctx: CanvasRenderingContext2D,
  band: LyricBand,
  W: number,
  H: number,
  bandStyle: TextStyle
): void {
  const fontPx = Math.round(H * bandStyle.sizePct);
  ctx.font = `${bandStyle.fontWeight} ${fontPx}px ${getFontFamily(bandStyle.fontFamilyId).stack}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = wrapText(ctx, band.primary, W * 0.82);
  const lineH = fontPx * 1.25;
  const bottomY = H * 0.86;
  const blockH = lines.length * lineH;

  // No scrim bar — legibility from a soft drop shadow plus a thin dark glyph
  // outline, so the text reads over bright/busy areas (e.g. sky).
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineWidth = fontPx * 0.07;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.fillStyle = bandStyle.color;
  lines.forEach((ln, i) => {
    const y = bottomY - blockH + i * lineH + lineH / 2;
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = fontPx * 0.5;
    ctx.shadowOffsetY = fontPx * 0.04;
    ctx.strokeText(ln, W / 2, y);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillText(ln, W / 2, y);
  });
  ctx.restore();
}

export function drawTitleCard(
  ctx: CanvasRenderingContext2D,
  title: string,
  W: number,
  H: number,
  titleStyle: TextStyle,
  colors: { background: string; accent: string }
): void {
  ctx.save();
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, W, H);
  const fontPx = Math.round(H * titleStyle.sizePct);
  ctx.font = `${titleStyle.fontWeight} ${fontPx}px ${getFontFamily(titleStyle.fontFamilyId).stack}`;
  ctx.fillStyle = titleStyle.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, W / 2, H / 2 - fontPx * 0.3);
  // gold divider
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = Math.max(1, H * 0.003);
  ctx.beginPath();
  ctx.moveTo(W / 2 - W * 0.08, H / 2 + fontPx * 0.5);
  ctx.lineTo(W / 2 + W * 0.08, H / 2 + fontPx * 0.5);
  ctx.stroke();
  ctx.restore();
}
```

- [ ] **Step 4: Refactor `montage-renderer.ts` to delegate** (no visual change)

In `src/lib/renderer/montage-renderer.ts`:

1. Add import after the existing `getFontFamily` import (line ~11):

```ts
import { drawLyricBand, drawTitleCard } from './text-overlays';
```

2. In `renderAt`, replace the two call sites:
   - `if (band) this.drawBand(band, W, H);` → `if (band) drawLyricBand(ctx, band, W, H, this.bandStyle);`
   - `this.drawTitleCard(this.title, W, H);` → `drawTitleCard(ctx, this.title, W, H, this.titleStyle, this.style);`
     (`this.style` is a `MontageStyle` — structurally provides `background` + `accent`.)
   - Note `ctx` is already destructured at the top of `renderAt` (`const { ctx, canvas, style } = this;`).

3. Delete the now-unused private methods `drawBand(...)` and `drawTitleCard(...)` and the module-level `wrapText(...)` function at the bottom of the file. Keep `drawBlurFill`, `drawPhoto`, `cacheSync`.

4. Remove the now-unused `getFontFamily` import **only if** nothing else in the file uses it (it won't be after the deletions). Verify with a grep; if unused, drop it.

- [ ] **Step 5: Run unit tests + typecheck**

Run: `pnpm test -- text-overlays && pnpm check`
Expected: tests PASS; `pnpm check` 0 errors / 0 warnings.

- [ ] **Step 6: Montage regression smoke (browser-verify)**

Build + preview, then via Playwright load the montage page, inject a synthetic bright photo + a short timestamped lyric + a title, seek to t=1 (title card) and to a band time, screenshot each. Confirm the title card (centered text + gold divider) and the shadowed/outlined lyric band render exactly as before this task.

```bash
pnpm build && pnpm preview --port 4178 &
# open http://localhost:4178/lyricvideo/montage in Playwright; inject photo+lyrics+title;
# screenshot title-card frame and a band frame; compare against pre-refactor look.
```

Expected: montage output visually identical. Read screenshots from `~/.jinn/`, then delete them.

- [ ] **Step 7: Commit**

```bash
git add src/lib/renderer/text-overlays.ts src/lib/renderer/text-overlays.test.ts src/lib/renderer/montage-renderer.ts
git commit -m "refactor(renderer): extract shared text-overlays; montage delegates (no visual change)"
```

---

## Task 4: Promote visualizer styles to draw-only (`viz-styles.ts`)

**Files:**
- Create: `src/lib/visualizer/viz-styles.ts`
- Test: `src/lib/visualizer/viz-styles.test.ts`

The production module is the mockup `src/lib/dev/visualizer/viz-styles.ts` minus the per-style background clear and title draw (the renderer owns those layers), with the `VizFrame` interface changed (`title` removed, `accent` added).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/visualizer/viz-styles.test.ts
import { describe, it, expect } from 'vitest';
import { VIZ_STYLES, VIZ_STYLE_MAP, type VizFrame } from './viz-styles';

function stubCtx() {
  const calls: string[] = [];
  return new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === '__calls') return calls;
        if (prop === 'measureText') return (s: string) => ({ width: String(s).length * 6 });
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
          return () => ({ addColorStop() {} });
        return (...a: unknown[]) => {
          void a;
          calls.push(prop);
        };
      },
      set() {
        return true;
      },
    }
  ) as unknown as CanvasRenderingContext2D;
}

function frame(w: number, h: number, fill: number): VizFrame {
  const freq = new Uint8Array(1024).fill(fill);
  const wave = new Uint8Array(2048).fill(fill);
  return { ctx: stubCtx(), w, h, freq, wave, t: 1.23, accent: '#d4af37' };
}

describe('viz styles', () => {
  it('exposes all six styles', () => {
    expect(VIZ_STYLES.map((s) => s.id)).toEqual(['bars', 'mirror', 'radial', 'wave', 'area', 'orb']);
    expect(Object.keys(VIZ_STYLE_MAP).sort()).toEqual(
      ['area', 'bars', 'mirror', 'orb', 'radial', 'wave']
    );
  });

  it('every style draws across aspect ratios and freq levels without throwing', () => {
    const dims: [number, number][] = [
      [1920, 1080],
      [1080, 1920],
      [1080, 1080],
    ];
    for (const style of VIZ_STYLES) {
      for (const [w, h] of dims) {
        for (const fill of [0, 200]) {
          const f = frame(w, h, fill);
          expect(() => style.draw(f)).not.toThrow();
          expect((f.ctx as unknown as { __calls: string[] }).__calls.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('bars issues fillRect (renders bars, does not no-op)', () => {
    const f = frame(1920, 1080, 200);
    VIZ_STYLE_MAP.bars.draw(f);
    expect((f.ctx as unknown as { __calls: string[] }).__calls).toContain('fillRect');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- viz-styles`
Expected: FAIL — cannot find module `./viz-styles` (the one under `visualizer/`).

- [ ] **Step 3: Create the production module**

Copy `src/lib/dev/visualizer/viz-styles.ts` to `src/lib/visualizer/viz-styles.ts`, then apply these edits:

1. Replace the `VizFrame` interface with (drop `title`, add `accent`):

```ts
export interface VizFrame {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  freq: Uint8Array; // 0..255 per bin
  wave: Uint8Array; // 0..255, silence = 128
  t: number; // seconds since start (rotations / drift)
  accent: string; // active accent color (reserved; styles use the gold palette in v1)
}
```

2. Delete the `clearBg(...)` helper function and the `drawTitle(...)` helper function entirely.

3. In **each** of the six style `draw` bodies remove the two lines that reference them:
   - the leading `clearBg(f);`
   - the trailing `drawTitle(f, ...);`

   So each draw now starts with `const { ctx, w, h } = f;` (or `..., t`) and ends after its visualizer graphics, drawing nothing else.

4. Keep `buckets`, `bass`, the `GOLD` constant, `VIZ_STYLES`, and `VIZ_STYLE_MAP` exactly as they are. (`SURFACE` becomes unused after removing `clearBg` — if `pnpm check` flags it, delete the `SURFACE` constant.)

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm test -- viz-styles && pnpm check`
Expected: tests PASS; check 0/0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/visualizer/viz-styles.ts src/lib/visualizer/viz-styles.test.ts
git commit -m "feat(visualizer): draw-only visualizer styles (promoted from mockup)"
```

---

## Task 5: VisualizerRenderer

**Files:**
- Create: `src/lib/renderer/visualizer-renderer.ts`

No unit test (canvas/`ImageBitmap`/`AnalyserNode` aren't available in node — same as `MontageRenderer`, which has none). Verified by `pnpm check` here and full browser-verify in Task 13.

- [ ] **Step 1: Write the implementation**

```ts
// src/lib/renderer/visualizer-renderer.ts
import type { LyricBand, TextStyle, MontageSettings } from '$lib/montage/model';
import { DEFAULT_TITLE_STYLE, DEFAULT_BAND_STYLE } from '$lib/montage/model';
import { VIZ_STYLE_MAP } from '$lib/visualizer/viz-styles';
import { VIZ_TITLE_THEME, type VizStyleId } from '$lib/visualizer/model';
import { drawLyricBand, drawTitleCard } from './text-overlays';

const SURFACE = '#0a1a0a';
const ACCENT = '#d4af37';

export class VisualizerRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private analyser: AnalyserNode | null = null;
  // Seeded with zeroed buffers so renderAt before setAnalyser draws a quiet
  // frame instead of dividing by an empty array inside the style helpers.
  private freq: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(1024));
  private wave: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(2048));

  private styleId: VizStyleId = 'bars';
  private bands: LyricBand[] = [];
  private title = '';
  private titleStyle: TextStyle = DEFAULT_TITLE_STYLE;
  private bandStyle: TextStyle = DEFAULT_BAND_STYLE;
  private settings: MontageSettings | null = null;
  private bg: ImageBitmap | null = null;
  private bgDim = 0.45; // overlay alpha over a bg image so text/viz stay legible

  constructor({ canvas }: { canvas: HTMLCanvasElement }) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
  }

  setAnalyser(a: AnalyserNode) {
    this.analyser = a;
    this.freq = new Uint8Array(new ArrayBuffer(a.frequencyBinCount));
    this.wave = new Uint8Array(new ArrayBuffer(a.fftSize));
  }
  setStyle(id: VizStyleId) {
    this.styleId = id;
  }
  setBands(bands: LyricBand[]) {
    this.bands = bands;
  }
  setTitle(title: string) {
    this.title = title;
  }
  setTextStyles(title: TextStyle, band: TextStyle) {
    this.titleStyle = title;
    this.bandStyle = band;
  }
  setSettings(s: MontageSettings) {
    this.settings = s;
  }
  setBackground(bmp: ImageBitmap | null) {
    this.bg = bmp;
  }
  getCanvas() {
    return this.canvas;
  }
  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  renderAt(t: number) {
    if (!this.settings) {
      console.error('VisualizerRenderer.renderAt called before setSettings');
      return;
    }
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;

    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.freq);
      this.analyser.getByteTimeDomainData(this.wave);
    }

    this.drawBackground(W, H);

    const style = VIZ_STYLE_MAP[this.styleId] ?? VIZ_STYLE_MAP.bars;
    style.draw({ ctx, w: W, h: H, freq: this.freq, wave: this.wave, t, accent: ACCENT });

    if (t < this.settings.openingDuration && this.title) {
      drawTitleCard(ctx, this.title, W, H, this.titleStyle, VIZ_TITLE_THEME);
    }

    const band = this.bands.find((b) => t >= b.start && t < b.end) ?? null;
    if (band) drawLyricBand(ctx, band, W, H, this.bandStyle);
  }

  private drawBackground(W: number, H: number) {
    const { ctx, bg } = this;
    if (bg) {
      // cover-fit
      const scale = Math.max(W / bg.width, H / bg.height);
      const w = bg.width * scale;
      const h = bg.height * scale;
      ctx.drawImage(bg, (W - w) / 2, (H - h) / 2, w, h);
      // dim so a bright cover doesn't drown the visualizer/text
      ctx.fillStyle = `rgba(10,26,10,${this.bgDim})`;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = SURFACE;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: 0 errors / 0 warnings.

- [ ] **Step 3: Commit**

```bash
git add src/lib/renderer/visualizer-renderer.ts
git commit -m "feat(renderer): VisualizerRenderer (bg + style + title + lyric layers)"
```

---

## Task 6: Visualizer persistence (`project-store.ts`)

**Files:**
- Modify: `src/lib/storage/project-store.ts`
- Test: `src/lib/storage/visualizer-store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/storage/visualizer-store.test.ts
import { describe, it, expect } from 'vitest';
import {
  saveVisualizerProject,
  loadVisualizerProject,
  clearVisualizerProject,
  type KvBackend,
} from './project-store';
import type { VisualizerProject } from '$lib/visualizer/model';
import { DEFAULT_SETTINGS } from '$lib/montage/model';

function memBackend(): KvBackend {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

const sample: VisualizerProject = {
  version: 1,
  lyricsText: '[00:01.00] hi',
  videoTitle: 'Song',
  vizStyleId: 'radial',
  formatId: 'tiktok',
  songDuration: 42,
  settings: { ...DEFAULT_SETTINGS },
  updatedAt: 123,
};

describe('visualizer persistence', () => {
  it('round-trips a project', () => {
    const b = memBackend();
    saveVisualizerProject(sample, b);
    expect(loadVisualizerProject(b)).toEqual(sample);
  });
  it('returns null for an empty backend', () => {
    expect(loadVisualizerProject(memBackend())).toBeNull();
  });
  it('rejects a shape-invalid blob', () => {
    const b = memBackend();
    b.setItem('visualizer:lastProject', JSON.stringify({ version: 1, lyricsText: 1 }));
    expect(loadVisualizerProject(b)).toBeNull();
  });
  it('uses a key distinct from montage (no collision)', () => {
    const b = memBackend();
    saveVisualizerProject(sample, b);
    expect(b.getItem('montage:lastProject')).toBeNull();
    clearVisualizerProject(b);
    expect(loadVisualizerProject(b)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- visualizer-store`
Expected: FAIL — `saveVisualizerProject` is not exported.

- [ ] **Step 3: Add the visualizer functions to `project-store.ts`**

Add the import at the top of `src/lib/storage/project-store.ts` with the existing imports:

```ts
import type { VisualizerProject } from '$lib/visualizer/model';
```

Then add these (after the existing montage functions, before `localStorageBackend`):

```ts
const VIZ_KEY = 'visualizer:lastProject';

function isVisualizerProject(value: unknown): value is VisualizerProject {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    typeof v.lyricsText === 'string' &&
    typeof v.vizStyleId === 'string' &&
    typeof v.formatId === 'string' &&
    typeof v.songDuration === 'number' &&
    v.settings != null &&
    typeof v.updatedAt === 'number'
  );
}

export function saveVisualizerProject(project: VisualizerProject, backend: KvBackend): void {
  backend.setItem(VIZ_KEY, JSON.stringify(project));
}

export function loadVisualizerProject(backend: KvBackend): VisualizerProject | null {
  const raw = backend.getItem(VIZ_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isVisualizerProject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearVisualizerProject(backend: KvBackend): void {
  backend.removeItem(VIZ_KEY);
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm test -- visualizer-store && pnpm check`
Expected: PASS; check 0/0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/project-store.ts src/lib/storage/visualizer-store.test.ts
git commit -m "feat(storage): visualizer project persistence (separate key)"
```

---

## Task 7: `playerStore.attachAnalyser()` + per-element source caching

**Files:**
- Modify: `src/lib/stores/player.svelte.ts`

Browser-verified (AudioContext unavailable in node). Verified by `pnpm check` here, exercised in Task 13.

- [ ] **Step 1: Add the analyser fields** — after the existing private fields (`private lastTimestamp...`):

```ts
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private srcNode: MediaElementAudioSourceNode | null = null;
  private srcEl: HTMLAudioElement | null = null; // element srcNode belongs to
  private analyserWanted = false;
```

- [ ] **Step 2: Add `attachAnalyser()` + `connectSource()`** — add these methods (e.g. after `loadAudio`):

```ts
  /** Opt-in: build (once) and return the analyser tapping the current audio.
   *  Safe to call before any song is loaded — the source is connected later,
   *  on the first loadAudio. The returned AnalyserNode instance is stable. */
  attachAnalyser(): AnalyserNode {
    this.analyserWanted = true;
    if (!this.audioCtx) this.audioCtx = new AudioContext();
    if (!this.analyser) {
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      this.analyser.connect(this.audioCtx.destination);
    }
    this.connectSource();
    return this.analyser;
  }

  // Connect the CURRENT audio element to the analyser. A given <audio> may be
  // wrapped by createMediaElementSource only once in its lifetime, so the source
  // node is cached per element and rebuilt ONLY when the element itself changes.
  private connectSource() {
    if (!this.analyserWanted || !this.audioCtx || !this.analyser) return;
    if (!this.audioEl) return; // no element yet — connect on the next loadAudio
    if (this.srcEl === this.audioEl && this.srcNode) return; // already connected
    if (this.srcNode) {
      try {
        this.srcNode.disconnect();
      } catch {
        // old node already detached — ignore
      }
    }
    this.srcNode = this.audioCtx.createMediaElementSource(this.audioEl);
    this.srcNode.connect(this.analyser);
    this.srcEl = this.audioEl;
  }
```

- [ ] **Step 3: Reconnect on element swap + resume on play**

In `loadAudio`, at the very end (after `this.isPlaying = false;`), add:

```ts
    // If an analyser was attached, rebuild the source against the new element.
    this.connectSource();
```

In `play()`, before `this.audioEl?.play();`, add:

```ts
    if (this.audioCtx?.state === 'suspended') void this.audioCtx.resume();
```

In `destroy()`, before the closing brace, add:

```ts
    void this.audioCtx?.close();
```

- [ ] **Step 4: Typecheck**

Run: `pnpm check`
Expected: 0 errors / 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/player.svelte.ts
git commit -m "feat(player): opt-in attachAnalyser with per-element source caching"
```

---

## Task 8: Export analyser hook (`export.ts`)

**Files:**
- Modify: `src/lib/montage/export.ts`

Browser-verified via the export path in Task 13. Additive — montage passes nothing.

- [ ] **Step 1: Add the option to the interface** — in `ExportOptions`, add after `onProgress?`:

```ts
  /** When present, an AnalyserNode is tapped off the export audio source and
   *  handed back before recording starts, so renderFrame can read live FFT. */
  onAnalyserReady?: (analyser: AnalyserNode) => void;
```

- [ ] **Step 2: Destructure it** — in `exportMontage`, add `onAnalyserReady` to the destructured `opts`:

```ts
  const { canvas, audioFile, durationSec, fps, renderFrame, onProgress, onAnalyserReady } = opts;
```

- [ ] **Step 3: Tap the analyser** — inside `if (audioFile) { ... }`, after `source.connect(audioCtx.destination);` and before `tracks.push(...dest.stream.getAudioTracks());`:

```ts
    if (onAnalyserReady) {
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      onAnalyserReady(analyser);
    }
```

- [ ] **Step 4: Typecheck**

Run: `pnpm check`
Expected: 0 errors / 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add src/lib/montage/export.ts
git commit -m "feat(export): optional onAnalyserReady hook (montage unaffected)"
```

---

## Task 9: visualizerStore

**Files:**
- Create: `src/lib/stores/visualizer.svelte.ts`

Browser-verified. The pure duration math lives in `computeTotalDuration` (already tested). Verified by `pnpm check` here.

- [ ] **Step 1: Write the implementation**

```ts
// src/lib/stores/visualizer.svelte.ts
import { nanoid } from 'nanoid';
import type { TextStyle } from '$lib/montage/model';
import { DEFAULT_SETTINGS, DEFAULT_TITLE_STYLE, DEFAULT_BAND_STYLE } from '$lib/montage/model';
import { coerceTextStyle } from '$lib/montage/fonts';
import { deriveBands } from '$lib/montage/bands';
import { parseSunoTimestamps } from '$lib/parser/suno';
import { putAsset, getAsset, deleteAsset } from '$lib/storage/asset-store';
import {
  saveVisualizerProject,
  loadVisualizerProject,
  localStorageBackend,
} from '$lib/storage/project-store';
import {
  computeTotalDuration,
  DEFAULT_VIZ_STYLE,
  type VisualizerProject,
  type VizStyleId,
} from '$lib/visualizer/model';
import { DEFAULT_FORMAT, resolveFormat } from '$lib/visualizer/formats';
import { playerStore } from './player.svelte';

class VisualizerStore {
  lyricsText = $state('');
  videoTitle = $state('');
  titleStyle = $state<TextStyle>({ ...DEFAULT_TITLE_STYLE });
  bandStyle = $state<TextStyle>({ ...DEFAULT_BAND_STYLE });
  vizStyleId = $state<VizStyleId>(DEFAULT_VIZ_STYLE);
  formatId = $state<string>(DEFAULT_FORMAT);
  customWidth = $state<number | undefined>(undefined);
  customHeight = $state<number | undefined>(undefined);
  backgroundKey = $state<string | undefined>(undefined);
  audioKey = $state<string | undefined>(undefined);
  songDuration = $state(0);
  settings = $state({ ...DEFAULT_SETTINGS });
  ready = $state(false);
  exporting = $state(false);

  private song = $derived(this.lyricsText ? parseSunoTimestamps(this.lyricsText) : null);
  readonly bands = $derived(deriveBands(this.song));
  readonly title = $derived(this.videoTitle.trim() || 'Visualizer');
  readonly dims = $derived(
    resolveFormat({
      formatId: this.formatId,
      customWidth: this.customWidth,
      customHeight: this.customHeight,
    })
  );
  readonly totalDuration = $derived(
    computeTotalDuration(this.songDuration || (this.song?.duration ?? 0), this.bands, this.settings)
  );

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
    this.persist();
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.addEventListener(
      'loadedmetadata',
      () => {
        URL.revokeObjectURL(url);
        if (Number.isFinite(probe.duration) && probe.duration > 0) {
          this.songDuration = probe.duration;
          this.persist();
        }
      },
      { once: true }
    );
    probe.addEventListener('error', () => URL.revokeObjectURL(url), { once: true });
    probe.src = url;
  }

  async setBackground(file: File) {
    if (this.backgroundKey) await deleteAsset(this.backgroundKey);
    const key = `vizbg:${nanoid()}`;
    await putAsset(key, file);
    this.backgroundKey = key;
    this.persist();
  }

  async removeBackground() {
    if (this.backgroundKey) await deleteAsset(this.backgroundKey);
    this.backgroundKey = undefined;
    this.persist();
  }

  setVizStyle(id: VizStyleId) {
    this.vizStyleId = id;
    this.persist();
  }

  setFormat(id: string) {
    this.formatId = id;
    this.persist();
  }

  setCustomDims(width: number, height: number) {
    this.customWidth = width;
    this.customHeight = height;
    this.persist();
  }

  setTitle(text: string) {
    this.videoTitle = text;
    this.persist();
  }

  setTitleStyle(patch: Partial<TextStyle>) {
    this.titleStyle = coerceTextStyle({ ...this.titleStyle, ...patch });
    this.persist();
  }

  setBandStyle(patch: Partial<TextStyle>) {
    this.bandStyle = coerceTextStyle({ ...this.bandStyle, ...patch });
    this.persist();
  }

  private persist() {
    const project: VisualizerProject = {
      version: 1,
      lyricsText: this.lyricsText,
      videoTitle: this.videoTitle,
      titleStyle: this.titleStyle,
      bandStyle: this.bandStyle,
      vizStyleId: this.vizStyleId,
      formatId: this.formatId,
      customWidth: this.customWidth,
      customHeight: this.customHeight,
      backgroundKey: this.backgroundKey,
      audioKey: this.audioKey,
      songDuration: this.songDuration,
      settings: this.settings,
      updatedAt: Date.now(),
    };
    saveVisualizerProject(project, localStorageBackend);
  }

  async restore() {
    const project = loadVisualizerProject(localStorageBackend);
    if (project) {
      this.lyricsText = project.lyricsText;
      this.videoTitle = project.videoTitle ?? '';
      this.titleStyle = coerceTextStyle({ ...DEFAULT_TITLE_STYLE, ...project.titleStyle });
      this.bandStyle = coerceTextStyle({ ...DEFAULT_BAND_STYLE, ...project.bandStyle });
      this.vizStyleId = project.vizStyleId;
      this.formatId = project.formatId;
      this.customWidth = project.customWidth;
      this.customHeight = project.customHeight;
      this.backgroundKey = project.backgroundKey;
      this.audioKey = project.audioKey;
      this.songDuration = project.songDuration ?? 0;
      this.settings = project.settings;

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

export const visualizerStore = new VisualizerStore();
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: 0 errors / 0 warnings.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/visualizer.svelte.ts
git commit -m "feat(visualizer): visualizerStore (state, persistence, duration)"
```

---

## Task 10: Style picker + format picker components

**Files:**
- Create: `src/lib/components/Visualizer/VizStylePicker.svelte`
- Create: `src/lib/components/Visualizer/FormatPicker.svelte`

Browser-verified in Task 13; `pnpm check` here.

- [ ] **Step 1: VizStylePicker**

```svelte
<!-- src/lib/components/Visualizer/VizStylePicker.svelte -->
<script lang="ts">
  import { visualizerStore } from '$lib/stores/visualizer.svelte';
  import { VIZ_STYLES } from '$lib/visualizer/viz-styles';
</script>

<div class="flex flex-col gap-2">
  <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif"
    >Visualizer Style</span
  >
  <div class="grid grid-cols-2 gap-2">
    {#each VIZ_STYLES as style}
      <button
        onclick={() => visualizerStore.setVizStyle(style.id)}
        class="px-3 py-2 text-xs uppercase tracking-wider rounded border transition-all text-left {style.id ===
        visualizerStore.vizStyleId
          ? 'border-gold/50 text-gold bg-gold/10'
          : 'border-gold/15 text-white/50 hover:text-gold hover:border-gold/30'}"
        style="font-family:'Raleway',sans-serif">{style.name}</button
      >
    {/each}
  </div>
</div>
```

- [ ] **Step 2: FormatPicker**

```svelte
<!-- src/lib/components/Visualizer/FormatPicker.svelte -->
<script lang="ts">
  import { visualizerStore } from '$lib/stores/visualizer.svelte';
  import { FORMATS } from '$lib/visualizer/formats';

  function onCustomW(e: Event) {
    const w = Number((e.target as HTMLInputElement).value);
    visualizerStore.setCustomDims(w, visualizerStore.customHeight ?? 1080);
  }
  function onCustomH(e: Event) {
    const h = Number((e.target as HTMLInputElement).value);
    visualizerStore.setCustomDims(visualizerStore.customWidth ?? 1920, h);
  }
</script>

<div class="flex flex-col gap-2">
  <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif"
    >Video Format</span
  >
  <div class="flex flex-wrap gap-2">
    {#each FORMATS as f}
      <button
        onclick={() => visualizerStore.setFormat(f.id)}
        class="px-3 py-1 text-xs uppercase tracking-wider rounded border transition-all {f.id ===
        visualizerStore.formatId
          ? 'border-gold/50 text-gold bg-gold/10'
          : 'border-gold/15 text-white/50 hover:text-gold'}"
        style="font-family:'Raleway',sans-serif">{f.label}</button
      >
    {/each}
    <button
      onclick={() => visualizerStore.setFormat('custom')}
      class="px-3 py-1 text-xs uppercase tracking-wider rounded border transition-all {visualizerStore.formatId ===
      'custom'
        ? 'border-gold/50 text-gold bg-gold/10'
        : 'border-gold/15 text-white/50 hover:text-gold'}"
      style="font-family:'Raleway',sans-serif">Custom</button
    >
  </div>
  {#if visualizerStore.formatId === 'custom'}
    <div class="flex items-center gap-2 text-xs text-white/50">
      <input
        type="number"
        value={visualizerStore.customWidth ?? 1920}
        oninput={onCustomW}
        class="w-20 bg-white/5 border border-gold/20 rounded px-2 py-1 text-white/80 focus:outline-none focus:border-gold/50"
      />
      <span>×</span>
      <input
        type="number"
        value={visualizerStore.customHeight ?? 1080}
        oninput={onCustomH}
        class="w-20 bg-white/5 border border-gold/20 rounded px-2 py-1 text-white/80 focus:outline-none focus:border-gold/50"
      />
    </div>
  {/if}
</div>
```

- [ ] **Step 3: Typecheck**

Run: `pnpm check`
Expected: 0 errors / 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/Visualizer/VizStylePicker.svelte src/lib/components/Visualizer/FormatPicker.svelte
git commit -m "feat(visualizer): style picker + format picker components"
```

---

## Task 11: VisualizerStage

**Files:**
- Create: `src/lib/components/Visualizer/VisualizerStage.svelte`

Browser-verified in Task 13; `pnpm check` here.

- [ ] **Step 1: Write the component**

```svelte
<!-- src/lib/components/Visualizer/VisualizerStage.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { visualizerStore } from '$lib/stores/visualizer.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { VisualizerRenderer } from '$lib/renderer/visualizer-renderer';
  import { getFontFamily, ensureFontLoaded } from '$lib/montage/fonts';
  import { getAsset } from '$lib/storage/asset-store';

  interface Props {
    onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  }
  let { onCanvasReady }: Props = $props();

  let canvas = $state<HTMLCanvasElement>();
  let renderer: VisualizerRenderer | null = null;
  let raf = 0;
  let destroyed = false;
  let bg: ImageBitmap | null = null;
  let loadedBgKey: string | undefined;

  onMount(() => {
    if (!canvas) return;
    if (onCanvasReady) onCanvasReady(canvas);
    renderer = new VisualizerRenderer({ canvas });
    renderer.resize(visualizerStore.dims.width, visualizerStore.dims.height);
    renderer.setSettings(visualizerStore.settings);
    renderer.setAnalyser(playerStore.attachAnalyser());

    const loop = () => {
      if (!destroyed && renderer && !visualizerStore.exporting) {
        renderer.setStyle(visualizerStore.vizStyleId);
        renderer.setBands(visualizerStore.bands);
        renderer.setTitle(visualizerStore.title);
        renderer.setTextStyles(visualizerStore.titleStyle, visualizerStore.bandStyle);
        renderer.setSettings(visualizerStore.settings);
        renderer.setBackground(bg);
        renderer.renderAt(playerStore.currentTime);
      }
      if (!destroyed) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  });

  onDestroy(() => {
    destroyed = true;
    cancelAnimationFrame(raf);
    renderer = null;
    bg?.close?.();
    bg = null;
  });

  // Resize the canvas when the format/dims change.
  $effect(() => {
    const { width, height } = visualizerStore.dims;
    renderer?.resize(width, height);
  });

  // Load (and swap) the background bitmap when the stored key changes.
  $effect(() => {
    const key = visualizerStore.backgroundKey;
    if (key === loadedBgKey) return;
    loadedBgKey = key;
    if (!key) {
      bg?.close?.();
      bg = null;
      return;
    }
    void (async () => {
      const blob = await getAsset(key);
      if (!blob) return;
      const next = await createImageBitmap(blob);
      bg?.close?.();
      bg = next;
    })();
  });

  // Preload fonts the active styles use, so the first title/band frame isn't a fallback.
  $effect(() => {
    const t = visualizerStore.titleStyle;
    const b = visualizerStore.bandStyle;
    void ensureFontLoaded(getFontFamily(t.fontFamilyId).stack, t.fontWeight);
    void ensureFontLoaded(getFontFamily(b.fontFamilyId).stack, b.fontWeight);
  });
</script>

<div
  class="w-full bg-black rounded overflow-hidden border border-gold/10"
  style="aspect-ratio: {visualizerStore.dims.width} / {visualizerStore.dims.height}"
>
  <canvas bind:this={canvas} class="w-full h-full object-contain"></canvas>
</div>
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: 0 errors / 0 warnings.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/Visualizer/VisualizerStage.svelte
git commit -m "feat(visualizer): VisualizerStage (analyser attach, dynamic aspect, bg load)"
```

---

## Task 12: Export button + route + nav links

**Files:**
- Create: `src/lib/components/Visualizer/ExportButton.svelte`
- Create: `src/routes/visualizer/+page.svelte`
- Modify: `src/routes/montage/+page.svelte`, `src/routes/+page.svelte`

Browser-verified in Task 13; `pnpm check` here.

- [ ] **Step 1: Visualizer ExportButton**

```svelte
<!-- src/lib/components/Visualizer/ExportButton.svelte -->
<script lang="ts">
  import { visualizerStore } from '$lib/stores/visualizer.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { exportMontage } from '$lib/montage/export';
  import { VisualizerRenderer } from '$lib/renderer/visualizer-renderer';
  import { getAsset } from '$lib/storage/asset-store';
  import { toast } from 'svelte-sonner';

  let { getCanvas }: { getCanvas: () => HTMLCanvasElement | undefined } = $props();

  let recording = $state(false);
  let progress = $state(0);

  async function onExport() {
    const canvas = getCanvas();
    if (!canvas) return toast.error('Canvas not ready');

    const duration = visualizerStore.totalDuration;
    if (!duration) return toast.error('Add a song or lyrics to set the duration');

    recording = true;
    progress = 0;
    playerStore.pause();
    visualizerStore.exporting = true;

    const renderer = new VisualizerRenderer({ canvas });
    renderer.resize(visualizerStore.dims.width, visualizerStore.dims.height);
    renderer.setStyle(visualizerStore.vizStyleId);
    renderer.setBands(visualizerStore.bands);
    renderer.setTitle(visualizerStore.title);
    renderer.setTextStyles(visualizerStore.titleStyle, visualizerStore.bandStyle);
    renderer.setSettings(visualizerStore.settings);

    let bg: ImageBitmap | null = null;
    if (visualizerStore.backgroundKey) {
      const bgBlob = await getAsset(visualizerStore.backgroundKey);
      if (bgBlob) {
        bg = await createImageBitmap(bgBlob);
        renderer.setBackground(bg);
      }
    }

    const audioBlob = visualizerStore.audioKey ? await getAsset(visualizerStore.audioKey) : null;

    try {
      const blob = await exportMontage({
        canvas,
        audioFile: audioBlob,
        durationSec: duration,
        fps: visualizerStore.settings.fps,
        onAnalyserReady: (a) => renderer.setAnalyser(a),
        renderFrame: (t) => renderer.renderAt(t),
        onProgress: (f) => (progress = f),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${visualizerStore.title.replace(/\s+/g, '-').toLowerCase()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Video downloaded');
    } catch (err) {
      toast.error('Export failed — try Chrome or Edge');
      console.error(err);
    } finally {
      bg?.close?.();
      recording = false;
      visualizerStore.exporting = false;
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

- [ ] **Step 2: The route** (mirrors the montage page; uses `base` for the nav link)

```svelte
<!-- src/routes/visualizer/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import Controls from '$lib/components/Player/Controls.svelte';
  import TextStylePanel from '$lib/components/Montage/TextStylePanel.svelte';
  import VisualizerStage from '$lib/components/Visualizer/VisualizerStage.svelte';
  import VizStylePicker from '$lib/components/Visualizer/VizStylePicker.svelte';
  import FormatPicker from '$lib/components/Visualizer/FormatPicker.svelte';
  import ExportButton from '$lib/components/Visualizer/ExportButton.svelte';
  import { visualizerStore } from '$lib/stores/visualizer.svelte';

  let canvasEl = $state<HTMLCanvasElement>();
  let audioInput: HTMLInputElement;
  let bgInput: HTMLInputElement;

  onMount(() => {
    visualizerStore.restore();
  });

  function onAudio(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) visualizerStore.loadAudio(file);
  }
  function onBackground(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) visualizerStore.setBackground(file);
  }
</script>

<div class="min-h-screen bg-surface text-white">
  <header class="flex items-center justify-between px-6 py-4 border-b border-gold/10">
    <h1 class="text-gold text-lg tracking-[0.3em] uppercase" style="font-family:'Raleway',sans-serif">
      Audio Visualizer
    </h1>
    <a
      href="{base}/montage"
      class="text-gold/40 hover:text-gold text-xs uppercase tracking-wider">Photo montage →</a
    >
  </header>

  <div class="flex flex-col lg:flex-row gap-6 p-6">
    <aside class="w-full lg:w-96 flex-shrink-0 flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif">Video Title</span>
        <input
          type="text"
          value={visualizerStore.videoTitle}
          oninput={(e) => visualizerStore.setTitle((e.target as HTMLInputElement).value)}
          placeholder="Visualizer"
          class="w-full bg-white/5 border border-gold/20 rounded px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-gold/50"
        />
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif">Song</span>
        <input bind:this={audioInput} type="file" accept="audio/*" class="hidden" onchange={onAudio} />
        <button
          onclick={() => audioInput.click()}
          class="bg-gold/15 border border-gold/30 text-gold px-4 py-2 text-sm tracking-widest uppercase rounded cursor-pointer hover:bg-gold/30 transition-all"
          style="font-family:'Raleway',sans-serif">Add Song</button
        >
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif">Background / Album Art</span>
        <input bind:this={bgInput} type="file" accept="image/*" class="hidden" onchange={onBackground} />
        <div class="flex gap-2">
          <button
            onclick={() => bgInput.click()}
            class="flex-1 bg-gold/15 border border-gold/30 text-gold px-4 py-2 text-sm tracking-widest uppercase rounded cursor-pointer hover:bg-gold/30 transition-all"
            style="font-family:'Raleway',sans-serif">{visualizerStore.backgroundKey ? 'Change' : 'Add Image'}</button
          >
          {#if visualizerStore.backgroundKey}
            <button
              onclick={() => visualizerStore.removeBackground()}
              class="bg-white/5 border border-gold/20 text-white/60 px-3 py-2 text-sm rounded cursor-pointer hover:bg-white/10 transition-all">Remove</button
            >
          {/if}
        </div>
      </div>

      <VizStylePicker />
      <FormatPicker />

      <div class="flex flex-col gap-2">
        <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif">Lyrics (timestamps)</span>
        <textarea
          value={visualizerStore.lyricsText}
          oninput={(e) => visualizerStore.importLyrics((e.target as HTMLTextAreaElement).value)}
          rows="8"
          placeholder={"[00:11.162] Sembah [00:11.392] berlalu..."}
          class="w-full bg-white/5 border border-gold/20 rounded px-3 py-2 text-sm text-white/80 font-mono placeholder:text-white/20 focus:outline-none focus:border-gold/50 resize-y"
        ></textarea>
      </div>

      <TextStylePanel />
    </aside>

    <main class="flex-1 flex flex-col gap-4">
      <VisualizerStage onCanvasReady={(c) => (canvasEl = c)} />
      <Controls hideAudioUpload />
      {#if canvasEl && visualizerStore.ready}
        <ExportButton getCanvas={() => canvasEl} />
      {/if}
    </main>
  </div>
</div>
```

- [ ] **Step 3: Cross-link from montage** — in `src/routes/montage/+page.svelte` header, the existing right-hand link is "Lyrics-only mode →". Add a visualizer link before it:

```svelte
    <a href="{import.meta.env.BASE_URL}visualizer" class="text-gold/40 hover:text-gold text-xs uppercase tracking-wider">Visualizer →</a>
```

(Montage already uses `import.meta.env.BASE_URL` for its one-level links and that works; keep its existing convention here for consistency within that file.)

- [ ] **Step 4: Cross-link from home** — in `src/routes/+page.svelte`, add a link to `/visualizer` alongside the existing montage entry point. Match the existing link markup in that file: if the home page links to montage via `{import.meta.env.BASE_URL}montage`, add a sibling `{import.meta.env.BASE_URL}visualizer` link labelled "Audio Visualizer". (Read the file first to match its exact markup/classes.)

- [ ] **Step 5: Typecheck + build**

Run: `pnpm check && pnpm build`
Expected: check 0/0; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/Visualizer/ExportButton.svelte src/routes/visualizer/+page.svelte src/routes/montage/+page.svelte src/routes/+page.svelte
git commit -m "feat(visualizer): export button, /visualizer route, nav cross-links"
```

---

## Task 13: Full verification + ship

**Files:** none (verification + push)

- [ ] **Step 1: Full unit suite + typecheck + build**

Run: `pnpm test && pnpm check && pnpm build`
Expected: all tests PASS; check 0 errors / 0 warnings; build succeeds.

- [ ] **Step 2: Browser-verify the visualizer** (recipe from the montage handoff)

```bash
pnpm preview --port 4178 --host   # serves /lyricvideo base locally
```

In Playwright (`http://localhost:4178/lyricvideo/visualizer`):
1. Inject a synthetic audio `File` into `input[type=file][accept="audio/*"]` via `DataTransfer` + dispatch `change`; press Play.
2. Confirm the canvas reacts (a bars/wave frame changes between two screenshots while playing).
3. Set lyrics via the textarea (native value setter + `input`) and a title; seek `main input[type=range]` to t≈1s → title card visible; seek to a band time → lyric band visible over the visualizer.
4. Click each of the six style buttons → canvas repaints in that style.
5. Click TikTok (9:16) and Custom 800×800 → stage container + canvas aspect change.
6. Upload a background image → it draws (dimmed) under the visualizer.
7. Click "Download Video" → a `.webm` downloads; play it back to confirm video + audio at the selected resolution.

Read screenshots from `~/.jinn/`, then delete them.

- [ ] **Step 3: Montage regression re-check**

In Playwright (`http://localhost:4178/lyricvideo/montage`): load a photo + lyrics + title; confirm title card + lyric band still render correctly (the text-overlays extraction) and an export still works.

- [ ] **Step 4: Push to main** (CF Pages auto-deploys; per `feedback_no_ci_poll`, do NOT poll the pipeline)

```bash
git push origin main
```

- [ ] **Step 5: Confirm** the feature is live at `https://lyricvideo.pages.dev/visualizer` (CF serves at root, no `/lyricvideo` prefix) once the deploy finishes.

---

## Notes for the executor

- **Don't** stage `vite.config.ts` (it carries a pre-existing local dev-port change unrelated to this feature).
- The `/dev/visualizer/*` mockups stay as-is; the production `viz-styles.ts` is a separate, draw-only copy.
- If a `pnpm check` warning about an unused import/const appears after a deletion (e.g. `getFontFamily` in `montage-renderer.ts`, `SURFACE` in `viz-styles.ts`), remove the dead symbol — the build must stay 0 warnings.
- Each task is independently committable. The prior visualizer-mockup work landed via a feature branch → `--no-ff` merge; match whatever branch/merge workflow the user asks for at execution time.
