import { describe, it, expect } from 'vitest';
import { parseLyrics, parseLrc, parseSrt, detectLyricFormat } from './lyrics';

const SUNO = `[Title: Kota Pagoh]

[00:01.755] Segamat
[00:03.692] Pagoh [00:04.481] datang`;

const LRC = `[ti:Kota Pagoh]
[ar:MM]
[00:01.75][STORY RAP]
[00:01.75]Segamat
[00:03.69]Pagoh datang
[00:11.41]Berdiri megah di tanah selatan`;

const SRT = `1
00:00:01,755 --> 00:00:03,663
Segamat

2
00:00:03,692 --> 00:00:11,398
Pagoh datang

3
00:00:11,413 --> 00:00:16,277
Berdiri megah di tanah selatan`;

describe('detectLyricFormat', () => {
  it('detects SRT by the cue range', () => {
    expect(detectLyricFormat(SRT)).toBe('srt');
  });
  it('detects LRC by ID metadata', () => {
    expect(detectLyricFormat(LRC)).toBe('lrc');
  });
  it('detects LRC by single-leading-timestamp lines (no metadata)', () => {
    expect(detectLyricFormat('[00:01.75]hello world\n[00:03.69]second line')).toBe('lrc');
  });
  it('detects Suno by multi-timestamp lines', () => {
    expect(detectLyricFormat(SUNO)).toBe('suno');
  });
  it('falls back to Suno for empty input', () => {
    expect(detectLyricFormat('')).toBe('suno');
  });
  it('reports untimed text as plain, not Suno', () => {
    // Was 'suno', which meant the Suno parser found no tags and returned zero
    // sections — the paste vanished with no warning.
    expect(detectLyricFormat('just some text')).toBe('plain');
    expect(detectLyricFormat('line one\nline two\n\nline three')).toBe('plain');
  });
});

describe('parseLrc', () => {
  it('reads title/artist metadata', () => {
    const s = parseLrc(LRC);
    expect(s.title).toBe('Kota Pagoh');
    expect(s.artist).toBe('MM');
  });
  it('parses line-level times and full line text', () => {
    const s = parseLrc(LRC);
    const lines = s.sections.flatMap((sec) => sec.lines);
    const berdiri = lines.find((l) => l.text.startsWith('Berdiri'));
    expect(berdiri?.text).toBe('Berdiri megah di tanah selatan');
    expect(berdiri?.startTime).toBeCloseTo(11.41, 2);
    // every line keeps at least one word so deriveBands' hangover lookup is safe
    expect(berdiri?.words.length).toBe(5);
  });
  it('turns a [ts][SECTION] marker into a section, not a lyric', () => {
    const s = parseLrc(LRC);
    expect(s.sections[0].label).toBe('STORY RAP');
    const allText = s.sections.flatMap((x) => x.lines).map((l) => l.text);
    expect(allText).not.toContain('[STORY RAP]');
    expect(allText).toContain('Segamat');
  });
  it('parses centiseconds (.55 -> .550s)', () => {
    const s = parseLrc('[00:02.55]word');
    expect(s.sections[0].lines[0].startTime).toBeCloseTo(2.55, 3);
  });
  it('applies a negative-friendly offset tag', () => {
    const s = parseLrc('[offset:500]\n[00:10.00]late');
    expect(s.sections[0].lines[0].startTime).toBeCloseTo(9.5, 3);
  });
  it('expands repeated time tags on one line', () => {
    const s = parseLrc('[00:01.00][00:05.00]chorus');
    const times = s.sections.flatMap((x) => x.lines).map((l) => l.startTime);
    expect(times).toEqual([1, 5]);
  });
  it('strips enhanced word tags to plain text', () => {
    const s = parseLrc('[00:01.00]<00:01.00>hello <00:01.50>world');
    expect(s.sections[0].lines[0].text).toBe('hello world');
  });
});

describe('parseSrt', () => {
  it('parses cues into lines with correct start times', () => {
    const s = parseSrt(SRT);
    const lines = s.sections.flatMap((sec) => sec.lines);
    expect(lines).toHaveLength(3);
    expect(lines[0].text).toBe('Segamat');
    expect(lines[0].startTime).toBeCloseTo(1.755, 3);
    expect(lines[2].text).toBe('Berdiri megah di tanah selatan');
  });
  it('converts HH:MM:SS,mmm to seconds', () => {
    const s = parseSrt('1\n01:02:03,500 --> 01:02:05,000\nx');
    expect(s.sections[0].lines[0].startTime).toBeCloseTo(3723.5, 3);
  });
  it('joins multi-line cue text and strips markup', () => {
    const s = parseSrt('1\n00:00:01,000 --> 00:00:02,000\n<i>line one</i>\n{\\an8}line two');
    expect(s.sections[0].lines[0].text).toBe('line one line two');
  });
});

describe('parseLyrics dispatcher', () => {
  it('routes each format to a non-empty Song', () => {
    for (const input of [SUNO, LRC, SRT]) {
      const s = parseLyrics(input);
      expect(s.sections.flatMap((x) => x.lines).length).toBeGreaterThan(0);
    }
  });
  it('the three formats of the same intro agree on the first line + time', () => {
    const first = (t: string) => {
      const l = parseLyrics(t).sections.flatMap((x) => x.lines)[0];
      return { text: l.text, start: Math.round(l.startTime * 10) / 10 };
    };
    expect(first(SUNO)).toEqual({ text: 'Segamat', start: 1.8 });
    expect(first(LRC)).toEqual({ text: 'Segamat', start: 1.8 });
    expect(first(SRT)).toEqual({ text: 'Segamat', start: 1.8 });
  });
});
