---
name: photo-lyric-montage
description: Use when building a warm photo/still montage music video set to a song — family memory books, tribute/in-memoriam pieces, slideshow-to-music, or lyric videos — especially with synced on-screen lyrics or bilingual lyric+translation. Triggers include "make a montage from these photos", "set these photos to this song", "lyric video", "add the lyrics/subtitles to the video", and any mix of portrait + landscape personal photos. OpenMontage + Remotion specific.
---

# Photo + Lyric Montage (Remotion `Explainer`)

## Overview

Build a warm, photo-led music video from personal stills set to a song, optionally with karaoke-synced lyrics (and a translation line). Renders through OpenMontage's **`Explainer`** Remotion composition using three custom components, then muxes audio with ffmpeg.

**Core principle:** drive Remotion directly (silent) and mux music after — and let photos run *under* the lyrics so title cards never collide with the lyric band. Most of this skill is hard-won gotchas; read the table before writing any code.

This skill is the distilled recipe behind `projects/karabatan-family-montage/` — copy those scripts and adapt.

## The gotchas that make or break it (read first)

| Problem | Fix |
|---|---|
| Remotion `<Img>` **and** `<Audio>` reject `file://` (Chrome security) | Stage images into `remotion-composer/public/<slug>/NNN.jpg`, reference relative (`<slug>/001.jpg`) → resolved via `staticFile()`. Render **silent**; mux the mp3 with ffmpeg afterward. |
| `video_compose` has a hard **600s subprocess timeout** that clips long renders | Drive `npx remotion render src/index.tsx Explainer ...` directly via Bash. Never route a >~3min render through `video_compose`. |
| `CinematicRenderer` is a cold, desaturated, **video-only** sci-fi renderer (no still Ken Burns) | Use the **`Explainer`** composition (`renderer_family: "animation-first"`). Wrong renderer = wrong mood. |
| Stock `ImageScene` (bare `source` cut) uses `objectFit: cover` → **crops faces** off portraits | Use the **`photo`** cut type → `PhotoScene` (contain + blur-fill). Faces never cropped. |
| `blur(28px)` on a full-frame `<Img>` is the **1080p render bottleneck** (~30 min/4-min video) | `PhotoScene` renders the fill at 25% size + `scale(4)` with `blur(7px)` (≈28px at full res, 1/16th the pixels). Visually identical. |
| A `title_card` **with a subtitle** overlaps the bottom `lyric_band` | Size the photo section so photos run under **every** lyric line; place close/credit cards **after** the last lyric. Title-only cards over lyrics are fine; subtitled ones are not. |
| Poetic translations don't map 1:1 to lines → desync | For synced lyrics use a **faithful per-line** translation (one entry per source line), not a poetic rewrite. |
| **Non-Latin lyrics render as tofu/boxes** — `LyricBand`/`TitleCard` hardcode **Playfair Display (Latin-only)** | Before rendering any non-Latin script (Tamil, Arabic, Hindi, CJK, Thai, Cyrillic…), swap the component font to a script-capable family via `@remotion/google-fonts` (e.g. `NotoSerifTamil`, `NotoNaskhArabic`, `NotoSerifSC`). `LyricBand` shows only two lines (`text` + `subtitle`) — no third romanization line without editing the component. |
| Video longer than the song (end-credit tail) → abrupt music / truncated credit | Fade out at the song's real end (`afade st = music_dur - fade`; get `music_dur` via `ffprobe`), add `apad`, keep `-shortest` → output matches the longer video with a clean silent tail. |

## Components (in `remotion-composer/src/components/`, wired into `Explainer.tsx`)

- **`PhotoScene`** — cut `type:"photo"` — whole photo (contain) over a quarter-res blur-fill, shared Ken Burns. For mixed portrait/landscape personal photos.
- **`LyricBand`** — overlay `type:"lyric_band"` — bilingual line: `text` (primary, e.g. Javanese) over lighter `subtitle` (translation), Playfair italic bottom band with scrim.
- **`TitleCard`** — cut `type:"title_card"` — warm Playfair title + gold divider + optional `subtitle`. Use instead of `HeroTitle` (cold cyan) or `TextCard` (collapses `\n`).

See `remotion-composer/SCENE_TYPES.md` for full cut/overlay schemas.

## Workflow

