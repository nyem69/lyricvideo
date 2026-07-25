// src/lib/align/align.ts
//
// Align known lyrics to ASR word timings.
//
// The problem this solves: speech recognition tells you WHEN words were sung but
// mishears WHAT was sung — badly, on stylised or sung Malay. The user already has
// the correct words. So we don't want the transcript; we want its clock, mapped
// onto the real lyrics.
//
// That is a sequence-alignment problem, not a search: run Needleman-Wunsch over
// (lyric tokens) x (ASR tokens) with a fuzzy similarity score, then read each
// line's start time off its first matched token. Lines that match nothing are
// interpolated from their neighbours, and the whole result is forced monotonic —
// a lyric line can never start before the line above it.

/** One ASR word with its timing. `end` lets a multi-word chunk spread its tokens. */
export interface AsrWord {
  text: string;
  start: number;
  end?: number;
}

export interface AlignedLine {
  text: string;
  startTime: number;
  /** Lyric tokens on this line that found an ASR match. */
  matched: number;
  total: number;
  /** matched/total — 0 means the time was interpolated, not observed. */
  confidence: number;
}

const COMBINING = /[̀-ͯ]/g;
const NON_ALNUM = /[^a-z0-9]/g;

/** Fold a token to a comparison key: lowercase, de-accented, punctuation-free,
 *  with runs of a repeated letter collapsed. The collapse is what makes stylised
 *  singing match ('Segamattt' -> 'segamat', 'datangg' -> 'datang'); it is applied
 *  to BOTH sides, so collapsing a genuine double letter costs nothing. */
export function normalizeToken(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(COMBINING, '')
    .toLowerCase()
    .replace(NON_ALNUM, '')
    .replace(/(.)\1+/g, '$1');
}

/** Split text into normalized tokens, dropping anything that folds to nothing
 *  (punctuation runs, emoji).
 *
 *  Bracketed spans are removed FIRST, not merely normalized away: `[STORY RAP]`
 *  is stage direction, never sung. Left in, its tokens consume time slots when a
 *  chunk spreads across its span — measured at 1.28s of error on the opening line
 *  of the Kota Pagoh ground-truth set, the single worst case before this. */
export function tokenize(text: string): string[] {
  return text
    .replace(/\[[^\]]*\]/g, ' ')
    .split(/\s+/)
    .map(normalizeToken)
    .filter((t) => t.length > 0);
}

/** Levenshtein distance, iterative with a single rolling row. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/** Similarity in [0,1]. 1 is identical; ASR near-misses ('kampung'/'kampong')
 *  land high, unrelated words near 0. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return Math.max(0, 1 - levenshtein(a, b) / longest);
}

/** Similarity at or above this counts as a match rather than a coincidence. */
export const MATCH_THRESHOLD = 0.7;

const GAP = -1;

interface FlatToken {
  tok: string;
  lineIdx: number;
}
interface TimedToken {
  tok: string;
  time: number;
}

/** Explode ASR words into single tokens. A chunk carrying several words (Suno
 *  returns these) spreads its tokens evenly across [start, end] so a 7-second
 *  chunk doesn't stamp every word inside it with the same instant. */
function timedTokens(words: AsrWord[]): TimedToken[] {
  const out: TimedToken[] = [];
  for (const w of words) {
    const toks = tokenize(w.text);
    if (toks.length === 0) continue;
    const start = w.start;
    const span = w.end !== undefined && w.end > w.start ? w.end - w.start : 0;
    const step = toks.length > 1 ? span / toks.length : 0;
    toks.forEach((tok, i) => out.push({ tok, time: start + step * i }));
  }
  return out;
}

/**
 * Map `lines` onto `words`, returning a start time per line.
 *
 * Returns evenly-spread fallbacks (all confidence 0) when there is nothing to
 * align against, so a caller always gets one entry per line.
 */
