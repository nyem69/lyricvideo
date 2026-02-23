# Phase 1 Design: SvelteKit Lyrics Video Generator

## Summary

Refactor the monolithic `index.html` prototype into a SvelteKit app following pavedriver's dual-target architecture patterns. Implement timestamp import, 4 CSS presets, a style picker, and audio-synced playback.

---

## Infrastructure Requirements

### Build & Runtime

| Requirement | Tool | Version | Notes |
|---|---|---|---|
| **Framework** | SvelteKit | 2.x | With Svelte 5 (runes) |
| **Bundler** | Vite | 6.x | Via `@sveltejs/kit/vite` |
| **CSS** | Tailwind CSS | 4.x | Via `@tailwindcss/vite` plugin |
| **Language** | TypeScript | 5.x | Strict mode |
| **Package manager** | pnpm | latest | Consistent with pavedriver |

### Deployment (Phase 1: GitHub Pages)

| Requirement | Details |
|---|---|
| **Adapter** | `@sveltejs/adapter-static` with `fallback: 'index.html'` (SPA mode) |
| **Hosting** | GitHub Pages (free, static files only) |
| **Domain** | `nyem69.github.io/lyricvideo` (or custom domain later) |
| **CI/CD** | GitHub Actions: build + deploy to `gh-pages` branch |

### NOT Required for Phase 1

| Item | Why Not |
|---|---|
| Database | No server, no persistence beyond localStorage |
| Cloudflare Workers / Hyperdrive / KV | No server-side code; pure SPA |
| Auth / Better Auth | No user accounts |
| Capacitor / Mobile | Deferred to Phase 4+ (but adapter pattern is ready) |
| Wrangler / wrangler.toml | No Workers deployment |
| Drizzle / MySQL | No database |
| Sentry | Not needed for MVP |

### Future Infrastructure (ready in architecture but not configured)

| Item | When | What's Needed |
|---|---|---|
| Cloudflare Workers | Phase 3+ (if server-side export) | `adapter-cloudflare`, `wrangler.toml`, Workers account |
| KV Namespace | Phase 3+ (project sharing/caching) | Cloudflare KV binding |
| Hyperdrive + MySQL | Phase 4+ (user accounts, saved projects) | Aiven MySQL, Hyperdrive config |
| Capacitor | Phase 4+ (mobile app) | `capacitor.config.ts`, iOS/Android projects |
| R2 Storage | Phase 4+ (exported video hosting) | Cloudflare R2 bucket |

---

## Dependencies

### Production

```
@sveltejs/adapter-static    # Static SPA output
@lucide/svelte              # Icons (Svelte 5)
bits-ui                     # UI primitives (dialog, select, slider)
clsx                        # Class merging
tailwind-merge              # Tailwind class deduplication
svelte-sonner               # Toast notifications
nanoid                      # ID generation for sections/lines
```

### Development

```
@sveltejs/kit               # Framework
@sveltejs/vite-plugin-svelte
@tailwindcss/vite           # Tailwind v4 Vite plugin
svelte                      # Svelte 5
svelte-check                # Type checking
tailwindcss                 # Tailwind v4
typescript
vite
```

---

## Architecture

### Dual-Adapter Pattern (from pavedriver)

**`svelte.config.js`:**
```javascript
const isCapacitor = process.env.CAPACITOR === 'true';

const config = {
  kit: {
    adapter: isCapacitor
      ? adapterStatic({ pages: 'build', fallback: 'index.html' })
      : adapterStatic({ pages: 'build', fallback: 'index.html' }),
    // Both targets use adapter-static for Phase 1
    // Phase 3+: web target switches to adapter-cloudflare
    paths: { base: isCapacitor ? '' : '/lyricvideo' } // GitHub Pages subpath
  }
};
```

### Project Structure

