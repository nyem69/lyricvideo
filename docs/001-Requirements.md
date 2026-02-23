# Lyrics Video Generator - Requirements

An app that generates shareable lyrics videos from song audio + timed lyrics.

## Vision

The fastest free path from "I have a song + lyrics" to "I have a shareable lyrics video." Primary workflow: generate a song on Suno, extract timestamps with the Chrome extension, pick a visual theme, export video.

## Target Users

1. **Primary: Suno AI music creators** who want to share songs with lyrics on YouTube/TikTok/Instagram. They already have MP3 + lyrics, just need the visual layer.
2. **Secondary: Independent musicians** wanting cheap/free lyrics videos without learning After Effects.
3. **Tertiary: Regional content creators** (Malay, Arabic, CJK) underserved by English-centric tools.

## Competitive Gap

- Suno does NOT generate lyrics videos (audio-only output)
- LyricEdits charges $39+/video and requires server upload
- CapCut/Adobe Express have no Suno integration and no word-level sync
- **Our edge:** Free, browser-only, Suno-native timestamp extraction, word-level sync accuracy, non-English support from day one

---

## What Exists (Prototype)

| Capability | Status |
|---|---|
| Timed lyric display with section themes | Working |
| MP3 upload + audio sync | Working |
| Seek slider, keyboard controls | Working |
| 6 CSS visual themes, 5 background scenes | Working |
| Floating particles, stars, geometric overlay | Working |
| Chrome extension for Suno timestamp extraction | Working |

### What is Hardcoded (Must Become Dynamic)

- Song lyrics, timestamps, section boundaries
- Style-to-section mapping, background assignments
- Total duration, intro title text, section labels
- Transition timing, max visible lines

### What is Missing Entirely

- Timestamp import/parsing (bridge between extension output and player)
- Lyrics editor / import UI
- Style preset selector with per-section/per-line control
- Video export
- Project save/load
- Word-level karaoke highlighting

---

## Scope (MoSCoW)

### Must Have (MVP)

- **Timestamp import**: Paste output from Chrome extension (`[mm:ss.mmm] word` format)
- **MP3 audio upload**: Already exists, keep it
- **3+ generalized visual presets**: Decouple from Hari Raya theme
- **Real-time preview**: Play video with audio sync (already works)
- **Section detection**: Auto-detect from blank lines or manual marking
- **Fullscreen mode**: For playback and screen recording fallback

### Should Have

- **Video export as MP4/WebM**: Via canvas recording + FFmpeg.wasm
- **Theme customization**: Colors, fonts, animation speed per section
- **Aspect ratio selection**: 16:9 (YouTube), 9:16 (TikTok/Reels), 1:1 (Instagram)
- **Chrome extension improvements**: Copy as JSON, "Send to Generator" button
- **Word-level highlighting**: Karaoke-style per-word color sync (data already available)
- **SRT import**: For non-Suno users

### Could Have

- Custom background images/videos
- Animation preset library (typewriter, bounce, wave)
- Template sharing (export/import theme configs as JSON)
- Star Wars crawl preset (achievable with CSS perspective, no three.js needed)
- Canvas 2D particle text effect

### Could Have (continued)

- **Video background overlay**: User uploads MP4 video, app overlays synced lyrics on top (composite lyrics over existing video content)
- **AI video generation integration**: Connect to video gen AI services (e.g. AtlasCloud, Runway, Kling) to auto-generate background visuals from song mood/lyrics, then composite lyrics on top of the AI-generated video

### Won't Have (Deferred)

- Server-side rendering / cloud export
- AI-generated background visuals
- User accounts / project storage beyond localStorage
- Mobile app
- Audio editing / mixing
- Automatic lyrics transcription from audio
- three.js / WebGL (defer to Phase 3 if needed)

---

## Style Preset Ideas (10 presets, simple to complex)

| # | Name | Description | Renderer | Complexity |
|---|------|-------------|----------|------------|
| 1 | **Clean Subtitle** | White text on dark bar, bottom-third. Active word highlighted. | CSS | Trivial |
| 2 | **Cinematic Minimal** | Large thin sans-serif, centered, dark gradients. Netflix title card feel. | CSS | Trivial |
| 3 | **Neon Glow** | Bold text with stacked neon text-shadow. Dark background with grid overlay. | CSS | Low |
| 4 | **Warm Acoustic** | Handwritten font, typewriter reveal, parchment tones, floating amber particles. | CSS+JS | Low |
| 5 | **Bold Impact** | Massive condensed text that slams on screen. Black background, optional color flash. | CSS | Low |
| 6 | **Elegant Ceremony** | Ornate serif/script, gold accents, decorative overlays. Current Hari Raya style generalized. | CSS+JS | Medium |
| 7 | **Star Wars Crawl** | 3D perspective scroll with CSS `rotateX`. Yellow text on star field. | CSS 3D | Low |
| 8 | **Lyric Story** | 9:16 vertical, text at varied positions, 2-3 words per frame. Instagram Story feel. | CSS+JS | Medium |
| 9 | **Particle Text** | Text formed by particles that assemble/disperse. Canvas 2D pixel sampling. | Canvas | Moderate |
| 10 | **3D Space** | Floating text planes in 3D with camera movement. Premium tier. | three.js | High |

## Animation Patterns

