// src/lib/storage/project-store.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  saveProject,
  loadProject,
  clearProject,
  localStorageBackend,
  type KvBackend,
} from './project-store';
import { DEFAULT_SETTINGS, type MontageProject } from '$lib/montage/model';

function memoryBackend(): KvBackend {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const sample: MontageProject = {
  version: 1,
  photoOrder: ['p1'],
  photos: [{ id: 'p1', name: 'a.jpg', width: 800, height: 600, assetKey: 'asset:p1' }],
  lyricsText: '[00:01.000] hi',
  styleId: 'warm-memory',
  settings: DEFAULT_SETTINGS,
  updatedAt: 123,
};

describe('project-store', () => {
  it('returns null when nothing saved', () => {
    expect(loadProject(memoryBackend())).toBeNull();
  });

  it('round-trips a saved project', () => {
    const b = memoryBackend();
    saveProject(sample, b);
    expect(loadProject(b)).toEqual(sample);
  });

  it('returns null on a version mismatch', () => {
    const b = memoryBackend();
    b.setItem('montage:lastProject', JSON.stringify({ ...sample, version: 99 }));
    expect(loadProject(b)).toBeNull();
  });

  it('returns null on corrupt JSON', () => {
    const b = memoryBackend();
    b.setItem('montage:lastProject', '{not json');
    expect(loadProject(b)).toBeNull();
  });

  it('round-trips the optional videoTitle field', () => {
    const b = memoryBackend();
    const withTitle: MontageProject = { ...sample, videoTitle: 'Our Wedding' };
    saveProject(withTitle, b);
    expect(loadProject(b)?.videoTitle).toBe('Our Wedding');
  });

  it('still loads a project saved before videoTitle existed', () => {
    // videoTitle is optional; a pre-existing v1 blob lacks it entirely and
    // must remain valid (the store back-fills it to '' on restore).
    const b = memoryBackend();
    saveProject(sample, b); // sample has no videoTitle
    const loaded = loadProject(b);
    expect(loaded).not.toBeNull();
    expect(loaded?.videoTitle).toBeUndefined();
  });

  it('returns null on a v1 blob missing required fields', () => {
    const b = memoryBackend();
    // version passes the gate, but `photos`/`settings`/etc. are absent —
    // must not load as a structurally-broken project.
    b.setItem('montage:lastProject', JSON.stringify({ version: 1, photoOrder: ['p1'] }));
    expect(loadProject(b)).toBeNull();
  });

  it('clears a saved project', () => {
    const b = memoryBackend();
    saveProject(sample, b);
    clearProject(b);
    expect(loadProject(b)).toBeNull();
  });
});

describe('localStorageBackend resilience', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not throw when localStorage access raises SecurityError', () => {
    const boom = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    vi.stubGlobal('localStorage', {
      getItem: boom,
      setItem: boom,
      removeItem: boom,
    });

    expect(() => localStorageBackend.setItem('k', 'v')).not.toThrow();
    expect(() => localStorageBackend.removeItem('k')).not.toThrow();
    expect(localStorageBackend.getItem('k')).toBeNull();
  });
});
