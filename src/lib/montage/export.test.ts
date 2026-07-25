// src/lib/montage/export.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { EXPORT_MIME_CANDIDATES, pickMimeType, extensionForMimeType } from './export';

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
  it('prefers VP9 WebM when the browser supports everything (desktop unchanged)', () => {
    // The load-bearing ordering assertion: adding MP4 for Safari must NOT change
    // what Chrome/Firefox record, because the desktop pipeline transcodes from VP9.
    stubMediaRecorder([...EXPORT_MIME_CANDIDATES]);
    expect(pickMimeType()).toBe('video/webm;codecs=vp9,opus');
  });

  it('falls back to VP8 then bare WebM as WebM support narrows', () => {
    stubMediaRecorder(['video/webm;codecs=vp8,opus', 'video/webm']);
    expect(pickMimeType()).toBe('video/webm;codecs=vp8,opus');

    stubMediaRecorder(['video/webm']);
    expect(pickMimeType()).toBe('video/webm');
  });

  it('picks MP4 on Safari/iOS, which supports no WebM at all', () => {
    // The actual bug: before MP4 was a candidate this returned a hardcoded
    // 'video/webm' and `new MediaRecorder(...)` threw NotSupportedError.
    stubMediaRecorder(['video/mp4;codecs=h264,aac', 'video/mp4']);
    expect(pickMimeType()).toBe('video/mp4;codecs=h264,aac');
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
