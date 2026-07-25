// src/lib/media/accept.test.ts
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { AUDIO_ACCEPT, AUDIO_ACCEPT_EXTENSIONS } from './accept';

/** Every markup file carrying an audio file input. */
const AUDIO_INPUT_SOURCES = [
  'src/lib/components/Player/Controls.svelte',
  'src/routes/visualizer/+page.svelte',
  'src/routes/montage/+page.svelte',
  'src/routes/dev/visualizer/[style]/+page.svelte',
];

describe('AUDIO_ACCEPT', () => {
  it('keeps the audio/* wildcard for desktop browsers', () => {
    expect(AUDIO_ACCEPT.split(',')).toContain('audio/*');
  });

  it('names .mp3 explicitly — the wildcard alone is not enough on iOS', () => {
    // Regression guard for the Suno-download bug: iOS reported the file as
    // "Kind: MP3 audio" with a parsed duration and STILL dimmed it under a bare
    // audio/* accept, because WebKit's picker filters by UTI and does not expand
    // the wildcard. Dropping .mp3 here makes iPhone uploads silently impossible.
    expect(AUDIO_ACCEPT_EXTENSIONS).toContain('mp3');
  });

  it('covers the formats Suno hands out', () => {
    for (const ext of ['mp3', 'm4a', 'wav', 'mp4']) {
      expect(AUDIO_ACCEPT_EXTENSIONS).toContain(ext);
    }
  });

  it('lists every extension with a leading dot and no stray whitespace', () => {
    for (const token of AUDIO_ACCEPT.split(',')) {
      expect(token).toBe(token.trim());
      expect(token.length).toBeGreaterThan(0);
      if (!token.includes('/')) expect(token.startsWith('.')).toBe(true);
    }
  });

  it('has no duplicate entries', () => {
    const tokens = AUDIO_ACCEPT.split(',');
    expect(new Set(tokens).size).toBe(tokens.length);
  });
});

describe('audio inputs in markup', () => {
  it('never hardcodes the bare audio/* wildcard', () => {
    // Keep in lockstep with AUDIO_ACCEPT — a literal accept="audio/*" anywhere
    // is the exact state that broke iPhone uploads.
    for (const path of AUDIO_INPUT_SOURCES) {
      const src = readFileSync(path, 'utf8');
      expect(src, `${path} hardcodes accept="audio/*"`).not.toContain('accept="audio/*"');
    }
  });

  it('binds every audio input to the shared constant', () => {
    for (const path of AUDIO_INPUT_SOURCES) {
      const src = readFileSync(path, 'utf8');
      expect(src, `${path} is missing accept={AUDIO_ACCEPT}`).toContain('accept={AUDIO_ACCEPT}');
      expect(src, `${path} is missing the AUDIO_ACCEPT import`).toContain(
        "from '$lib/media/accept'"
      );
    }
  });
});
