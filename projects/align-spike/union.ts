// Union-merge two or more ASR word dumps into one stream.
//
// This is the Phase 0 winning recipe (RESULTS.md): base+small `*_timestamped`
// q8, concatenated and sorted by start time. No dedup, no voting — the NW
// aligner absorbs the doubled tokens, and each model's collapsed chunks get
// covered by the other's. `exp-combine.ts` tried the smarter per-line vote and
// scored WORSE; keep the dumb union.
//
// Usage: pnpm union <asr1.json> <asr2.json> [...] [-o asr.union.json]

import { readFileSync, writeFileSync } from 'node:fs';
import type { AsrWord } from '../../src/lib/align/align.ts';

interface AsrDump {
  model?: string;
  dtype?: string;
  language?: string;
  audio?: string;
  durationSec?: number;
  words: AsrWord[];
}

const argv = process.argv.slice(2);
const oIdx = argv.indexOf('-o');
const outPath = oIdx >= 0 ? argv[oIdx + 1] : 'asr.union.json';
const inputs = (oIdx >= 0 ? [...argv.slice(0, oIdx), ...argv.slice(oIdx + 2)] : argv).filter(
  (a) => !a.startsWith('-')
);

if (inputs.length < 2) {
  console.error('usage: pnpm union <asr1.json> <asr2.json> [...] [-o asr.union.json]');
  process.exit(1);
}

const dumps = inputs.map((f) => JSON.parse(readFileSync(f, 'utf8')) as AsrDump);

// Guard the same failure mode gt.ts guards: unioning two different songs.
const audios = [...new Set(dumps.map((d) => d.audio).filter(Boolean))];
if (audios.length > 1) {
  console.error(`refusing to union dumps of different audio: ${audios.join(', ')}`);
  process.exit(1);
}

// Array.prototype.sort is stable, so equal starts keep input order — this is
// what produced asr.merged2.json.
const words = dumps
  .flatMap((d) => d.words)
  .sort((a, b) => a.start - b.start);

const out = {
  model: `UNION:${dumps.map((d) => d.model ?? '?').join('+')}`,
  dtype: [...new Set(dumps.map((d) => d.dtype))].join('+'),
  language: dumps[0].language,
  audio: dumps[0].audio, // carried so score/estimator can verify the GT pairing
  durationSec: dumps[0].durationSec,
  loadSec: 0,
  transcribeSec: 0,
  rtf: 0,
  words,
};

writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(
  `${inputs.length} dumps -> ${words.length} words (${dumps.map((d) => d.words.length).join('+')}) -> ${outPath}`
);
