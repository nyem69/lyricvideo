// src/lib/parser/lyrics.ts
//
// Multi-format lyric parsing. The app's native input is Suno's word-level
// timestamp format (see ./suno). This module adds LRC and SRT support and a
// `parseLyrics` dispatcher that auto-detects which of the three a paste is, so
// the same Lyrics box accepts all of them and produces the one `Song` shape the
// rest of the pipeline (deriveBands -> the renderer) already understands.

import { nanoid } from 'nanoid';
import type { Song, Section, SectionType, Line, Word } from '../model/types';
import { parseSunoTimestamps } from './suno';

export type LyricFormat = 'suno' | 'lrc' | 'srt';

// A timestamp tag: [mm:ss], [mm:ss.xx] (LRC centiseconds) or [mm:ss.mmm] (Suno).
const TS_TAG = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
// An SRT cue line: HH:MM:SS,mmm --> HH:MM:SS,mmm (also tolerates '.' as the
// fractional separator, which some exporters emit).
const SRT_RANGE =
  /(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})/;
// LRC ID metadata tags ([ti:], [ar:], [offset:], ...). Used both to read the
// fields and as a strong format signal.
const LRC_META = /^\[(ti|ar|al|by|offset|length|re|ve|au):([^\]]*)\]$/i;

/** A fractional-second string ('5', '55', '542') as a number of seconds. LRC
 *  uses centiseconds and Suno/SRT milliseconds; padding to 3 digits treats the
 *  value as a decimal fraction either way ('55' -> .550s, '542' -> .542s). */
function frac(s: string | undefined): number {
  if (!s) return 0;
  return Number(`0.${s}`);
}

/**
 * Detect which lyric format a paste is, so callers can stay format-agnostic.
 * - SRT  — has a `HH:MM:SS,mmm --> ...` cue range.
 * - LRC  — has an ID metadata tag, OR its timestamped lines almost all carry a
 *          single leading `[mm:ss]` (line-level), unlike Suno's many-per-line.
 * - Suno — the default / fallback (word-level `[ts] word [ts] word`).
 */
export function detectLyricFormat(input: string): LyricFormat {
  const text = input.trim();
  if (!text) return 'suno';
  if (SRT_RANGE.test(text)) return 'srt';
  if (LRC_META.test(text) || input.split('\n').some((l) => LRC_META.test(l.trim()))) return 'lrc';

  let stamped = 0;
  let multi = 0;
  for (const line of text.split('\n')) {
    const n = (line.match(TS_TAG) ?? []).length;
    if (n >= 1) {
      stamped++;
      if (n >= 2) multi++;
    }
  }
  if (stamped === 0) return 'suno';
  // Word-level Suno lines routinely carry 2+ tags; a line-level LRC never does.
  return multi / stamped >= 0.2 ? 'suno' : 'lrc';
}

/** Parse using whichever format `input` looks like. The single entry point the
 *  stores call so a paste in any supported format Just Works. */
export function parseLyrics(input: string): Song {
  switch (detectLyricFormat(input)) {
    case 'srt':
      return parseSrt(input);
    case 'lrc':
      return parseLrc(input);
    default:
      return parseSunoTimestamps(input);
  }
}

// A pre-finalised line: timing + text, words attached.
interface RawLine {
  startTime: number;
  text: string;
  words: Word[];
}
interface RawSection {
  label?: string;
  lines: RawLine[];
}

/** Split a plain lyric line into words all anchored at the line's start time
 *  (line-level formats carry no per-word timing). Always returns >=1 word so
 *  deriveBands' last-word lookup is safe. */
function lineWords(text: string, start: number): Word[] {
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [{ text, startTime: start }];
  return parts.map((w) => ({ text: w, startTime: start }));
}

/** Assemble sorted RawSections into a Song, computing section/​song timing the
 *  same way the Suno parser does (section end = next section start; the last
 *  section and the song run `lastTimestamp + 5`). */
