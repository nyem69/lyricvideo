// src/lib/montage/export.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  EXPORT_MIME_CANDIDATES,
  pickMimeType,
  extensionForMimeType,
  videoBitrateFor,
  VIDEO_BITS_PER_PIXEL_SECOND,
  AUDIO_BITS_PER_SECOND,
} from './export';

/** Stand in for the browser's MediaRecorder, supporting only `supported`. */
function stubMediaRecorder(supported: string[]) {
  vi.stubGlobal('MediaRecorder', {
    isTypeSupported: (t: string) => supported.includes(t),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pickMimeType', () => {
  it('prefers H.264 MP4 when the browser supports everything', () => {
    // The load-bearing ordering assertion. iOS CAN record WebM, so preference —
    // not capability — has to put MP4 first: WebM is unusable on an iPhone
    // (Photos won't import it, no on-device transcode), and on desktop H.264 is
    // the transcode target anyway, so recording it directly skips a generation.
    stubMediaRecorder([...EXPORT_MIME_CANDIDATES]);
    expect(pickMimeType()).toBe('video/mp4;codecs=h264,aac');
  });

  it('falls back to bare MP4 before any WebM', () => {
    stubMediaRecorder(['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']);
    expect(pickMimeType()).toBe('video/mp4');
  });

  it('falls back to WebM only when MP4 is unavailable', () => {
    stubMediaRecorder(['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']);
    expect(pickMimeType()).toBe('video/webm;codecs=vp9,opus');

    stubMediaRecorder(['video/webm;codecs=vp8,opus', 'video/webm']);
    expect(pickMimeType()).toBe('video/webm;codecs=vp8,opus');

    stubMediaRecorder(['video/webm']);
    expect(pickMimeType()).toBe('video/webm');
  });

  it('picks bare MP4 when only that is supported', () => {
    stubMediaRecorder(['video/mp4']);
    expect(pickMimeType()).toBe('video/mp4');
  });

  it('returns "" when nothing matches, so the browser chooses its own default', () => {
    stubMediaRecorder([]);
    expect(pickMimeType()).toBe('');
  });

  it('returns "" when MediaRecorder is absent (SSR / test env)', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    expect(pickMimeType()).toBe('');
  });
});

describe('extensionForMimeType', () => {
  it('maps MP4 types to .mp4', () => {
    expect(extensionForMimeType('video/mp4')).toBe('mp4');
    expect(extensionForMimeType('video/mp4;codecs=h264,aac')).toBe('mp4');
    expect(extensionForMimeType('VIDEO/MP4')).toBe('mp4');
  });

  it('maps WebM types to .webm', () => {
    expect(extensionForMimeType('video/webm')).toBe('webm');
    expect(extensionForMimeType('video/webm;codecs=vp9,opus')).toBe('webm');
  });

  it('defaults unknown or empty types to .webm', () => {
    expect(extensionForMimeType('')).toBe('webm');
    expect(extensionForMimeType('application/octet-stream')).toBe('webm');
  });

  it('does not match mp4 appearing outside the type prefix', () => {
    // A codec string mentioning mp4a must not flip a WebM recording to .mp4.
    expect(extensionForMimeType('video/webm;codecs=mp4a.40.2')).toBe('webm');
  });
});

describe('videoBitrateFor', () => {
  it('targets ~4 Mbps at 1080p', () => {
    // ~150 MB for a 5-minute song: comfortably above the ~1.4 Mbps desktop was
    // producing, and far below the 9.7 Mbps an uncapped iPhone export hit.
    expect(videoBitrateFor(1920, 1080)).toBe(4_000_000);
  });

  it('is orientation-agnostic — portrait and landscape 1080p match', () => {
    expect(videoBitrateFor(1080, 1920)).toBe(videoBitrateFor(1920, 1080));
  });

  it('scales linearly with pixel count', () => {
    // A square 1080x1080 has ~55.6% of 1080p's pixels.
    expect(videoBitrateFor(1080, 1080)).toBe(
      Math.round(1080 * 1080 * VIDEO_BITS_PER_PIXEL_SECOND)
    );
    expect(videoBitrateFor(1080, 1080)).toBeLessThan(videoBitrateFor(1920, 1080));
  });

  it('clamps absurdly small canvases up to a floor', () => {
    expect(videoBitrateFor(16, 16)).toBe(500_000);
    expect(videoBitrateFor(0, 0)).toBe(500_000);
  });

  it('clamps absurdly large canvases down to a ceiling', () => {
    expect(videoBitrateFor(7680, 4320)).toBe(12_000_000);
  });

  it('pins a sane audio rate', () => {
    expect(AUDIO_BITS_PER_SECOND).toBe(128_000);
  });
});
