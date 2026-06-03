// src/lib/montage/bands.test.ts
import { describe, it, expect } from 'vitest';
import { parseSunoTimestamps } from '$lib/parser/suno';
import { deriveBands } from './bands';

describe('deriveBands', () => {
  it('returns [] for null song', () => {
    expect(deriveBands(null)).toEqual([]);
  });

  it('derives one band per line with primary text', () => {
    const song = parseSunoTimestamps(
      '[00:10.000] hello [00:11.000] world\n[00:20.000] second [00:21.000] line'
    );
    const bands = deriveBands(song);
    expect(bands).toHaveLength(2);
    expect(bands[0].primary).toBe('hello world');
    expect(bands[0].start).toBe(10);
  });

  it('clamps end to hand off 0.25s before the next line onset', () => {
    const song = parseSunoTimestamps(
      '[00:10.000] a [00:11.000] b\n[00:20.000] c [00:21.000] d'
    );
    const bands = deriveBands(song);
    expect(bands[0].end).toBeCloseTo(12.8, 3);
  });

  it('uses nextOnset-0.25 when lines are close together', () => {
    const song = parseSunoTimestamps(
      '[00:10.000] a [00:10.200] b\n[00:11.000] c'
    );
    const bands = deriveBands(song);
    expect(bands[0].end).toBeCloseTo(10.75, 3);
  });

  it('enforces a 0.4s minimum visible duration on dense lines', () => {
    const song = parseSunoTimestamps('[00:10.000] a\n[00:10.100] b');
    const bands = deriveBands(song);
    expect(bands[0].end).toBeCloseTo(10.4, 3);
    expect(bands[0].end).toBeGreaterThan(bands[0].start);
  });

  it('ends the last line at lastWord + 1.8', () => {
    const song = parseSunoTimestamps('[00:10.000] a [00:12.000] b');
    const bands = deriveBands(song);
    expect(bands[0].end).toBeCloseTo(13.8, 3);
  });
});
