import { nanoid } from 'nanoid';
import type { Word, Line, Section, Song } from '../model/types';

/**
 * Parse a timestamp string [MM:SS.mmm] to seconds.
 */
function parseTimestamp(ts: string): number {
  const match = ts.match(/(\d+):(\d+)\.(\d+)/);
  if (!match) return 0;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  const millis = parseInt(match[3], 10);
  return minutes * 60 + seconds + millis / 1000;
}

/**
 * Parse Suno Chrome extension word-level timestamp format into a Song structure.
 *
 * Format:
 *   [00:11.162] [Title: Semurni Lebaran 3]
 *   [00:11.162] Sembah [00:11.392] berlalu [00:11.776] ramadhan [00:15.083] suci
 *
 * Rules:
 * - [Title: ...] lines extract the song title
 * - Each [MM:SS.mmm] word pair is a timed word
 * - Lines separated by newlines
 * - Sections separated by blank lines
 * - Annotations like "← (...)" are stripped
 * - Timestamps convert to seconds: [01:03.542] = 63.542
 */
export function parseSunoTimestamps(input: string): Song {
  const song: Song = {
    id: nanoid(),
    title: '',
    duration: 0,
    sections: [],
  };

  if (!input.trim()) {
    return song;
  }

  const rawLines = input.split('\n');
  // Group lines into sections separated by blank lines
  const sectionGroups: string[][] = [];
  let currentGroup: string[] = [];

  for (const rawLine of rawLines) {
    // Strip annotation markers: ← (also: ...) or ← (truncated ...)
    const cleaned = rawLine.replace(/\s*←\s*\(.*?\)\s*$/, '').trim();

    if (cleaned === '') {
      // Blank line = section separator
      if (currentGroup.length > 0) {
        sectionGroups.push(currentGroup);
        currentGroup = [];
      }
      continue;
    }

    // Check for title metadata: [00:11.162] [Title: Semurni Lebaran 3]
    const titleMatch = cleaned.match(/\[Title:\s*(.+?)\]/);
    if (titleMatch) {
      song.title = titleMatch[1];
      continue;
    }

    currentGroup.push(cleaned);
  }
  // Push the last group if non-empty
  if (currentGroup.length > 0) {
    sectionGroups.push(currentGroup);
  }

  // Parse each section group
  let lastTimestamp = 0;

  for (const group of sectionGroups) {
    const lines: Line[] = [];

    for (const lineText of group) {
      const words: Word[] = [];
      // Match all [MM:SS.mmm] word pairs
      const wordPattern = /\[(\d+:\d+\.\d+)\]\s+(\S+)/g;
      let wordMatch = wordPattern.exec(lineText);

      while (wordMatch !== null) {
        const startTime = parseTimestamp(wordMatch[1]);
        const text = wordMatch[2];
        words.push({ text, startTime });
        if (startTime > lastTimestamp) {
          lastTimestamp = startTime;
        }
        wordMatch = wordPattern.exec(lineText);
      }

      if (words.length > 0) {
        lines.push({
          id: nanoid(),
          text: words.map((w) => w.text).join(' '),
          startTime: words[0].startTime,
          words,
        });
      }
    }

    if (lines.length > 0) {
      song.sections.push({
        id: nanoid(),
        type: 'verse',
        startTime: lines[0].startTime,
        endTime: 0, // will be computed below
        lines,
      });
    }
  }

  // Compute section endTime:
  // Each section's endTime = next section's startTime, or last timestamp + 5 for the final section
  for (let i = 0; i < song.sections.length; i++) {
    if (i < song.sections.length - 1) {
      song.sections[i].endTime = song.sections[i + 1].startTime;
    } else {
      song.sections[i].endTime = lastTimestamp + 5;
    }
  }

  // Song duration = last timestamp + 5
  song.duration = lastTimestamp + 5;

  return song;
}
