// src/lib/parser/plain.test.ts
import { describe, it, expect } from 'vitest';
import type { Song } from '../model/types';
import {
  parseLyrics,
  parsePlain,
  plainEntries,
  toLrc,
  formatLrcTime,
  parseLrc,
  PLAIN_FALLBACK_SECONDS_PER_LINE,
} from './lyrics';

const PLAIN = `Hujan turun di kampung
Lampu kuning menyala

Aku pulang malam ini
Bunga putih di laman`;

const LABELLED = `[Verse]
Hujan turun di kampung
Lampu kuning menyala

[Chorus]
Aku pulang malam ini`;

const allLines = (song: Song) => song.sections.flatMap((s) => s.lines);

describe('plainEntries', () => {
  it('keeps lines in order and drops blanks', () => {
    expect(plainEntries(PLAIN).map((e) => e.text)).toEqual([
      'Hujan turun di kampung',
      'Lampu kuning menyala',
      'Aku pulang malam ini',
      'Bunga putih di laman',
    ]);
  });

  it('marks [SECTION] lines as labels', () => {
    expect(plainEntries(LABELLED).filter((e) => e.kind === 'label').map((e) => e.text)).toEqual([
      'Verse',
      'Chorus',
    ]);
  });
});

describe('parsePlain', () => {
  it('no longer loses the paste — the old path returned zero sections', () => {
    const song = parseLyrics(PLAIN, { durationSec: 120 });
    expect(song.sections.length).toBeGreaterThan(0);
    expect(allLines(song)).toHaveLength(4);
  });

  it('spreads lines evenly across the song duration', () => {
    const song = parsePlain(PLAIN, 120);
    expect(allLines(song).map((l) => l.startTime)).toEqual([0, 30, 60, 90]);
  });

  it('adopts the real audio duration rather than lastTimestamp + 5', () => {
    expect(parsePlain(PLAIN, 120).duration).toBe(120);
  });

  it('paces by a per-line fallback when there is no audio yet', () => {
    const song = parsePlain(PLAIN, 0);
    const starts = allLines(song).map((l) => l.startTime);
    expect(starts).toEqual([0, 3, 6, 9]);
    expect(PLAIN_FALLBACK_SECONDS_PER_LINE).toBe(3);
  });

  it('opens a new section at each [SECTION] label', () => {
    const song = parsePlain(LABELLED, 90);
    expect(song.sections).toHaveLength(2);
    expect(song.sections.map((s) => s.label)).toEqual(['Verse', 'Chorus']);
    expect(song.sections[0].lines).toHaveLength(2);
    expect(song.sections[1].lines).toHaveLength(1);
  });

  it('gives every line at least one word so band derivation is safe', () => {
    for (const line of allLines(parsePlain(PLAIN, 60))) {
      expect(line.words.length).toBeGreaterThan(0);
    }
  });

  it('returns an empty song for blank or label-only input', () => {
    expect(parsePlain('', 60).sections).toEqual([]);
    expect(parsePlain('\n\n  \n', 60).sections).toEqual([]);
    expect(parsePlain('[Verse]\n[Chorus]', 60).sections).toEqual([]);
  });

  it('keeps timestamped formats on their own parsers', () => {
    const lrc = '[00:01.75]hello world\n[00:03.69]second line';
    expect(allLines(parseLyrics(lrc)).map((l) => l.startTime)).toEqual([1.75, 3.69]);
  });
});

describe('formatLrcTime', () => {
  it('renders mm:ss.xx with padding', () => {
    expect(formatLrcTime(0)).toBe('[00:00.00]');
    expect(formatLrcTime(5.3)).toBe('[00:05.30]');
    expect(formatLrcTime(75.125)).toBe('[01:15.13]');
  });

  it('clamps negatives to zero', () => {
    expect(formatLrcTime(-4)).toBe('[00:00.00]');
  });
});

describe('toLrc round trip', () => {
  it('produces LRC the app can read straight back', () => {
    const lrc = toLrc([
      { text: 'Hujan turun di kampung', startTime: 2.5 },
      { text: 'Lampu kuning menyala', startTime: 7.25 },
    ]);
    expect(lrc).toBe('[00:02.50]Hujan turun di kampung\n[00:07.25]Lampu kuning menyala');

    const song = parseLyrics(lrc);
    expect(allLines(song).map((l) => l.startTime)).toEqual([2.5, 7.25]);
  });

  it('emits [ts][SECTION] markers that parseLrc reads as sections', () => {
    const lrc = toLrc([
      { text: 'Verse', startTime: 1, label: true },
      { text: 'first line', startTime: 1 },
      { text: 'Chorus', startTime: 9 },
    ]);
    expect(lrc.split('\n')[0]).toBe('[00:01.00][Verse]');
    expect(parseLrc(lrc).sections[0].label).toBe('Verse');
  });

  it('a synced round trip is no longer detected as plain', () => {
    const lrc = toLrc(plainEntries(PLAIN).map((e, i) => ({ text: e.text, startTime: i * 4 })));
    const song = parseLyrics(lrc);
    expect(allLines(song).map((l) => l.startTime)).toEqual([0, 4, 8, 12]);
  });
});
