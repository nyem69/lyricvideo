// src/lib/storage/visualizer-store.test.ts
import { describe, it, expect } from 'vitest';
import {
  saveVisualizerProject,
  loadVisualizerProject,
  clearVisualizerProject,
  type KvBackend,
} from './project-store';
import type { VisualizerProject } from '$lib/visualizer/model';
import { DEFAULT_SETTINGS } from '$lib/montage/model';

function memBackend(): KvBackend {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

const sample: VisualizerProject = {
  version: 1,
  lyricsText: '[00:01.00] hi',
  videoTitle: 'Song',
  vizStyleId: 'radial',
  formatId: 'tiktok',
  songDuration: 42,
  settings: { ...DEFAULT_SETTINGS },
  updatedAt: 123,
};

describe('visualizer persistence', () => {
  it('round-trips a project', () => {
    const b = memBackend();
    saveVisualizerProject(sample, b);
    expect(loadVisualizerProject(b)).toEqual(sample);
  });
  it('returns null for an empty backend', () => {
    expect(loadVisualizerProject(memBackend())).toBeNull();
  });
  it('rejects a shape-invalid blob', () => {
    const b = memBackend();
    b.setItem('visualizer:lastProject', JSON.stringify({ version: 1, lyricsText: 1 }));
    expect(loadVisualizerProject(b)).toBeNull();
  });
  it('uses a key distinct from montage (no collision)', () => {
    const b = memBackend();
    saveVisualizerProject(sample, b);
    expect(b.getItem('montage:lastProject')).toBeNull();
    clearVisualizerProject(b);
    expect(loadVisualizerProject(b)).toBeNull();
  });
});
