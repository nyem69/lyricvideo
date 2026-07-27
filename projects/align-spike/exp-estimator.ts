// Experiment: better line-start estimator on top of the union-merged ASR.
//   (a) implied-start median: every matched lyric token k on a line implies
//       lineStart = tokenTime - k * perTokenDur; take the median of implications.
//   (b) outlier fence (as before).
//   (c) back-fill snap: an unobserved line whose NEXT line is observed gets
//       t = nextT - ownTokens * perTokenDur when linear interpolation would put
//       it further from its successor than that.
//
// Usage: pnpm estimate <asr.json> <lrc>
//   e.g. pnpm estimate asr.union.json ../kotapagoh-v2/kota-pagoh.lrc

import { readFileSync } from 'node:fs';
import {
  tokenize,
  similarity,
  MATCH_THRESHOLD,
  type AsrWord,
} from '../../src/lib/align/align.ts';
import { loadGt } from './gt.ts';

const FENCE_S = 5;

const [asrPath, lrcPath] = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (!asrPath || !lrcPath) {
  console.error('usage: pnpm estimate <asr.json> <lrc>');
  process.exit(1);
}

const asr = JSON.parse(readFileSync(asrPath, 'utf8')) as { words: AsrWord[]; audio?: string };
const gt = loadGt(lrcPath, asr.audio);
const lines = gt.map((g) => g.text);

// ---- flatten lyric + ASR tokens (mirrors align.ts internals)
interface FlatToken { tok: string; lineIdx: number; posInLine: number }
const lyric: FlatToken[] = [];
const perLineTotal = lines.map((line, lineIdx) => {
  const toks = tokenize(line);
  toks.forEach((tok, posInLine) => lyric.push({ tok, lineIdx, posInLine }));
  return toks.length;
});
interface TimedToken { tok: string; time: number }
const asrToks: TimedToken[] = [];
for (const w of asr.words) {
  const toks = tokenize(w.text);
  if (!toks.length) continue;
  const span = w.end !== undefined && w.end > w.start ? w.end - w.start : 0;
  const step = toks.length > 1 ? span / toks.length : 0;
  toks.forEach((tok, i) => asrToks.push({ tok, time: w.start + step * i }));
}

// ---- NW (same scoring as align.ts)
const GAP = -1;
const L = lyric.length;
const A = asrToks.length;
const width = A + 1;
const dir = new Uint8Array((L + 1) * width);
let prev = new Float32Array(width);
let curr = new Float32Array(width);
for (let j = 1; j <= A; j++) { prev[j] = j * GAP; dir[j] = 3; }
for (let i = 1; i <= L; i++) {
  curr[0] = i * GAP;
  dir[i * width] = 2;
  for (let j = 1; j <= A; j++) {
    const sim = similarity(lyric[i - 1].tok, asrToks[j - 1].tok);
    const diag = prev[j - 1] + (sim >= MATCH_THRESHOLD ? 1 + sim : 2 * sim - 1);
    const up = prev[j] + GAP;
    const left = curr[j - 1] + GAP;
    let best = diag; let d = 1;
    if (up > best) { best = up; d = 2; }
    if (left > best) { best = left; d = 3; }
    curr[j] = best;
    dir[i * width + j] = d;
  }
  const swap = prev; prev = curr; curr = swap;
}
const hits: { lineIdx: number; posInLine: number; time: number }[] = [];
let i = L; let j = A;
while (i > 0 && j > 0) {
  const d = dir[i * width + j];
  if (d === 1) {
    if (similarity(lyric[i - 1].tok, asrToks[j - 1].tok) >= MATCH_THRESHOLD) {
      hits.push({ lineIdx: lyric[i - 1].lineIdx, posInLine: lyric[i - 1].posInLine, time: asrToks[j - 1].time });
    }
    i--; j--;
  } else if (d === 2) i--;
  else j--;
}

// ---- per-token pace measured from the data itself: median dt between
// consecutive matched tokens on the same line
const paces: number[] = [];
const byLine = new Map<number, { pos: number; time: number }[]>();
for (const h of hits) {
  if (!byLine.has(h.lineIdx)) byLine.set(h.lineIdx, []);
  byLine.get(h.lineIdx)!.push({ pos: h.posInLine, time: h.time });
}
for (const toks of byLine.values()) {
  toks.sort((a, b) => a.pos - b.pos);
  for (let k = 1; k < toks.length; k++) {
    const dp = toks[k].pos - toks[k - 1].pos;
    const dt = toks[k].time - toks[k - 1].time;
    if (dp > 0 && dt > 0) paces.push(dt / dp);
  }
}
paces.sort((a, b) => a - b);
const perTokenDur = paces.length ? paces[Math.floor(paces.length / 2)] : 0.35;
console.log(`perTokenDur (median observed pace) = ${perTokenDur.toFixed(3)}s over ${paces.length} samples`);