```
lyricvideo/
  suno-lyric-timestamps/              # Chrome extension (unchanged)
  src/
    app.html                          # HTML shell
    app.css                           # Tailwind imports + custom theme
    lib/
      parser/
        suno.ts                       # Parse [MM:SS.mmm] word format → Song
      model/
        types.ts                      # Song, Section, Line, Word, StylePreset, StyleMap
      stores/
        player.svelte.ts              # Playback: currentTime, isPlaying, audioEl
        project.svelte.ts             # Song data, styleMap, active preset
      renderer/
        types.ts                      # Renderer interface
        css-renderer.ts               # DOM + CSS animations (port from prototype)
      presets/
        index.ts                      # Preset registry + resolver
        clean-subtitle.ts
        cinematic-minimal.ts
        bold-impact.ts
        elegant-ceremony.ts
      components/
        ui/                           # bits-ui wrappers (button, dialog, slider)
        Editor/
          LyricsImport.svelte         # Paste textarea + parse + section preview
          StylePicker.svelte          # Preset grid with live thumbnails
        Player/
          PlayerShell.svelte          # Renderer container + lifecycle
          Controls.svelte             # Play/pause, seek slider, timer, audio upload
    routes/
      +layout.svelte                  # App shell: dark bg, font loading, toast
      +layout.ts                      # export const ssr = false
      +page.svelte                    # Main: editor panel + player preview
  static/
    favicon.svg
  svelte.config.js
  vite.config.ts
  package.json
  tsconfig.json
```

---

## Core Data Model

```typescript
// src/lib/model/types.ts

interface Song {
  id: string
  title: string
  artist?: string
  duration: number           // seconds (from audio or last timestamp)
  sections: Section[]
}

interface Section {
  id: string
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'interlude' | 'outro' | 'finale'
  label?: string
  startTime: number
  endTime: number
  lines: Line[]
}

interface Line {
  id: string
  text: string               // full line: "Sembah berlalu ramadhan suci"
  startTime: number          // first word timestamp
  words: Word[]
}

interface Word {
  text: string
  startTime: number
}

// Style system
type PresetId = 'clean-subtitle' | 'cinematic-minimal' | 'bold-impact' | 'elegant-ceremony'

interface StylePreset {
  id: PresetId
  name: string
  description: string
  renderer: 'css'            // Phase 1: CSS only
  config: CssPresetConfig
}

interface CssPresetConfig {
  fontFamily: string
  fontSize: string           // clamp() expression
  fontWeight: number
  fontStyle: 'normal' | 'italic'
  color: string
  letterSpacing: string
  textTransform: 'none' | 'uppercase'
  textShadow: string
  background: string         // CSS gradient
  enterAnimation: 'fade-up' | 'fade-in' | 'slide-left' | 'scale-in' | 'slam'
  exitAnimation: 'fade-out' | 'fade-up-out' | 'dissolve'
  maxVisibleLines: number
  transitionDuration: number // ms
}

interface StyleMap {
  global: PresetId
  sections: Record<string, PresetId>  // section.id → preset override
}
```

---

## Renderer Interface (from pavedriver's PositionProvider pattern)

```typescript
// src/lib/renderer/types.ts

interface Renderer {
  readonly type: 'css' | 'canvas' | 'webgl'
  mount(container: HTMLElement): void
  setPreset(preset: StylePreset): void
  showLine(line: Line): void
  clearLines(): void
  update(currentTime: number, section: Section): void
  resize(width: number, height: number): void
  destroy(): void
}
```

Phase 1 implements `CssRenderer` only. Phase 2+ adds `CanvasRenderer` and `WebGLRenderer`.

---

## Stores (Svelte 5 rune classes, from pavedriver pattern)

### PlayerStore

```typescript
class PlayerStore {
  currentTime = $state(0)
  isPlaying = $state(false)
  duration = $state(0)
  audioEl = $state<HTMLAudioElement | null>(null)
  isSeeking = $state(false)

  readonly progress = $derived(
    this.duration > 0 ? this.currentTime / this.duration : 0
  )
  readonly formattedTime = $derived(formatTime(this.currentTime))
  readonly formattedDuration = $derived(formatTime(this.duration))

  play() { ... }
  pause() { ... }
  seekTo(time: number) { ... }
  loadAudio(file: File) { ... }
}
export const playerStore = new PlayerStore()
```

### ProjectStore

```typescript
class ProjectStore {
  song = $state<Song | null>(null)
  styleMap = $state<StyleMap>({ global: 'elegant-ceremony', sections: {} })

  readonly currentSection = $derived(...)  // based on playerStore.currentTime
  readonly activePreset = $derived(...)    // resolved from styleMap cascade

  importTimestamps(text: string) { ... }  // calls suno parser
  setGlobalPreset(presetId: PresetId) { ... }
}
export const projectStore = new ProjectStore()
```

