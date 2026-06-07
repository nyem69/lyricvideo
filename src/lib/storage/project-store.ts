// src/lib/storage/project-store.ts
import type { MontageProject } from '$lib/montage/model';
import type { VisualizerProject } from '$lib/visualizer/model';

export interface KvBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY = 'montage:lastProject';

// Validate the structurally-required fields before trusting a parsed blob.
// The version gate alone rules out other eras, not shape drift within v1 —
// e.g. a v1 blob saved before a field existed would otherwise load with
// `undefined` required fields and crash the first caller that reads them.
function isMontageProject(value: unknown): value is MontageProject {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    Array.isArray(v.photoOrder) &&
    Array.isArray(v.photos) &&
    typeof v.lyricsText === 'string' &&
    typeof v.styleId === 'string' &&
    v.settings != null &&
    typeof v.updatedAt === 'number'
  );
}

export function saveProject(project: MontageProject, backend: KvBackend): void {
  backend.setItem(KEY, JSON.stringify(project));
}

export function loadProject(backend: KvBackend): MontageProject | null {
  const raw = backend.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isMontageProject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearProject(backend: KvBackend): void {
  backend.removeItem(KEY);
}

const VIZ_KEY = 'visualizer:lastProject';

function isVisualizerProject(value: unknown): value is VisualizerProject {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    typeof v.lyricsText === 'string' &&
    typeof v.vizStyleId === 'string' &&
    typeof v.formatId === 'string' &&
    typeof v.songDuration === 'number' &&
    v.settings != null &&
    typeof v.updatedAt === 'number'
  );
}

export function saveVisualizerProject(project: VisualizerProject, backend: KvBackend): void {
  backend.setItem(VIZ_KEY, JSON.stringify(project));
}

export function loadVisualizerProject(backend: KvBackend): VisualizerProject | null {
  const raw = backend.getItem(VIZ_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isVisualizerProject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearVisualizerProject(backend: KvBackend): void {
  backend.removeItem(VIZ_KEY);
}

// localStorage may be absent (SSR) OR present-but-throwing (sandboxed iframes,
// blocked site-data, some private modes throw SecurityError on access). Guard
// for both so persistence degrades to a silent no-op instead of crashing.
export const localStorageBackend: KvBackend = {
  getItem: (k) => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null;
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(k, v);
    } catch {
      // storage blocked or quota exceeded — silently no-op
    }
  },
  removeItem: (k) => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
    } catch {
      // storage blocked — silently no-op
    }
  },
};
