// Experiment: align each ASR run SEPARATELY, then combine per-line estimates.
//   - both models observed a line and agree (<= AGREE_S apart) -> average
//   - both observed but disagree -> drop (treat as unobserved)
//   - one observed -> take it
//   - outlier fence: an observed time deviating > FENCE_S from the interpolation
//     of its nearest observed neighbours is dropped
//   - unobserved lines interpolated, then monotonic clamp
//
// Usage: pnpm tsx exp-combine.ts <lrc> <asr1.json> [asr2.json ...]

import { readFileSync } from 'node:fs';
import { alignLyrics, tokenize, type AsrWord } from '../../src/lib/align/align.ts';
import { loadGt } from './gt.ts';

const AGREE_S = 1.5;
const FENCE_S = 5;

const [lrcPath, ...files] = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (!lrcPath || files.length < 1) {
  console.error('usage: pnpm tsx exp-combine.ts <lrc> <asr1.json> [asr2.json ...]');
  process.exit(1);
}

// 1. align per run
const dumps = files.map((f) => JSON.parse(readFileSync(f, 'utf8')) as { words: AsrWord[]; audio?: string });
const gt = loadGt(lrcPath, dumps[0].audio);
const lines = gt.map((g) => g.text);
const runs = dumps.map((d) => alignLyrics(lines, d.words));

// 2. combine per line
const est: (number | null)[] = lines.map((_, i) => {
  const obs = runs.map((r) => r[i]).filter((a) => a.confidence > 0).map((a) => a.startTime);
  if (obs.length === 0) return null;
  if (obs.length === 1) return obs[0];
  const lo = Math.min(...obs);
  const hi = Math.max(...obs);
  if (hi - lo <= AGREE_S) return obs.reduce((s, t) => s + t, 0) / obs.length;
  return null; // models disagree -> distrust both
});

// 3. outlier fence vs interpolation of nearest observed neighbours
const fenced = [...est];
for (let k = 0; k < fenced.length; k++) {
  if (fenced[k] === null) continue;
  let b = k - 1;
  while (b >= 0 && fenced[b] === null) b--;
  let a = k + 1;
  while (a < fenced.length && fenced[a] === null) a++;
  if (b < 0 || a >= fenced.length) continue;
  const t0 = fenced[b] as number;
  const t1 = fenced[a] as number;
  const expT = t0 + ((t1 - t0) * (k - b)) / (a - b);
  if (Math.abs((fenced[k] as number) - expT) > FENCE_S) fenced[k] = null;
}

// 4. interpolate + monotonic
const anchors = fenced.map((t, k) => (t === null ? -1 : k)).filter((k) => k >= 0);
const times = [...fenced];
for (let k = 0; k < times.length; k++) {
  if (times[k] !== null) continue;
  const before = anchors.filter((x) => x < k).pop();
  const after = anchors.find((x) => x > k);
  if (before !== undefined && after !== undefined) {
    const t0 = times[before] as number;
    const t1 = times[after] as number;
    times[k] = t0 + ((t1 - t0) * (k - before)) / (after - before);
  } else if (before !== undefined) times[k] = times[before] as number;
  else if (after !== undefined) times[k] = times[after] as number;
  else times[k] = k;
}
let floor = 0;
for (let k = 0; k < times.length; k++) {
  const t = Math.max(floor, times[k] as number);
  times[k] = t;
  floor = t;
}

// 5. score
const rows = lines.map((text, i) => ({
  i,
  text,
  gt: gt[i].time,
  pred: times[i] as number,
  err: Math.abs((times[i] as number) - gt[i].time),
  observed: fenced[i] !== null,
  singable: tokenize(text).length > 0,
}));
function pct(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}
for (const [label, set] of [
  ['ALL lines      ', rows],
  ['singable lines ', rows.filter((r) => r.singable)],
] as const) {
  const errs = set.map((r) => r.err).sort((a, b) => a - b);
  const mean = errs.reduce((s, e) => s + e, 0) / (errs.length || 1);
  console.log(
    `${label}: n=${set.length}  mean=${mean.toFixed(3)}s  p50=${pct(errs, 50).toFixed(3)}s  ` +
      `p90=${pct(errs, 90).toFixed(3)}s  max=${errs[errs.length - 1].toFixed(3)}s  ` +
      `interpolated=${set.filter((r) => !r.observed).length}`
  );
}
const sing = rows.filter((r) => r.singable).map((r) => r.err).sort((a, b) => a - b);
const p50 = pct(sing, 50);
const p90 = pct(sing, 90);
console.log(
  `GATE (singable): median<=0.4s -> ${p50 <= 0.4 ? 'PASS' : 'FAIL'} (${p50.toFixed(3)}s), ` +
    `p90<=1.0s -> ${p90 <= 1.0 ? 'PASS' : 'FAIL'} (${p90.toFixed(3)}s)`
);
console.log('\nworst 10:');
for (const r of [...rows].sort((a, b) => b.err - a.err).slice(0, 10)) {
  console.log(
    `  #${String(r.i).padStart(2)} err=${r.err.toFixed(2)}s gt=${r.gt.toFixed(2)} pred=${r.pred.toFixed(2)} ` +
      `${r.observed ? 'obs' : 'int'} ${r.singable ? '' : '[stage] '}${r.text.slice(0, 60)}`
  );
}
