# Lyric Studio — Alignment: Local-First Everywhere — Design (v2)

**Date:** 2026-07-25 · **Revised:** 2026-07-26 (post-Phase-0)
**Status:** REVISED DRAFT — local programme unblocked (pending corpus); cloud programme DEFERRED.
**Supersedes (partially):** `2026-06-08-lyric-studio-commercialization-design.md` §5, §9 — see §4.
**v1 of this document** proposed auth + Stripe + D1 as the prerequisite for automatic alignment. Phase 0
ran on 2026-07-26 and changed the conclusion. This revision preserves the v1 machinery (§8–§9) as the
*deferred* cloud plan, corrected per the owner's engineering review.

## 1. What changed since v1

v1's framing: alignment calls OpenAI Whisper (~$0.03/song), metered server cost needs accounts, so
auth/Stripe/D1 is architecturally justified. Its own §3 flagged the escape hatch — in-browser Whisper —
and made spiking it Phase 0, "highest-value work in this document."

**Phase 0 ran. It passed — on desktop AND mobile — on the hardest genre bucket** (Kota Pagoh: Malay rap,
heavy full mix, stylised vocals). Track 1 of a planned 15–30; full data in
`projects/align-spike/RESULTS.md` (gitignored spike dir).

| Gate (owner-set) | Result | Verdict |
|---|---|---|
| Median line error ≤ 0.4s | **0.39s** | PASS |
| p90 line error ≤ 1.0s | **1.15s** | near-miss by 0.15s, inside the ±0.3s GT noise floor (Suno timings, not human-verified) |
| Desktop processing ≤ 1.5× duration | **0.37×** | PASS, 4× headroom |
| Mobile processing ≤ 3× duration | **1.32×** (iPhone, iOS 18.7, 4-core) | PASS, 2.3× headroom |
| Completion ≥ 95% desktop / ≥ 85% mobile | 100% both (n=1 device each) | PASS so far |

Decode output is word-for-word identical across Node, desktop Chrome, and iOS Safari (same weights) —
accuracy is platform-invariant; only speed and memory vary, and both cleared their gates.

The owner's predicted landing zone was **desktop-local + mobile-cloud**. The evidence came in stronger:
**mobile cleared its own gate with 2.3× headroom.** So the target model is now
**local-first everywhere** — desktop and mobile both align on-device by default.

**Consequence for this spec:** cloud alignment is no longer a cost problem needing metering — it is at
most an optional *convenience* (skip a ~340 MB one-time model download; rescue very old devices). That
demotes the entire auth/Stripe/D1 programme from prerequisite to deferred contingency. The economics
invert too: a convenience feature has to fund weeks of billing machinery on its own merits, which is a
much weaker case than "the feature cannot ship without it."

### 1.1 The winning recipe (what "local alignment" concretely is)

- **Union-merge of two models' word streams:** `onnx-community/whisper-base_timestamped` +
  `whisper-small_timestamped`, both **q8 WASM**, fed into the #26 Needleman-Wunsch aligner. The
  `*_timestamped` exports are required (plain exports throw in `_extract_token_timestamps`).
- **No single model survives full-mix music** — each collapses on different 30s chunks (base looped
  "ya ya ya" through the fast-rap verse; small collapsed the intro; turbo lost 40–70s). The two-model
  union is the unlock: they fail in different places and the aligner absorbs the doubles/mishears.
  Turbo adds nothing at 4.6× the compute.
- **WASM only. WebGPU is a SKIP** — small+fp16 on WebGPU went pathological (hallucination loop, ~49k
  buffer-lifecycle validation errors in transformers.js 3.8.1). WASM is fast enough and boring: no
  device matrix.
- **Estimator upgrades** (implied-start median, 5s outlier fence, back-fill snap across instrumental
  breaks) take p90 1.97s → 1.26s (Node) / 1.15s (browser). Prototyped in `exp-estimator.ts`; held out
  of `align.ts` until 2–3 more ground-truth tracks confirm they aren't overfit to one song.
- Download: **~340 MB one-time** for the q8 pair, persisted in browser Cache Storage.

### 1.2 What Phase 0 did NOT prove yet

- **Corpus breadth** — one track. The owner's gate requires 15–30 spanning EN/BM, male/female,
  rap/ballad, studio/compressed. Blocked on owner-supplied ground truth (ideally Suno word-timing
  exports; hand-synced LRCs acceptable).
- **Device breadth** — completion measured on one modern iPhone and one M-series desktop. Older/low-RAM
  iPhones and Android remain unmeasured for the completion-rate gate.
- **Cold-download UX** — 340 MB on real-world bandwidth, plus iOS's silent multi-minute WASM compile
  that looks exactly like a hang. Product must ship an explicit "initializing" state and download
  progress, or support tickets will call it broken.

## 2. Governing principles (updated)

1. **Free for anything that does not incur marginal cost** (unchanged from v1). Local alignment incurs
   none — so it ships **free**.