// ---- (a) implied-start median per line
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const est: (number | null)[] = lines.map((_, li) => {
  const toks = byLine.get(li);
  if (!toks || !toks.length) return null;
  return median(toks.map((t) => t.time - t.pos * perTokenDur));
});

// ---- (b) fence
const fenced = [...est];
for (let k = 0; k < fenced.length; k++) {
  if (fenced[k] === null) continue;
  let b = k - 1; while (b >= 0 && fenced[b] === null) b--;
  let a = k + 1; while (a < fenced.length && fenced[a] === null) a++;
  if (b < 0 || a >= fenced.length) continue;
  const t0 = fenced[b] as number; const t1 = fenced[a] as number;
  const expT = t0 + ((t1 - t0) * (k - b)) / (a - b);
  if (Math.abs((fenced[k] as number) - expT) > FENCE_S) fenced[k] = null;
}

// ---- (c) interpolate with back-fill snap, then monotonic
const anchors = fenced.map((t, k) => (t === null ? -1 : k)).filter((k) => k >= 0);
const times: (number | null)[] = [...fenced];
for (let k = times.length - 1; k >= 0; k--) {
  if (times[k] !== null) continue;
  const before = anchors.filter((x) => x < k).pop();
  const after = anchors.find((x) => x > k);
  if (before !== undefined && after !== undefined) {
    const t0 = fenced[before] as number; const t1 = fenced[after] as number;
    const linear = t0 + ((t1 - t0) * (k - before)) / (after - before);
    // back-fill: successor time minus the estimated duration of the lines between
    let backfill = times[k + 1] !== null && k + 1 <= after ? (times[k + 1] as number) - Math.max(1, perLineTotal[k]) * perTokenDur : linear;
    times[k] = Math.max(linear, backfill); // prefer the later (snap toward successor)
  } else if (before !== undefined) times[k] = fenced[before] as number;
  else if (after !== undefined) times[k] = fenced[after] as number;
  else times[k] = k;
}
let floor = 0;
for (let k = 0; k < times.length; k++) {
  const t = Math.max(floor, Math.max(0, times[k] as number));
  times[k] = t; floor = t;
}

// ---- score
const rows = lines.map((text, idx) => ({
  i: idx,
  text,
  gt: gt[idx].time,
  pred: times[idx] as number,
  err: Math.abs((times[idx] as number) - gt[idx].time),
  obs: fenced[idx] !== null,
  singable: tokenize(text).length > 0,
}));
const pct = (s: number[], p: number) => s[Math.max(0, Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1))];
for (const [label, set] of [['ALL', rows], ['singable', rows.filter((r) => r.singable)]] as const) {
  const errs = set.map((r) => r.err).sort((a, b) => a - b);
  console.log(
    `${label}: n=${set.length} mean=${(errs.reduce((s, e) => s + e, 0) / errs.length).toFixed(3)} ` +
      `p50=${pct(errs, 50).toFixed(3)} p90=${pct(errs, 90).toFixed(3)} max=${errs[errs.length - 1].toFixed(3)} ` +
      `interp=${set.filter((r) => !r.obs).length}`
  );
}
const sing = rows.filter((r) => r.singable).map((r) => r.err).sort((a, b) => a - b);
// Compare what we display: errors accumulate float noise (a true 0.4 arrives as
// 0.400000000000005684), which read as FAIL on a track sitting exactly on the gate.
const ms = (x: number) => Math.round(x * 1000) / 1000;
console.log(
  `GATE: median<=0.4 -> ${ms(pct(sing, 50)) <= 0.4 ? 'PASS' : 'FAIL'} (${pct(sing, 50).toFixed(3)}), ` +
    `p90<=1.0 -> ${ms(pct(sing, 90)) <= 1.0 ? 'PASS' : 'FAIL'} (${pct(sing, 90).toFixed(3)})`
);
console.log('worst 8:');
for (const r of [...rows].sort((a, b) => b.err - a.err).slice(0, 8)) {
  console.log(
    `  #${String(r.i).padStart(2)} err=${r.err.toFixed(2)} gt=${r.gt.toFixed(2)} pred=${r.pred.toFixed(2)} ` +
      `${r.obs ? 'obs' : 'int'} ${r.singable ? '' : '[stage] '}${r.text.slice(0, 50)}`
  );
}
