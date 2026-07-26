# Phase 0 spike — in-browser Whisper alignment (Kota Pagoh, track 1 of N)

Date: 2026-07-26. Gate (owner, per corpus of 15-30 tracks): singable-line timing
error median <= 0.4s, p90 <= 1.0s; processing <= 1.5x song duration desktop,
<= 3x mobile; completion >= 95% desktop / >= 85% mobile.

Track: Kota Pagoh (Malay rap, heavy mix, stylised vocals — deliberately the
hardest genre bucket). 249.7s, 61 singable lines / 70 total. Ground truth =
`../kotapagoh-v2/kota-pagoh.lrc` (from Suno word timings, p_align 0.99 — not
human-verified; treat +-0.3s as GT noise floor).

## Accuracy (Node, onnxruntime CPU — accuracy transfers to browser, speed does not)

| recipe | median | p90 | max | interp |
|---|---|---|---|---|
| base q8 alone | 0.92 | 16.2 | 26.4 | 24/61 |
| small q8 alone | 0.58 | 9.1 | 28.2 | 7/61 |
| large-v3-turbo q4 alone | 0.91 | 13.1 | 26.8 | 10/61 |
| union base+small | 0.45 | 1.92 | 18.9 | 2/61 |
| union + estimator upgrades | **0.40** | **1.26** | 5.4 | 4/61 |

Estimator upgrades (prototyped in `exp-estimator.ts`, NOT yet in `align.ts` —
hold until 2-3 more GT tracks exist, they were tuned on this one song):
1. **implied-start median** — line start = median over matched tokens of
   `(tokenTime - posInLine * perTokenDur)`, with perTokenDur = median observed
   intra-line pace. Replaces first-matched-token-wins, which biases early
   (~-0.27s) under a union merge (min of N noisy estimates).
2. **outlier fence** — drop observed line times deviating > 5s from the
   interpolation of nearest observed neighbours (kills stray single-token
   matches, e.g. "Bukit" grabbing a word 19s away).
3. **back-fill snap** — unobserved line before an observed successor gets
   `t_next - ownTokens * perTokenDur` when later than linear interpolation
   (linear interp across instrumental breaks is the residual big-error source).

## Findings

- **Word timestamps require the `onnx-community/whisper-*_timestamped` exports**
  (cross-attentions). The plain exports throw in `_extract_token_timestamps`.
- **No single model survives full-mix music.** Each collapses on 1-2 different
  30s chunks: base hallucinated a "ya ya ya" loop through the entire fast-rap
  verse (138-150s); small collapsed 0-30s to one boundary stamp; turbo lost
  40-70s. Chunk-level decode failure, not model capacity.
- **Two-model union (base+small) is the unlock** — they fail in different
  places and the NW aligner absorbs the doubled/mishears. 3-model union == 2-model
  union (turbo adds nothing at 4.6x the compute).
- **Residual errors** cluster at spoken/shouted sections (intro, outro
  "Batu/Pahattt") and lines under instrumental breaks.

## Cost (Node, M-series, 10 cores)

| model | dtype | load | transcribe | rtf |
|---|---|---|---|---|
| base_timestamped | q8 | 3.0s | 36.8s | 0.15x |
| small_timestamped | q8 | 26.9s | 28.0s | 0.11x |
| large-v3-turbo_timestamped | q4 | 31.9s | 171.3s | 0.69x |

Union recipe download ~= 340MB (both q8), combined native rtf ~= 0.26x.

## Browser numbers (bench.html, Chrome 150, M-series 10-core, COOP/COEP on, SAB multithread WASM)

| model | device | dtype | load (warm) | transcribe | rtf | words | JS heap |
|---|---|---|---|---|---|---|---|
| base | wasm | q8 | 0.8s | 34.1s | **0.14x** | 546 | 267MB |
| small | wasm | q8 | 1.3s | 56.2s | **0.23x** | 225 | 548MB |
| base | webgpu | fp16 | 11.7s | 25.7s | 0.10x | 539 | 384MB |
| small | webgpu | fp16 | 29.5s | 199.5s | **0.80x** ⚠ | 1234 ⚠ | 1212MB |

- **WASM q8 pair: combined rtf ~0.37x — 4x under the 1.5x desktop gate.**
- **Browser accuracy == Node accuracy** (same weights): browser wasm union +
  estimator upgrades scored **median 0.390s PASS / p90 1.15s** (gate 1.0) —
  near-identical to Node's 0.40/1.26. Files: `asr.browser.*.json`.
