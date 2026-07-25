// src/lib/align/align.test.ts
import { describe, it, expect } from 'vitest';
import {
  alignLyrics,
  normalizeToken,
  tokenize,
  levenshtein,
  similarity,
  MATCH_THRESHOLD,
  type AsrWord,
} from './align';

/** One ASR word per second, matching the given text. */
const perSecond = (text: string, from = 0): AsrWord[] =>
  text.split(/\s+/).map((w, i) => ({ text: w, start: from + i, end: from + i + 0.5 }));

describe('normalizeToken', () => {
  it('folds case and punctuation', () => {
    expect(normalizeToken('Pagoh!!!')).toBe('pagoh');
    expect(normalizeToken('...')).toBe('');
  });

  it('collapses repeated letters so stylised singing matches', () => {
    // Applied to BOTH sides, so collapsing a genuine double costs nothing.
    expect(normalizeToken('Segamattt......')).toBe('segamat');
    expect(normalizeToken('datangg!!!')).toBe('datang');
    expect(normalizeToken('Segamat')).toBe(normalizeToken('Segamattt'));
  });

  it('strips diacritics', () => {
    expect(normalizeToken('café')).toBe('cafe');
  });
});

describe('tokenize', () => {
  it('drops bracketed stage directions entirely', () => {
    // Left in, these consume time slots when a chunk spreads across its span.
    expect(tokenize('[STORY RAP] Segamat datang')).toEqual(['segamat', 'datang']);
    expect(tokenize('[Verse]')).toEqual([]);
  });

  it('drops tokens that fold to nothing', () => {
    expect(tokenize('hello ... !!! world')).toEqual(['helo', 'world']);
  });
});

describe('levenshtein / similarity', () => {
  it('measures edit distance', () => {
    expect(levenshtein('kampung', 'kampung')).toBe(0);
    expect(levenshtein('kampung', 'kampong')).toBe(1);
    expect(levenshtein('', 'abc')).toBe(3);
  });

  it('scores near-misses high and unrelated words low', () => {
    expect(similarity('pagoh', 'pagoh')).toBe(1);
    expect(similarity('kampung', 'kampong')).toBeGreaterThan(MATCH_THRESHOLD);
    expect(similarity('pagoh', 'terengganu')).toBeLessThan(0.4);
  });
});

describe('alignLyrics', () => {
  it('recovers line times from a clean transcript', () => {
    const lines = ['hujan turun', 'lampu menyala'];
    const asr = perSecond('hujan turun lampu menyala');
    const out = alignLyrics(lines, asr);
    expect(out.map((l) => l.startTime)).toEqual([0, 2]);
    expect(out.every((l) => l.confidence === 1)).toBe(true);
  });

  it('still anchors when the ASR mishears words', () => {
    const lines = ['hujan turun di kampung', 'lampu kuning menyala'];
    // 'kampong' and 'kunning' are near-misses; 'hujam' is a one-char slip.
    const asr = perSecond('hujam turun di kampong lampu kunning menyala');
    const out = alignLyrics(lines, asr);
    expect(out[0].startTime).toBe(0);
    expect(out[1].startTime).toBe(4);
    expect(out[1].matched).toBeGreaterThan(0);
  });

  it('survives inserted words the lyrics do not contain', () => {
    const lines = ['hujan turun', 'lampu menyala'];
    const asr = perSecond('uh hujan turun yeah lampu menyala');
    const out = alignLyrics(lines, asr);
    expect(out[0].startTime).toBe(1);
    expect(out[1].startTime).toBe(4);
  });

  it('interpolates a line that matches nothing and flags it', () => {
    const lines = ['first line here', 'totally absent words', 'last line here'];
    const asr = [
      ...perSecond('first line here', 0),
      ...perSecond('last line here', 10),
    ];
    const out = alignLyrics(lines, asr);
    expect(out[0].confidence).toBe(1);
    expect(out[2].confidence).toBe(1);
    // Unmatched: time sits between its neighbours, confidence 0 marks it as a
    // guess so the UI can send the user to fix it.
    expect(out[1].confidence).toBe(0);
    expect(out[1].startTime).toBeGreaterThan(out[0].startTime);
    expect(out[1].startTime).toBeLessThan(out[2].startTime);
  });

  it('never lets a later line start before an earlier one', () => {
    const lines = ['alpha beta', 'gamma delta', 'epsilon zeta'];
    // Deliberately out-of-order ASR times.
    const asr: AsrWord[] = [
      { text: 'alpha', start: 5 },
      { text: 'beta', start: 6 },
      { text: 'gamma', start: 1 },
      { text: 'delta', start: 2 },
      { text: 'epsilon', start: 9 },
      { text: 'zeta', start: 10 },
    ];
    const out = alignLyrics(lines, asr);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].startTime).toBeGreaterThanOrEqual(out[i - 1].startTime);
    }
  });

  it('spreads a multi-word chunk across its span', () => {
    // Suno returns chunks like this; stamping every word with the chunk start
    // would bunch a 6-second phrase onto one instant.
    const asr: AsrWord[] = [{ text: 'satu dua tiga', start: 0, end: 6 }];
    const out = alignLyrics(['satu', 'dua', 'tiga'], asr);
    expect(out[0].startTime).toBe(0);
    expect(out[1].startTime).toBe(2);
    expect(out[2].startTime).toBe(4);
  });

  it('reports confidence as matched/total per line', () => {
    const out = alignLyrics(['satu dua tiga empat'], perSecond('satu dua zzzz yyyy'));
    expect(out[0].total).toBe(4);
    expect(out[0].matched).toBe(2);
    expect(out[0].confidence).toBeCloseTo(0.5, 5);
  });

  it('returns one entry per line even with no usable input', () => {
    expect(alignLyrics([], perSecond('a b c'))).toEqual([]);
    const noAsr = alignLyrics(['one', 'two'], []);
    expect(noAsr).toHaveLength(2);
    expect(noAsr.every((l) => l.confidence === 0)).toBe(true);
    const noText = alignLyrics(['...', '!!!'], perSecond('a b'));
    expect(noText).toHaveLength(2);
  });

  it('never emits a negative time', () => {
    const out = alignLyrics(['satu dua'], [{ text: 'satu', start: -3 }, { text: 'dua', start: 1 }]);
    expect(out[0].startTime).toBeGreaterThanOrEqual(0);
  });
});
