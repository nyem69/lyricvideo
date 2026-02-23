import type { Line, Section, StylePreset } from '$lib/model/types';

export interface Renderer {
  readonly type: 'css' | 'canvas' | 'webgl';
  mount(container: HTMLElement): void;
  setPreset(preset: StylePreset): void;
  showLine(line: Line): void;
  clearLines(animated?: boolean): void;
  update(currentTime: number, section: Section | null): void;
  resize(width: number, height: number): void;
  destroy(): void;
}
