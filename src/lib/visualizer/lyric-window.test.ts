// src/lib/visualizer/lyric-window.test.ts
import { describe, it, expect } from 'vitest';
import { lyricWindow, splitWords } from './lyric-window';
import type { LyricBand } from '$lib/montage/model';

const band = (id: string, start: number, end: number, primary: string): LyricBand => ({
  id,
  start,
  end,
  primary,
});
const bands = [
  band('a', 0, 2, 'one two three'),
  band('b', 2, 4, 'four five'),
  band('c', 5, 7, 'six seven eight nine'),
  band('d', 7, 9, 'ten'),
];

describe('lyricWindow', () => {
  it('starts at the playing line and marks its words active', () => {
    const w = lyricWindow(bands, 1, 4, 24);
    expect(w.words).toEqual(['one', 'two', 'three', 'four', 'five']);
    expect([w.activeFrom, w.activeTo]).toEqual([0, 3]);
  });

  it('keeps collecting lines until minWords is reached', () => {
    const w = lyricWindow(bands, 1, 8, 24);
    expect(w.words).toEqual('one two three four five six seven eight nine'.split(' '));
  });

  it('caps at maxWords', () => {
    const w = lyricWindow(bands, 1, 8, 4);
    expect(w.words).toEqual(['one', 'two', 'three', 'four']);
    expect(w.activeTo).toBe(3);
  });

  it('between lines: shows the upcoming line with nothing active', () => {
    const w = lyricWindow(bands, 4.5, 3, 24);
    expect(w.words.slice(0, 4)).toEqual(['six', 'seven', 'eight', 'nine']);
    expect(w.activeTo).toBe(0);
  });

  it('after the last line: keeps the tail, nothing active', () => {
    const w = lyricWindow(bands, 20, 3, 24);
    expect(w.words).toEqual(['ten']);
    expect(w.activeTo).toBe(0);
  });

  it('is order-independent and handles no bands', () => {
    const shuffled = [bands[2], bands[0], bands[3], bands[1]];
    expect(lyricWindow(shuffled, 1, 4, 24)).toEqual(lyricWindow(bands, 1, 4, 24));
    expect(lyricWindow([], 1, 4, 24)).toEqual({ words: [], activeFrom: 0, activeTo: 0 });
  });

  it('active range never exceeds the capped word list', () => {
    const w = lyricWindow([band('x', 0, 2, 'a b c d e f')], 1, 15, 4);
    expect(w.words).toHaveLength(4);
    expect(w.activeTo).toBe(4);
  });

  it('splitWords ignores blank runs', () => {
    expect(splitWords('  a   b\tc ')).toEqual(['a', 'b', 'c']);
  });
});
