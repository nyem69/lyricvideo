# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A browser-only lyrics video generator. The workflow: generate a song on Suno → extract word-level timestamps with the bundled Chrome extension → paste them in → pick a visual preset → preview a synced lyrics video. No backend; everything runs client-side and deploys as a static site. See `docs/001-Requirements.md` for product vision and scope.

`prototype.html` is the original single-file prototype (Hari Raya theme). It is reference/history only — the live app is the SvelteKit project under `src/`.

## Commands

- `pnpm dev` — dev server on port 5178
- `pnpm build` / `pnpm preview` — static build (adapter-static) / preview it
- `pnpm check` — `svelte-kit sync` + `svelte-check` typecheck
- `pnpm test` — run vitest once; `pnpm test:watch` for watch mode
- Run a single test file: `pnpm vitest run src/lib/parser/suno.test.ts`

Package manager is **pnpm** (pnpm-lock.yaml, pnpm-workspace.yaml). Tests run in the `node` environment (vitest.config.ts), so parser/model logic must stay DOM-free to be testable.

## Stack

SvelteKit 2 + **Svelte 5 (runes)**, TypeScript strict, Tailwind **v4** (configured in CSS via `@theme` in `src/app.css`, not a JS config), `@sveltejs/adapter-static`. UI deps: `@lucide/svelte` (Svelte 5 only — never `lucide-svelte`), `bits-ui`, `svelte-sonner` (toasts), `nanoid` (IDs).

- Deploys to **Cloudflare only**, served at the domain root — **base path is always `''`** (svelte.config.js). GitHub Pages was retired 2026-07-25; its `/lyricvideo` subpath base made local dev diverge from prod and blocked the localized-crawler SEO work. Don't reintroduce env-conditional `paths.base` — two bases means every asset URL has two truths.
- `src/routes/+layout.ts` sets `ssr = false` / `prerender = false` — this is a fully client-rendered SPA. Don't add server-side load logic.
- Fonts (Playfair Display, Great Vibes, Bebas Neue, Raleway) are loaded via Google Fonts `<link>` in `src/app.html`; preset `fontFamily` values depend on them.

## Architecture

The single source of truth is the **`Song` data model** (`src/lib/model/types.ts`): `Song → Section → Line → Word`, each with timing in **seconds**. Visual styling is a separate, parallel concern via `StyleMap` (a global `PresetId` plus per-section overrides).

Two **singleton rune-based stores** (instantiated and exported at module bottom — import the instance, not the class):

- `stores/player.svelte.ts` (`playerStore`) — owns the clock. A `requestAnimationFrame` loop advances `currentTime`. If an `<audio>` element is loaded it mirrors `audio.currentTime`; otherwise it integrates wall-clock delta (so the player works with no audio, driven only by timestamps). Exposes `$derived` `progress`, `formattedTime`, etc.
- `stores/project.svelte.ts` (`projectStore`) — owns `song` + `styleMap`. `currentSection` is `$derived` from `playerStore.currentTime`. `activePresetId` implements the **style cascade**: section override wins over global. `importTimestamps()` parses text and pushes `duration` into `playerStore`.

The **Renderer abstraction** (`renderer/types.ts`) decouples visual output from the data/clock. `Renderer` declares `type: 'css' | 'canvas' | 'webgl'`, but only **`CssRenderer`** exists today — adding canvas/webgl renderers is the intended extension path. Key point: `CssRenderer` is **imperative DOM manipulation**, not Svelte-reactive. It builds its own `<div>` layers (background, vignette, display) inside the mount container and animates lines via inline styles + `setTimeout`. It is driven entirely by `PlayerShell.svelte`, which wires store reactivity to the renderer through two `$effect`s: one calls `renderer.setPreset()` when `activePresetId` changes, the other calls `renderer.update(currentTime, currentSection)` every frame. The renderer tracks shown lines and section transitions internally.

**Style presets** (`src/lib/presets/`): one file per preset, each a `StylePreset` with a `CssPresetConfig` (font, color, background gradient, enter/exit animation, `maxVisibleLines`, `transitionDuration`). Registered in `presets/index.ts`. To add a preset: create the file, add its `PresetId` to the union in `model/types.ts`, and register it in the `presets` map.

**Parser** (`src/lib/parser/suno.ts`): converts the Chrome extension's `[MM:SS.mmm] word` text into a `Song`. Blank lines separate sections; `[Title: ...]` sets the title; `← (...)` annotations are stripped; section `endTime` is the next section's `startTime` (last section + 5s). All sections are typed `'verse'` for now. Has the only unit tests in the repo (`suno.test.ts`).

**Components** (`src/lib/components/`, aliased `$components`): `Editor/` (LyricsImport, StylePicker) feed `projectStore`; `Player/` (PlayerShell renders the video, Controls handles play/seek/audio-upload + keyboard shortcuts: Space=toggle, R=restart, ←/→=±5s). `src/routes/+page.svelte` is the single-page layout tying them together.

**`suno-lyric-timestamps/`** — the standalone Chrome extension (manifest v3) that extracts word-level timestamps from `suno.com/edit/…` by walking the React fiber tree. It outputs the `[mm:ss.mmm] word` format the parser consumes. See its README for how it works.

## Language Note

The prototype and sample lyrics are Malay (Bahasa Melayu), but the app itself is being generalized for any language (English-language UI). Don't assume Hari Raya / Malay specificity when working in `src/`.