2. **Local-first everywhere.** The headline promise — *"100% browser-based · No upload · audio never
   leaves your device"* — now extends to alignment on every platform. This resolves v1 §2.3 (the
   privacy contradiction) by construction rather than by copywriting.
3. **Cloud alignment, if ever built, is opt-in convenience** — visible, per-use, named recipient
   (OpenAI), never mandatory, never silent. Owner's framing: server alignment only breaks the promise
   if it becomes invisible or mandatory.

## 3. Product surface

**Free — all client-side, no account, no server:**
everything in v1 §4 **plus automatic local alignment** (the union recipe above). The only "cost" the
user pays is the one-time 340 MB model download and device compute.

**Paid (deferred, contingent):** cloud alignment as a convenience — skip the download, get a result on
a device that can't run the models. Nothing else is paid. See §8 for the deferred plan and §7 for the
triggers that would un-defer it.

## 4. Owner decisions — v1 §10 resolved

The owner accepted v1 as direction (review delivered 2026-07-26) without approving Phases 1–5. The six
open decisions are now closed as follows:

1. **Free/Pro gate (v1 §2.1): RETIRED.** All client-side features free. Already true in the shipped
   app; `2026-06-08` §5 is formally dead.
2. **Founder's Lifetime (v1 §2.2): resolved and largely mooted.** PR #27 removed the offer from the
   landing page after verifying the `FOUNDERS` KV held zero real reservations (only the deploy smoke
   test) — there is no cohort to honour. If a lifetime offer ever returns it is **device-side lifetime
   features + a one-time cloud-credit allocation** — never a recurring monthly allowance, which
   recreates permanent liability.
3. **Privacy (v1 §2.3): keep the strong local-first claim**, split **Local Alignment** (default,
   everywhere) from optional **Cloud Alignment** (explicit, paid, named recipient). With local-first
   everywhere the trust strip needs no qualification unless/until cloud ships.
4. **Auth: passwordless only** — Google OAuth + magic link. No email/password. (Only relevant if the
   cloud programme un-defers.)
5. **Pricing: prepaid credits, value-priced** (alignment saves 10–30 min of manual tap-syncing — price
   the saved time, not Whisper-cost-plus-margin). Revised packs, superseding v1 §5's table:

   | Pack | Price | Credits |
   |---|---|---|
   | Trial | free | 1–3, released progressively |
   | Creator | $9 | 40 |
   | Studio | $19 | 120 |
   | Producer | $49 | 400 |

   Free credits release **progressively** — 1 after email verification, +2 after real product activity
   — not 3 up front (bounds farming). Margin math must net out Stripe fixed + percentage fees, refunds,
   FX, tax, and support — not just Whisper spend.