**Entrances:** fade-up, slide, scale-in, slam/impact, typewriter, word-by-word, bounce, blur-in, 3D rotate-in
**Emphasis:** glow pulse, color shift, scale pulse, active word highlight, underline grow
**Exits:** fade-out, dissolve, fly-away, particle disperse
**Backgrounds:** gradient morph, parallax layers, particle systems, geometric patterns, color mesh/aurora

CSS handles 80% of animation needs. Canvas 2D covers particle effects. three.js only needed for true 3D camera movement (Preset 10).

## Typography Strategy

| Genre | Primary Font | Secondary | Accent |
|-------|-------------|-----------|--------|
| Elegant/Formal | Playfair Display | Cormorant Garamond | Great Vibes |
| Pop/Upbeat | Poppins 600 | Quicksand | Pacifico |
| Hip-Hop/Bold | Bebas Neue | Oswald | Permanent Marker |
| Acoustic/Indie | Lora | Josefin Sans 300 | Caveat |
| Arabic/Malay | Amiri | Noto Naskh Arabic | - |
| CJK | Noto Serif CJK | Noto Sans CJK | - |

---

## Technical Architecture

### Recommended: SvelteKit + adapter-static (SPA)

Single-page app with no server. Chrome extension stays separate.

```
lyricvideo/
  suno-lyric-timestamps/          # Chrome extension (separate)
  src/
    lib/
      parser/                     # Suno, SRT, LRC format parsers
      model/                      # Types + Svelte 5 rune stores
      renderer/                   # CSS, Canvas, three.js renderers
      exporter/                   # MediaRecorder + FFmpeg.wasm
      presets/                    # Style preset registry
    routes/
      +page.svelte                # Main app: editor + preview
    components/
      Editor/                     # LyricsInput, SectionManager, StylePicker, Timeline
      Player/                     # PlayerShell, Controls, AudioSync
  static/
```

### Core Data Model

```
Project
  -> Song (title, artist, duration, audioFile)
       -> Section[] (type, label, startTime, endTime)
            -> Line[] (text, startTime, endTime)
                 -> Word[] (text, startTime, endTime)

StyleMap (cascade: global -> section override -> line override)
  -> global: PresetId
  -> sections: Record<sectionId, PresetId>
  -> lines: Record<lineId, PresetId>
```

### Renderer Interface

Presets declare their renderer type: `'css'` | `'canvas'` | `'webgl'`. A common interface:
- `mount(container)`, `setStyle(preset)`, `showLine(line, time)`, `update(time)`, `resize(w, h)`, `destroy()`

### Video Export Strategy

1. **MVP:** MediaRecorder capturing `<canvas>` stream (WebM, browser-native)
2. **Better:** Frame-by-frame capture + FFmpeg.wasm for MP4 with audio muxing
3. **Future:** Server-side Playwright + FFmpeg for production quality

### Key Technical Challenges (ranked by difficulty)

1. **Video export** - Requires canvas rendering path parallel to DOM; DOM-to-canvas fidelity
2. **three.js text quality** - Only for Preset 10; troika-three-text recommended
3. **Editor UX** - Section/style management UI is the most code-intensive part
4. **Timestamp parsing** - Multiple formats, edge cases in extension output

---

## three.js Assessment

**Star Wars crawl does NOT need three.js** - CSS `perspective` + `rotateX(25deg)` + `translateY` animation achieves the same effect with crisp DOM text and zero bundle cost.

three.js is only justified for:
- 3D camera movement through text scenes
- Post-processing effects (bloom, depth of field)
- Large particle systems (10K+)

**Recommendation:** Phase 3 at earliest. Load dynamically only when a 3D preset is selected.

---

## Phased Rollout

**Phase 1 (Week 1-2):** Refactor monolith into SvelteKit. Implement timestamp parser + import UI. Port 4 CSS-only presets (Clean Subtitle, Cinematic Minimal, Bold Impact, Elegant Ceremony). Basic style picker.

**Phase 2 (Week 3-4):** Add Star Wars crawl (CSS), Neon Glow, Warm Acoustic presets. Word-by-word highlighting. Aspect ratio selection. SRT import.

**Phase 3 (Month 2):** FFmpeg.wasm MP4 export. Lyric Story vertical preset. Canvas particle text.

**Phase 4 (Month 3+):** three.js 3D Space preset (lazy-loaded). Audio-reactive visualization. Custom backgrounds. **Video overlay mode** (user uploads MP4, app composites lyrics on top). **AI video gen integration** (AtlasCloud, Runway, Kling — generate background visuals from song mood/lyrics, composite lyrics on top).

---

## Distribution

- **Hosting:** GitHub Pages (free, static, no server)
- **Discovery:** Suno community (Reddit r/SunoAI, Discord, Twitter/X)
- **Viral loop:** Every generated video is marketing. Optional "Made with [tool]" watermark (removable).
- **Chrome Web Store:** Extension listing drives discovery

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Suno DOM changes break extension | High | Fallback to manual paste; support SRT/LRC import |
| Browser WebCodecs limited (Firefox/Safari) | Medium | Target Chrome first (users already have it for extension) |
| Feature creep into bad video editor | Medium | Hard rule: if it takes >2 days and can't be explained in 1 sentence, defer |
| Competition from Suno adding built-in export | Low | Dedicated tool with multiple themes will still have value |
