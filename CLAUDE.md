# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A self-contained lyrics video player for "Selamat Hari Raya Aidilfitri" — a single `index.html` file with embedded CSS and JavaScript. No build tools, no dependencies, no package manager.

## Running

Open `index.html` directly in a browser. No server required.

## Architecture

Everything lives in `index.html`:

- **CSS (lines 7–327):** Styles, animations, and 6 visual themes (`style-elegant`, `style-script`, `style-amiri`, `style-modern`, `style-warm`, `style-finale`) with 5 background scenes (`bg-scene-1` through `bg-scene-5`).
- **HTML (lines 329–352):** Container with SVG crescent moon, lyrics display area, progress bar, and playback controls.
- **JavaScript (lines 354–724):** Timing engine that drives the 4-minute (240s) video. The `sections` array (line 358) defines all song structure — each section has `start`/`end` times, a style theme, background scene, and lyric lines with `at` timestamps.

## Key Concepts

- **Section-based timing:** The `sections` array is the single source of truth for the entire video timeline. Each section maps a time range to a visual style and set of lyric lines.
- **Animation loop:** `requestAnimationFrame`-based update loop (line 631) advances `currentTime`, triggers section transitions, and shows lyrics at scheduled times.
- **Visual transitions:** Section changes trigger background gradient swaps, overlay fades, and lyric clearing via `clearDisplay()`.
- **Controls:** Play/Pause (Space), Restart (R key), or use the on-screen buttons.

## Language

Lyrics and UI text are in Malay (Bahasa Melayu). The HTML `lang` attribute is `ms`.
