// Shared ground-truth loading for the spike harness.
//
// Every scoring script takes the LRC as an explicit argument now. Phase L1 runs
// the same recipe over 15-30 tracks, so the failure mode that matters is
// scoring track B's ASR against track A's LRC — plausible-looking numbers that
// are entirely wrong. loadGt() cross-checks the ASR's `audio` field against the
// LRC filename and refuses to run on a mismatch.

import { basename } from 'node:path';
import { readFileSync } from 'node:fs';

const TIME_TAG = /^\[(\d+):(\d{2}(?:\.\d+)?)\]/;

export interface GtLine {
  text: string;
  time: number;
}

export function parseLrc(lrcPath: string): GtLine[] {
  const gt: GtLine[] = [];
  for (const raw of readFileSync(lrcPath, 'utf8').split(/\r?\n/)) {
    const m = raw.match(TIME_TAG);
    if (!m) continue; // metadata ([ti:...]) or blank
    gt.push({
      text: raw.slice(m[0].length).trim(),
      time: parseInt(m[1], 10) * 60 + parseFloat(m[2]),
    });
  }
  if (!gt.length) throw new Error(`no [mm:ss] timed lines found in ${lrcPath}`);
  return gt;
}

/** kota-pagoh.16k.wav -> kotapagoh ; kota-pagoh.lrc -> kotapagoh */
function stem(file: string): string {
  return basename(file)
    .replace(/\.[^.]+$/, '')
    .replace(/\.16k$/, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

/**
 * Load GT and assert it belongs to the same track as the ASR dump.
 * `audio` is carried through union.ts, so the check survives the merge step.
 * Pass --force to score a deliberate cross-track pairing.
 */
export function loadGt(lrcPath: string, asrAudio: string | undefined): GtLine[] {
  const gt = parseLrc(lrcPath);
  const force = process.argv.includes('--force');
  if (asrAudio && !force) {
    const a = stem(asrAudio);
    const l = stem(lrcPath);
    if (!a.includes(l) && !l.includes(a)) {
      throw new Error(
        `track mismatch: ASR is of "${basename(asrAudio)}" but ground truth is "${basename(lrcPath)}".\n` +
          `  Scoring one track against another's LRC yields wrong-but-plausible numbers.\n` +
          `  Pass --force if this pairing is intentional.`
      );
    }
  }
  if (!asrAudio) {
    console.warn(`! ASR dump has no "audio" field — cannot verify it matches ${basename(lrcPath)}`);
  }
  return gt;
}