export function alignLyrics(lines: string[], words: AsrWord[]): AlignedLine[] {
  const lyric: FlatToken[] = [];
  const perLineTotal = lines.map((line, lineIdx) => {
    const toks = tokenize(line);
    for (const tok of toks) lyric.push({ tok, lineIdx });
    return toks.length;
  });

  const asr = timedTokens(words);
  const blank = (): AlignedLine[] =>
    lines.map((text, i) => ({
      text,
      startTime: i,
      matched: 0,
      total: perLineTotal[i],
      confidence: 0,
    }));
  if (lyric.length === 0 || asr.length === 0) return blank();

  const L = lyric.length;
  const A = asr.length;

  // Needleman-Wunsch. score[j] is the running row; dir records the traceback
  // (1 diagonal, 2 up = consume a lyric token, 3 left = consume an ASR token).
  const width = A + 1;
  const dir = new Uint8Array((L + 1) * width);
  let prev = new Float32Array(width);
  let curr = new Float32Array(width);

  for (let j = 1; j <= A; j++) {
    prev[j] = j * GAP;
    dir[j] = 3;
  }
  for (let i = 1; i <= L; i++) {
    curr[0] = i * GAP;
    dir[i * width] = 2;
    for (let j = 1; j <= A; j++) {
      const sim = similarity(lyric[i - 1].tok, asr[j - 1].tok);
      // Identical -> +2, threshold -> ~+0.4, unrelated -> -1: matching beats
      // gapping only when the tokens genuinely resemble each other.
      const diag = prev[j - 1] + (sim >= MATCH_THRESHOLD ? 1 + sim : 2 * sim - 1);
      const up = prev[j] + GAP;
      const left = curr[j - 1] + GAP;
      let best = diag;
      let d = 1;
      if (up > best) {
        best = up;
        d = 2;
      }
      if (left > best) {
        best = left;
        d = 3;
      }
      curr[j] = best;
      dir[i * width + j] = d;
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }

  // Traceback: for each lyric token, the earliest ASR time it matched.
  const hitTime = new Array<number | null>(L).fill(null);
  let i = L;
  let j = A;
  while (i > 0 && j > 0) {
    const d = dir[i * width + j];
    if (d === 1) {
      if (similarity(lyric[i - 1].tok, asr[j - 1].tok) >= MATCH_THRESHOLD) {
        hitTime[i - 1] = asr[j - 1].time;
      }
      i--;
      j--;
    } else if (d === 2) {
      i--;
    } else {
      j--;
    }
  }
  while (i > 0) i--;

  // Per line: first observed token time wins — a line starts when its first
  // recognised word is sung, not at the average of the line.
  const matched = new Array(lines.length).fill(0);
  const firstTime = new Array<number | null>(lines.length).fill(null);
  for (let k = 0; k < L; k++) {
    const t = hitTime[k];
    if (t === null) continue;
    const li = lyric[k].lineIdx;
    matched[li]++;
    if (firstTime[li] === null || t < (firstTime[li] as number)) firstTime[li] = t;
  }

  // Interpolate lines that matched nothing, between the nearest anchored
  // neighbours; extrapolate at the ends off the nearest anchor.
  const times = [...firstTime];
  const anchors = times.map((t, k) => (t === null ? -1 : k)).filter((k) => k >= 0);
  if (anchors.length === 0) return blank();

  for (let k = 0; k < times.length; k++) {
    if (times[k] !== null) continue;
    const before = anchors.filter((a) => a < k).pop();
    const after = anchors.find((a) => a > k);
    if (before !== undefined && after !== undefined) {
      const t0 = times[before] as number;
      const t1 = times[after] as number;
      times[k] = t0 + ((t1 - t0) * (k - before)) / (after - before);
    } else if (before !== undefined) {
      times[k] = times[before] as number;
    } else if (after !== undefined) {
      times[k] = times[after] as number;
    }
  }

  // Monotonic: a later line can never start earlier than an earlier one.
  let floor = 0;
  const out: AlignedLine[] = [];
  for (let k = 0; k < lines.length; k++) {
    const t = Math.max(floor, Math.max(0, times[k] as number));
    floor = t;
    out.push({
      text: lines[k],
      startTime: Number(t.toFixed(3)),
      matched: matched[k],
      total: perLineTotal[k],
      confidence: perLineTotal[k] ? matched[k] / perLineTotal[k] : 0,
    });
  }
  return out;
}