6. **`adapter-cloudflare` migration: DEFERRED** until cloud alignment is confirmed necessary. The
   current `adapter-static` + root `functions/` harness (kept from #27) is sufficient for everything
   the local programme needs.

## 5. Local programme — the plan of record

Each phase independently shippable. This track has **no auth, no billing, no D1, no adapter migration.**

- **Phase L0 — spike track 1. DONE** (2026-07-26). Results in §1.
- **Phase L1 — corpus validation.** Blocked on owner: 14–29 more tracks with ground truth. Per track:
  `transcribe` base+small (q8, `*_timestamped`), union, estimator, score against the track's LRC.
  Accuracy work runs entirely in Node (platform-invariant); browser/mobile re-testing is speed-only
  and already done. Gate: the owner's corpus-wide p50/p90/completion table.
- **Phase L2 — estimator upgrades into `src/lib/align/align.ts`** once 2–3 corpus tracks confirm they
  generalize (implied-start median, outlier fence, back-fill snap). Branch + PR, never straight to main.
  Note: the union merge biases line starts early (−0.27s median, min-of-N noisy estimates) — the
  implied-start median is the fix; do NOT paper over it with a global offset.
- **Phase L3 — in-app local alignment.** transformers.js dependency; q8 WASM pair with union merge;
  model download UI (progress, ~340 MB one-time, Cache Storage persistence); explicit **"initializing"
  state** (iOS compiles WASM silently for minutes); single-thread fallback flag; WebGPU path disabled.
  Serving requirement: **COOP/COEP `require-corp`** headers for multithread-WASM SharedArrayBuffer —
  Safari does not support `credentialless`. This is a static `_headers` change on the current adapter;
  audit any cross-origin resources (fonts/CDN) for CORP compatibility first.
- **Phase L4 — device-breadth hardening.** Older/low-RAM iPhones + Android completion rates, thermal
  behaviour on long tracks, graceful failure messaging when a device genuinely can't finish.

## 6. Engineering corrections (owner review, 2026-07-26)

Folded into the deferred cloud design (§8) so they are not re-litigated later:

1. **The v1 debit protocol is not atomic.** A crash after the guarded balance decrement but before the
   ledger/job inserts leaves a reduced balance with no refund path. Fix: wrap steps 1–2 in a real D1
   transaction, or make `credit_ledger` the sole source of truth and derive balance (materialize
   asynchronously).
2. **Client-supplied idempotency key** on `POST /api/align` with `UNIQUE(user_id, idempotency_key)` —
   otherwise a client retry after a network blip creates two paid jobs.
3. **Validate duration, not just the 25 MB size cap** — a low-bitrate 25 MB file can far exceed 10 min.
   Decode the header server-side or bill per started minute.
4. **Turnstile only at signup and free-credit claim, NOT on every paid call.** It doesn't stop a stolen
   session that can also drive the site. Paid-call abuse is handled by per-user concurrency limits,
   idempotency, rate limits, and anomaly detection.
5. **Pack margins** must include Stripe fixed+% fees, refunds, FX, tax, and support — see §4.5.

## 7. Cloud programme — deferral triggers

The cloud track stays parked unless one of these becomes true:

1. **Corpus failure (Phase L1):** a genre/language bucket local models can't align within gate, where a
   larger server-side model demonstrably can.
2. **Device failure (Phase L4):** a material user segment whose devices can't complete local alignment
   (OOM, thermal, completion < 85%).
3. **Demonstrated demand for download-avoidance:** real users balking at the 340 MB one-time download
   in numbers that justify weeks of billing machinery.

Absent a trigger, the honest position is v1's own closing line, now with evidence: the programme would
exist to bill for a convenience, and Phase 0 showed the necessity case is gone.

## 8. Deferred: cloud alignment architecture (v1 §6, corrected)

Kept for the day a §7 trigger fires. Summary of what stands, amended per §6 above:

- **Runtime:** migrate to `adapter-cloudflare` (Workers) *at that point*, not before — `wrangler.toml`
  versioned bindings, one routing model, real local dev via `wrangler dev`. Landmine from `prn`:
  `wrangler` must be a devDependency for CF Workers Builds.
- **Auth:** Better Auth + D1 + Drizzle, **passwordless** (Google OAuth + magic link). Verification
  before any credit grant. Sessions in httpOnly cookies. `db:generate` + `db:migrate`, never `db:push`;
  D1 migrations forward-only, additive, rehearsed on a disposable DB (manahalal's 9h55m outage is the
  scar).
- **Data model:** v1 §6.3 (`credit_balance`, append-only `credit_ledger` with `UNIQUE(reason, ref)`,
  `purchase`, `align_job`) **plus** `align_job.idempotency_key` with `UNIQUE(user_id, idempotency_key)`;
  ledger is truth, balance derived (§6.1 correction).
- **Debit protocol:** reserve → work → commit/refund, now transactional per §6.1. Never charge for our
  own failure.
- **Gating chain:** v1 §6.5 minus the per-call Turnstile (kept only at signup/credit-claim); add
  per-user concurrency limit and duration validation (§6.3 correction). Alignment itself still runs
  client-side — the server is a thin Whisper proxy and never receives the lyrics.
- **Stripe:** one-time Checkout Sessions only, webhook idempotency via the ledger constraint, no
  subscriptions, manual refunds. Owner-side: Malaysian tax/business setup, consumer terms — out of
  scope here.

## 9. Risks (updated)

| Risk | Severity | Mitigation |
|---|---|---|
| Estimator upgrades overfit to track 1 | **High** | Held out of `align.ts` until 2–3 corpus tracks confirm (Phase L2 gate) |
| Corpus reveals a failing genre/language bucket | **High** | Phase L1 before any product wiring; §7.1 fallback exists |
| 340 MB cold download abandonment | Medium | Progress UI, Cache Storage persistence, clear one-time framing; §7.3 watches for real demand |
| iOS init looks like a hang | Medium | Explicit "initializing" state (Phase L3, mandatory) |
| Old/low-RAM devices fail completion | Medium | Phase L4 measurement; graceful failure copy; §7.2 fallback |
| transformers.js upgrades regress the WASM path (cf. the WebGPU pathology at 3.8.1) | Medium | Pin the working version; WASM-only path (no WebGPU matrix) |
| COOP/COEP breaks cross-origin embeds/resources | Low | Audit before enabling; `require-corp` is the Safari-compatible value |
| p90 gate ambiguity (1.15 vs 1.0 with ±0.3 GT noise) | Low | Owner call — see §10.1 |
| GT noise floor pollutes corpus scoring | Low | Prefer Suno word-timing exports; treat ±0.3s as floor in gate math |

Retired risks from v1: privacy claim undermined (resolved by construction); lifetime liability (#27,
no cohort); "whole programme unnecessary if spike passes" (it passed); Whisper-on-sung-Malay unproven
(track 1 was exactly that, and passed).

## 10. Open decisions

1. **Is the p90 near-miss a PASS?** 1.15s vs 1.0s gate on the hardest track, with an unverified-GT
   ±0.3s noise floor. Owner call; decides whether further estimator work is *required* or *polish*.
2. **Corpus source:** Suno word-timing exports (best) vs hand-synced LRCs (acceptable). Owner supplies
   either way — this is the only blocker on Phase L1.
3. **Whether cloud convenience is ever worth building** absent a §7 trigger — default is no.