1. **Pipeline + preflight.** `cinematic` pipeline, `render_runtime: remotion`, `renderer_family: animation-first`. Confirm `ffmpeg` works (a broken libx265 will fail mux — `brew reinstall x265 ffmpeg`).
2. **Asset prep.** Convert HEIC/jpg → full-res jpg (`sips -s format jpeg`, which bakes EXIF rotation so portraits don't render sideways) into `projects/<slug>/assets/images/full/NNN.jpg`, index 001…N. Build contact sheets (montage) to learn the content. **Copy the same images** into `remotion-composer/public/<slug>/`. Removing a photo from `assets/images/full/` auto-drops it from curation (the builder checks existence there). Rough sizing: aim for ~2–3s per photo, so cull a large set toward `song_length / 2.5` photos (e.g. ~100 for a 4-min song); the beat sampling does the culling.
3. **Lyrics (if any).** If you have a word-level timestamped file (`[mm:ss.xxx]` per word), parse each non-empty line → first timestamp = onset, last = last word. Pair each line with a faithful translation list (assert equal length). Band `out = min(next_onset - 0.25, last_word + 1.8)` so lines hand off and fade across instrumental gaps. Other formats: LRC is per-line (one timestamp/line — still works, `last_word` = onset); `.ass`/JSON word-level need a parser tweak. If only plain lyrics exist, you must time them (by ear, or align with a transcription tool) first.
4. **Curation (`build_edit.py`).** Define `BEATS` = emotional arc, each an index-range list + target count. Even-sample within ranges to thin near-duplicate bursts; order beats into the song arc; place the hero/group beat on the song's loudness peak. Compute photo `step` dynamically so photos span `OPEN_DUR → last_lyric_out + tail`.
5. **Assemble `edit_decisions.json`.** Open `title_card` → `photo` cuts (cycle Ken Burns animations) → close `title_card` → minimal credit `title_card`. `overlays` = the synced `lyric_band` list (clamped to where photos end). `audio.music` = path + fades. The credit card is a `title_card` placed **after** the last lyric (so its subtitle is collision-safe) — keep it minimal: song title + artist/composer (e.g. `title:"…", subtitle:"Lagu — <artist>"`). A tribute may also want an in-memoriam line on the opening card.
6. **Verify cheap before rendering full.** Render **stills** at key timestamps (`npx remotion still ... --frame=N --props=...`) — early lyric, hero, final lyric over photo, close card, credit. Catch collisions/crops here, not after a 30-min render.
7. **Render (`render_run.py`).** Strip `audio` from props → `npx remotion render ... Explainer --props ... --width 1920 --height 1080 --concurrency 8` (silent). Then ffmpeg mux: `afade` in/out (out at `music_dur - fade`) + `apad`, `-map 0:v -map 1:a -c:v copy -c:a aac -shortest`.
8. **Final QA.** Extract a few frames from the muxed `final.mp4` and check audio levels (`ffmpeg -af volumedetect`). Confirm duration, no silence, no collisions.
9. **Subtitles (optional).** Collapse the timestamped lyrics into SRT for YouTube — see `lyricvideo/make_srt.py` (mono + bilingual tracks, no overlapping cues).

## Quick reference

```jsonc
// photo cut
{ "id":"p001","type":"photo","source":"<slug>/042.jpg",
  "in_seconds":6.0,"out_seconds":9.3,"animation":"ken-burns" }
// lyric band overlay (bilingual)
{ "type":"lyric_band","in_seconds":16.66,"out_seconds":24.46,
  "text":"<primary line>","subtitle":"<translation>","bottomY":0.84 }
// title / credit card
{ "id":"title_open","type":"title_card","title":"…","subtitle":"…",
  "in_seconds":0,"out_seconds":6 }
```

```bash
# silent render, then mux (the only render path that survives long videos)
npx remotion render src/index.tsx Explainer out_silent.mp4 \
  --props props.json --width 1920 --height 1080 --concurrency 8
ffmpeg -y -i out_silent.mp4 -i song.mp3 \
  -filter:a "afade=t=in:st=0:d=1.5,afade=t=out:st=$((MUSIC-4)):d=4,apad" \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest final.mp4
```

## Reference implementation (copy + adapt)

- `projects/karabatan-family-montage/build_edit.py` — curation, beat arc, dynamic step, lyric parser, faithful-translation list, edit_decisions emitter.
- `projects/karabatan-family-montage/render_run.py` — silent Remotion render + ffmpeg music mux with the `apad`/fade fix.
- `lyricvideo/make_srt.py` — word-timestamp → SRT (mono + bilingual).

## Common mistakes

- Calling generation/render tools ad-hoc instead of going through the pipeline + these components (you'll re-hit every gotcha above).
- Rendering 1080p before verifying stills — a collision or face-crop costs a 30-min re-render.
- Using a fixed per-photo step — photos then end before the lyrics, dropping outro lines or forcing card/lyric overlap.
- Forgetting to copy images into `remotion-composer/public/<slug>/` (renders blank/broken — `file://` is blocked).

**Cross-references:** OpenMontage memory `openmontage_cinematic_render_quirks` (the full gotcha log). Layer-3 skills: `remotion`, `ffmpeg`.