- **WebGPU: skip it.** small+webgpu+fp16 went pathological (hallucination loop,
  1234 words, 0.80x) and the runs emitted ~49k "buffer used in submit while
  destroyed" WebGPU validation errors (transformers.js 3.8.1 + ORT web). WASM
  is fast enough and boring — ship WASM-only, no device matrix.
- Storage: 918MB with all four variants cached; the shipping q8 pair alone is
  ~340MB one-time download, persisted in browser Cache Storage (quota 11GB here).
- Load times above are warm-cache; cold download not yet measured (est. 340MB /
  user bandwidth).

## Mobile numbers (iPhone, iOS 18.7, Safari 26.5, 4 cores, via cloudflared quick tunnel)

| model | dtype | load | transcribe | rtf |
|---|---|---|---|---|
| base | wasm q8 (cold) | 6.0s | 133.8s | 0.54x |
| base | wasm q8 (warm) | 1.2s | 109.2s | 0.44x |
| small | wasm q8 | 14.5s | 219.4s | **0.88x** |

- **Pair rtf ~1.32x sequential — mobile <=3x gate PASSED with 2.3x headroom.**
- **Completion 100% on this device** — no OOM tab kill, no thermal death, full
  4-min track through both models.
- **Decode word-for-word identical to desktop** (`asr.mobile.wasmunion.json` ==
  `asr.browser.wasmunion.json`) → same accuracy: median 0.390 PASS / p90 1.15.
- iOS Safari grants SAB/multithread WASM through COOP/COEP (`require-corp` —
  Safari does NOT support `credentialless`). Multithread session init WORKS on
  iOS but is silent-slow (minutes feel like a hang); a product MUST show an
  "initializing" state. `?st=1` on bench forces single-thread if a device hangs.
- `performance.memory` doesn't exist on Safari — no heap numbers from mobile.
- Quick-tunnel gotcha: each trycloudflare URL is a new origin → Cache Storage
  re-downloads models; the phone's HTTP cache still dedupes the HF files.

## Phase 0 status after track 1

Desktop: speed gate CLEARED with 4x headroom. Mobile: speed gate CLEARED with
2.3x headroom, completion 100% (n=1 device). Accuracy: median PASSES and p90
misses by 0.15s on the hardest genre bucket with unverified GT (+-0.3s noise
floor), identical on all three platforms. Remaining unknowns: corpus breadth
(14-29 more tracks — needs owner-supplied GT), older/low-RAM iPhones and
Android for the completion-rate gate, cold-download UX (~340MB).

## Phase L1 runbook (per corpus track)

Needs `pnpm install --ignore-workspace` once in this dir (the repo workspace
otherwise hijacks resolution). Accuracy work is Node-only and platform-invariant
— no browser/device runs needed to validate the estimator.

```sh
# 1. transcribe with both models of the winning recipe
pnpm transcribe <track.16k.wav> base_timestamped  q8 <lang>   # -> asr.base_timestamped.q8.json
pnpm transcribe <track.16k.wav> small_timestamped q8 <lang>   # -> asr.small_timestamped.q8.json

# 2. union them (concat + sort by start; NOT exp-combine, see below)
pnpm union asr.base_timestamped.q8.json asr.small_timestamped.q8.json -o asr.union.json

# 3. score: current shipped aligner, then the estimator upgrades
pnpm score    asr.union.json <track>.lrc
pnpm estimate asr.union.json <track>.lrc
```

Every scoring script takes the LRC explicitly and cross-checks it against the
`audio` field carried through the union — a wrong-track pairing hard-errors
rather than printing plausible nonsense (`--force` to override deliberately).

Kota Pagoh regression (re-verified 2026-07-27, must not drift):
`pnpm score` -> 0.450 / 1.920 · `pnpm estimate` -> 0.400 PASS / 1.260.

## Files

- `transcribe.ts` / `union.ts` / `score.ts` / `exp-estimator.ts` — the L1 harness
  above (`pnpm transcribe|union|score|estimate`)
- `gt.ts` — LRC parsing + the track-mismatch guard, shared by all scorers
- `exp-combine.ts` — per-model align + robust combine (WORSE than union: the
  disagree->drop rule discards the correct model with the wrong one; keep union).
  Kept for the record only; usage is now `pnpm tsx exp-combine.ts <lrc> <asr...>`
- `exp-estimator.ts` — estimator upgrades above
- `bench.html` + `serve.mjs` — browser bench, COOP/COEP for multithread WASM,
  beacons progress to `bench.log` (`node serve.mjs`, port 8787)
- `asr.*.json` — raw ASR word dumps per model/dtype