function finalizeSong(title: string, artist: string, sections: RawSection[]): Song {
  const secs = sections.filter((s) => s.lines.length > 0);
  for (const s of secs) s.lines.sort((a, b) => a.startTime - b.startTime);
  secs.sort((a, b) => a.lines[0].startTime - b.lines[0].startTime);

  let lastTimestamp = 0;
  const outSections: Section[] = secs.map((s) => {
    const lines: Line[] = s.lines.map((l) => {
      const lastWord = l.words.length ? l.words[l.words.length - 1].startTime : l.startTime;
      lastTimestamp = Math.max(lastTimestamp, l.startTime, lastWord);
      return { id: nanoid(), text: l.text, startTime: l.startTime, words: l.words };
    });
    return {
      id: nanoid(),
      type: 'verse' as SectionType,
      label: s.label,
      startTime: lines[0].startTime,
      endTime: 0,
      lines,
    };
  });
  for (let i = 0; i < outSections.length; i++) {
    outSections[i].endTime =
      i < outSections.length - 1 ? outSections[i + 1].startTime : lastTimestamp + 5;
  }

  return {
    id: nanoid(),
    title,
    artist: artist || undefined,
    duration: outSections.length ? lastTimestamp + 5 : 0,
    sections: outSections,
  };
}

/**
 * Parse LRC (line-level karaoke). Handles:
 * - ID metadata: [ti:], [ar:], [offset:±ms] (offset shifts every line).
 * - Repeated time tags on one line ([t1][t2]text) -> the text at each time.
 * - Section-label lines we emit ourselves ([ts][CHORUS]) -> a new section.
 * - Enhanced inline word tags (<mm:ss.xx>) are stripped to plain text.
 */
export function parseLrc(input: string): Song {
  let title = '';
  let artist = '';
  let offset = 0; // seconds, subtracted from every tag time

  const sections: RawSection[] = [];
  let current: RawSection | null = null;
  const ensureSection = (): RawSection => {
    if (!current) {
      current = { lines: [] };
      sections.push(current);
    }
    return current;
  };

  for (const raw of input.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const meta = line.match(LRC_META);
    if (meta) {
      const key = meta[1].toLowerCase();
      const val = meta[2].trim();
      if (key === 'ti') title = val;
      else if (key === 'ar') artist = val;
      else if (key === 'offset') {
        const ms = Number.parseInt(val, 10);
        if (!Number.isNaN(ms)) offset = ms / 1000;
      }
      continue;
    }

    // Collect the run of leading time tags ([t1][t2]...). Stop at the first
    // non-tag (or non-adjacent tag) so mid-text timestamps aren't consumed.
    TS_TAG.lastIndex = 0;
    const stamps: number[] = [];
    let cursor = 0;
    let m: RegExpExecArray | null;
    while ((m = TS_TAG.exec(line)) !== null && m.index === cursor) {
      stamps.push(Number(m[1]) * 60 + Number(m[2]) + frac(m[3]));
      cursor = TS_TAG.lastIndex;
    }
    if (stamps.length === 0) continue;

    const body = line.slice(cursor).trim();

    // A bracketed-only body is one of our [ts][SECTION] markers: start a section.
    const labelMatch = body.match(/^\[([^\]]+)\]$/);
    if (labelMatch) {
      current = { label: labelMatch[1].trim(), lines: [] };
      sections.push(current);
      continue;
    }

    // Drop enhanced word tags (<mm:ss.xx>) -> plain text.
    const text = body
      .replace(/<\d{1,2}:\d{2}(?:[.:]\d{1,3})?>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) continue;

    for (const stamp of stamps) {
      const start = Math.max(0, stamp - offset);
      ensureSection().lines.push({ startTime: start, text, words: lineWords(text, start) });
    }
  }

  return finalizeSong(title, artist, sections);
}

/**
 * Parse SRT subtitles. Each cue (index line, `start --> end`, one or more text
 * lines) becomes a Line; inline markup (<i>, {\an8}) is stripped. Cue end times
 * are not carried through — the renderer derives band lengths from onsets and
 * hangover, the same model used for Suno and LRC.
 */
export function parseSrt(input: string): Song {
  const blocks = input.replace(/\r/g, '').trim().split(/\n{2,}/);
  const lines: RawLine[] = [];

  for (const block of blocks) {
    const rows = block
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean);
    const rangeIdx = rows.findIndex((r) => SRT_RANGE.test(r));
    if (rangeIdx < 0) continue;

    const tc = rows[rangeIdx].match(SRT_RANGE)!;
    const start = Number(tc[1]) * 3600 + Number(tc[2]) * 60 + Number(tc[3]) + frac(tc[4]);

    const text = rows
      .slice(rangeIdx + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '') // <i>, <b>, <font ...>
      .replace(/\{[^}]*\}/g, '') // {\an8} SSA overrides
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) continue;

    lines.push({ startTime: start, text, words: lineWords(text, start) });
  }

  return finalizeSong('', '', lines.length ? [{ lines }] : []);
}