---

## Suno Timestamp Parser

Input format (from Chrome extension):
```
[00:11.162] Sembah [00:11.392] berlalu [00:11.776] ramadhan [00:15.083] suci
[00:15.776] Berkah [00:16.314] amalan [00:16.776] meruntun [00:17.315] jiwa
```

Parser logic:
1. Split by newlines → raw lines
2. Per line, regex extract `[MM:SS.mmm]` + word pairs
3. Group words into `Line` objects (one per text line)
4. Group lines into `Section` objects (split on blank lines)
5. Auto-detect section types from position (first = intro, repeated text = chorus, etc.) or default to 'verse'
6. Strip annotation markers like `← (also: ...)` and `← (truncated ...)`

---

## 4 CSS Presets

### 1. Clean Subtitle
- White text, bottom-third positioning, dark semi-transparent bar
- Sans-serif (system font), 24-32px
- Minimal animation: fade-in/fade-out 200ms
- Active line highlighted, previous lines dimmed

### 2. Cinematic Minimal
- Centered, thin sans-serif (Raleway 200), uppercase, wide letter-spacing
- Dark gradient background, slow color shifts
- Fade-up entrance (translateY 20px), scale-out exit
- Vignette overlay

### 3. Bold Impact
- Massive condensed text (Bebas Neue / Anton), fills screen width
- Pure black background, optional color flash on beat
- Slam entrance: scale(3→1) with hard ease-out 300ms
- Fast slide-out exit

### 4. Elegant Ceremony
- Generalized from current Hari Raya prototype
- Playfair Display + Great Vibes, gold (#d4af37) accent
- Floating particles, geometric overlay, crescent decoration
- Fade-up entrance with long easing, fade-through-black transitions

---

## UI Layout

Single-page app with two panels:

```
+--------------------------------------------------+
| [Logo] Lyrics Video Generator        [Fullscreen] |
+--------------------------------------------------+
| EDITOR PANEL (left/top)  | PLAYER PANEL (right)  |
|                          |                        |
| [Import Timestamps]      |  +------------------+ |
| [Paste area...]          |  | Preview Canvas   | |
| [Parse]                  |  | (16:9 aspect)    | |
|                          |  |                  | |
| Sections:                |  |  Lyrics appear   | |
|  > Verse 1 (4 lines)    |  |  here...         | |
|  > Chorus (4 lines)     |  |                  | |
|  > Verse 2 (4 lines)    |  +------------------+ |
|  > ...                   |  [Play][Seek---][4:15] |
|                          |  [Upload MP3] [name]  |
| Style: [preset picker]  |                        |
+--------------------------------------------------+
```

On mobile/narrow screens: stacked vertically (editor on top, player below).

---

## Google Fonts Required

```
Raleway:wght@100;200;300;400;600       # Cinematic Minimal + UI
Playfair+Display:wght@400;700;900      # Elegant Ceremony
Great+Vibes                            # Elegant Ceremony (chorus)
Bebas+Neue                             # Bold Impact
```

Loaded via `<link>` in `app.html` (no @import to avoid render blocking).

---

## Build Scripts

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "deploy": "vite build && npx gh-pages -d build",
    "cap:build": "CAPACITOR=true vite build",
    "cap:sync": "CAPACITOR=true vite build && npx cap sync"
  }
}
```

---

## Implementation Steps

1. Scaffold SvelteKit project with adapter-static, Tailwind v4, TypeScript
2. Create data model types (`types.ts`)
3. Implement Suno timestamp parser (`suno.ts`) with tests
4. Create player store (`player.svelte.ts`) — port timing engine from prototype
5. Create project store (`project.svelte.ts`)
6. Implement Renderer interface + CssRenderer (port from prototype)
7. Build 4 CSS presets
8. Build LyricsImport component (paste + parse)
9. Build StylePicker component (preset grid)
10. Build PlayerShell + Controls components
11. Wire up main page layout (editor + player panels)
12. Add fullscreen support
13. Test with the existing `lyric-timestamp.txt` data
14. Deploy to GitHub Pages
