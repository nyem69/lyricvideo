// Phase 0 spike — feed Whisper ASR words through alignLyrics and score the
// predicted line starts against the LRC ground truth.
//
// Usage: pnpm score <asr.json> <lrc>
//   e.g. pnpm score asr.base.q8.json ../kotapagoh-v2/kota-pagoh.lrc
//
// The lyric LINES given to the aligner are the LRC's text lines (what a user
// would paste as plain lyrics); the LRC timestamps are the truth we score against.

import { readFileSync } from 'node:fs';
import { alignLyrics, tokenize, type AsrWord } from '../../src/lib/align/align.ts';
import { loadGt } from './gt.ts';

const [asrPath, lrcPath] = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (!asrPath || !lrcPath) {
  console.error('usage: pnpm score <asr.json> <lrc>');
  process.exit(1);
}

// ---- ASR
const asr = JSON.parse(readFileSync(asrPath, 'utf8')) as {
  model: string;
  dtype: string;
  audio?: string;
  durationSec: number;
  loadSec: number;
  transcribeSec: number;
  rtf: number;
  words: AsrWord[];
};

// ---- ground truth
const gt = loadGt(lrcPath, asr.audio);

// ---- align
const lines = gt.map((g) => g.text);
const aligned = alignLyrics(lines, asr.words);

// ---- score
interface Row {
  i: number;
  text: string;
  gt: number;
  pred: number;
  err: number;
  matched: number;
  total: number;
  confidence: number;
  singable: boolean; // lines whose text tokenizes to nothing are stage directions
}
const rows: Row[] = aligned.map((a, i) => ({
  i,
  text: a.text,
  gt: gt[i].time,
  pred: a.startTime,
  err: Math.abs(a.startTime - gt[i].time),
  matched: a.matched,
  total: a.total,
  confidence: a.confidence,
  singable: tokenize(gt[i].text).length > 0,
}));

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}
function stats(set: Row[], label: string): void {
  const errs = set.map((r) => r.err).sort((a, b) => a - b);
  const mean = errs.reduce((s, e) => s + e, 0) / (errs.length || 1);
  const interp = set.filter((r) => r.confidence === 0).length;
  console.log(
    `${label}: n=${set.length}  mean=${mean.toFixed(3)}s  p50=${pct(errs, 50).toFixed(3)}s  ` +
      `p90=${pct(errs, 90).toFixed(3)}s  max=${errs[errs.length - 1]?.toFixed(3)}s  interpolated=${interp}`
  );
}

console.log(`model=${asr.model} dtype=${asr.dtype}  load=${asr.loadSec.toFixed(1)}s  ` +
  `transcribe=${asr.transcribeSec.toFixed(1)}s (rtf ${asr.rtf.toFixed(2)}x)  asrWords=${asr.words.length}`);
stats(rows, 'ALL lines      ');
stats(rows.filter((r) => r.singable), 'singable lines ');

// gate check (owner's Phase 0 gate, per-track view)
const singable = rows.filter((r) => r.singable);
const errs = singable.map((r) => r.err).sort((a, b) => a - b);
const p50 = pct(errs, 50);
const p90 = pct(errs, 90);
// Compare what we display — see the same note in exp-estimator.ts.
const ms = (x: number) => Math.round(x * 1000) / 1000;
console.log(
  `GATE (singable): median<=0.4s -> ${ms(p50) <= 0.4 ? 'PASS' : 'FAIL'} (${p50.toFixed(3)}s), ` +
    `p90<=1.0s -> ${ms(p90) <= 1.0 ? 'PASS' : 'FAIL'} (${p90.toFixed(3)}s)`
);

// worst offenders
console.log('\nworst 10 lines:');
for (const r of [...rows].sort((a, b) => b.err - a.err).slice(0, 10)) {
  console.log(
    `  #${String(r.i).padStart(2)} err=${r.err.toFixed(2)}s gt=${r.gt.toFixed(2)} pred=${r.pred.toFixed(2)} ` +
      `conf=${r.confidence.toFixed(2)} ${r.singable ? '' : '[stage] '}${r.text.slice(0, 60)}`
  );
}
