# Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the monolithic `index.html` into a SvelteKit app with timestamp import, 4 CSS presets, style picker, and audio-synced playback.

**Architecture:** SvelteKit 2 + Svelte 5 runes + adapter-static (SPA). Follows pavedriver's patterns: class-based rune stores, pluggable renderer interface, dual-adapter config. No server, no database -- pure client-side app deployed to GitHub Pages.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, Tailwind CSS 4, Vite 6, bits-ui, @lucide/svelte, vitest

---

## Task 1: Scaffold SvelteKit Project

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`
- Create: `src/app.html`, `src/app.css`
- Create: `src/routes/+layout.svelte`, `src/routes/+layout.ts`, `src/routes/+page.svelte`
- Rename: `index.html` to `prototype.html`

**Steps:**
1. `pnpm create svelte@latest temp-scaffold` (skeleton, TypeScript)
2. Merge scaffold into project root, rename `index.html` to `prototype.html`
3. `pnpm install`
4. `pnpm add @sveltejs/adapter-static @lucide/svelte bits-ui clsx tailwind-merge svelte-sonner nanoid`
5. `pnpm add -D @tailwindcss/vite tailwindcss vitest`
6. Write `svelte.config.js` with adapter-static + `paths.base: '/lyricvideo'` + CAPACITOR env var pattern
7. Write `vite.config.ts` with tailwindcss + sveltekit plugins, port 5178
8. Write `src/app.css` with Tailwind imports + custom theme (gold, surface, font vars)
9. Write `src/app.html` with Google Fonts link (Playfair Display, Great Vibes, Bebas Neue, Raleway)
10. Write `src/routes/+layout.ts` with `ssr = false`
11. Write `src/routes/+layout.svelte` importing app.css + Toaster
12. Write `src/routes/+page.svelte` with placeholder heading
13. `pnpm dev` -- verify loads at localhost:5178/lyricvideo
14. Commit: `feat: scaffold SvelteKit project with Tailwind, adapter-static, and dual-adapter pattern`

---

## Task 2: Data Model Types

**Files:**
- Create: `src/lib/model/types.ts`

**Steps:**
1. Define: `Word`, `Line`, `Section`, `SectionType`, `Song`
2. Define: `PresetId`, `AnimationEnter`, `AnimationExit`, `CssPresetConfig`, `StylePreset`, `StyleMap`
3. `pnpm check` -- no errors
4. Commit: `feat: add core data model types`

---

## Task 3: Suno Timestamp Parser with Tests

**Files:**
- Create: `src/lib/parser/suno.ts`
- Create: `src/lib/parser/suno.test.ts`

**Steps:**
1. Write tests covering: single line, multiple lines, blank line section split, annotation stripping, title metadata, timestamp conversion, empty input
2. `pnpm vitest run src/lib/parser/suno.test.ts` -- all fail
3. Implement `parseSunoTimestamps(input: string): Song` with regex `[MM:SS.mmm] word` extraction, section splitting on blank lines, annotation stripping
4. `pnpm vitest run src/lib/parser/suno.test.ts` -- all pass
5. Commit: `feat: implement Suno timestamp parser with tests`

---

## Task 4: Player Store

**Files:**
- Create: `src/lib/stores/player.svelte.ts`

**Steps:**
1. Implement `PlayerStore` class with Svelte 5 runes:
   - State: `currentTime`, `isPlaying`, `duration`, `isSeeking`
   - Derived: `progress`, `formattedTime`, `formattedDuration`, `hasAudio`
   - Methods: `play()`, `pause()`, `toggle()`, `seekTo()`, `loadAudio()`, `setDuration()`, `restart()`, `destroy()`
   - Private: `requestAnimationFrame` loop syncing to `audioEl.currentTime` when audio loaded, delta-based when not
2. Export singleton: `export const playerStore = new PlayerStore()`
3. `pnpm check` -- no errors
4. Commit: `feat: add player store with audio sync, seek, and rAF timing loop`

---

## Task 5: Project Store

**Files:**
- Create: `src/lib/stores/project.svelte.ts`

**Steps:**
1. Implement `ProjectStore` class:
   - State: `song`, `styleMap`
   - Derived: `currentSection` (from playerStore.currentTime), `activePresetId` (cascade: line > section > global)
   - Methods: `importTimestamps()`, `setGlobalPreset()`, `setSectionPreset()`, `clear()`
2. Export singleton
3. `pnpm check` -- no errors
4. Commit: `feat: add project store with style cascade and section tracking`

---

## Task 6: Renderer Interface + CssRenderer

**Files:**
- Create: `src/lib/renderer/types.ts`
- Create: `src/lib/renderer/css-renderer.ts`

**Steps:**
1. Define `Renderer` interface: `mount`, `setPreset`, `showLine`, `clearLines`, `update`, `resize`, `destroy`
2. Implement `CssRenderer`:
   - Creates DOM layers (bgLayer, vignette, display) in `mount()`
   - `setPreset()` applies background + stores config
   - `showLine()` creates styled div with enter animation, removes excess lines
   - `clearLines()` fades out + removes after transition
   - `update()` detects section changes, shows lines at scheduled times, uses `isTransitioning` guard
3. `pnpm check` -- no errors
4. Commit: `feat: add Renderer interface and CssRenderer with animated line display`

---

## Task 7: Four CSS Presets

**Files:**
- Create: `src/lib/presets/clean-subtitle.ts`
- Create: `src/lib/presets/cinematic-minimal.ts`
- Create: `src/lib/presets/bold-impact.ts`
- Create: `src/lib/presets/elegant-ceremony.ts`
- Create: `src/lib/presets/index.ts`

**Steps:**
1. Create each preset as a `StylePreset` object with full `CssPresetConfig`
2. Create `index.ts` with `presets` record, `presetList` array, `getPreset()` function
3. `pnpm check` -- no errors
4. Commit: `feat: add 4 CSS presets (clean-subtitle, cinematic-minimal, bold-impact, elegant-ceremony)`

---

## Task 8: LyricsImport Component

**Files:**
- Create: `src/lib/components/Editor/LyricsImport.svelte`

**Steps:**
1. Textarea for pasting timestamp text
2. Parse button calls `projectStore.importTimestamps(text)`
3. Success/error toast via svelte-sonner
4. Section list preview below (type + line count per section)
5. `pnpm check` -- no errors
6. Commit: `feat: add LyricsImport component`

---

## Task 9: StylePicker Component

**Files:**
- Create: `src/lib/components/Editor/StylePicker.svelte`

**Steps:**
1. 2-column grid of preset cards
2. Each card shows: mini preview (background + sample text in preset font), name, description
3. Active preset highlighted with gold border
4. Click sets `projectStore.setGlobalPreset(id)`
5. `pnpm check` -- no errors
6. Commit: `feat: add StylePicker component`

---

## Task 10: Player Controls Component

**Files:**
- Create: `src/lib/components/Player/Controls.svelte`

**Steps:**
1. Play/Pause button (lucide icons), Restart button
2. Seek slider (range input) with isSeeking guard
3. Current time + duration display
4. Audio upload button + hidden file input
5. Keyboard shortcuts: Space (toggle), R (restart), Left/Right (seek +/-5s)
6. `pnpm check` -- no errors
7. Commit: `feat: add player Controls`

---

## Task 11: PlayerShell Component

**Files:**
- Create: `src/lib/components/Player/PlayerShell.svelte`

**Steps:**
1. Container div with `aspect-video` that mounts the CssRenderer
2. `onMount`: create renderer, mount to container, set initial preset
3. `$effect` for preset changes: calls `renderer.setPreset()`
4. `$effect` for playback: calls `renderer.update(time, section)`
5. Cleanup on destroy
6. `pnpm check` -- no errors
7. Commit: `feat: add PlayerShell`

---

## Task 12: Main Page Layout

**Files:**
- Modify: `src/routes/+page.svelte`

**Steps:**
1. Header bar with title + fullscreen button
2. Two-panel layout: sidebar (LyricsImport + StylePicker) | main (PlayerShell + Controls)
3. Responsive: side-by-side on lg+, stacked on mobile
4. Fullscreen toggles on the player container
5. `pnpm dev` -- verify visual layout
6. Test: paste lyric-timestamp.txt data, parse, play, switch presets
7. Commit: `feat: wire up main page with editor + player layout`

---

## Task 13: End-to-End Testing & Polish

**Steps:**
1. Test all 4 presets while playing -- verify animations match spec
2. Test keyboard shortcuts (Space, R, arrows)
3. Test audio sync with MP3 upload
4. Test fullscreen mode
5. Fix any issues
6. Commit: `fix: polish and e2e testing fixes`

---

## Task 14: Build & Deploy to GitHub Pages

**Steps:**
1. `pnpm build && pnpm preview` -- verify production build works at /lyricvideo
2. Create `.github/workflows/deploy.yml` for automated deployment
3. `pnpm add -D gh-pages` as fallback manual deploy option
4. Commit: `ci: add GitHub Pages deploy workflow`
5. `git push` -- verify live at nyem69.github.io/lyricvideo
