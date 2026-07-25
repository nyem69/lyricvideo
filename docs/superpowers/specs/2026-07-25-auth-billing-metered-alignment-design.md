# Lyric Studio — Auth, Billing & Metered Alignment — Design

**Date:** 2026-07-25
**Status:** DRAFT — blocked on §2 decisions. Nothing built.
**Supersedes (partially):** `2026-06-08-lyric-studio-commercialization-design.md` §5, §9 — see §2.1.

## 1. What changed

`2026-06-08` deliberately avoided accounts: Stripe → webhook → **Ed25519 offline license key**, verified
locally, no runtime server call (§3 Slice 2), with *"user accounts / login / database of users"* listed
**out of scope** (§9). That was correct for what it gated: **client-side soft gates** (watermark, 1080p,
formats). Zero marginal cost, so an offline key is enough — worst case someone pirates a feature that
costs us nothing to serve.

Automatic lyric alignment is a different animal. It calls **OpenAI Whisper (~$0.03 per 5-min song)**, so
every use spends real money. An offline license **cannot meter**: a signed key is a bearer token that can
be replayed indefinitely. Metered server cost requires server-side identity plus usage accounting —
i.e. accounts and a database. The new requirement is therefore **architecturally justified**, not a
preference change.

New governing principle from the owner: **free for anything that does not incur marginal cost.**

## 2. Decisions required before implementation

### 2.1 The existing Free/Pro split now contradicts the governing principle

`2026-06-08` §5 gates: export resolution (720p vs 1080p), watermark, formats (16:9 only vs all),
visualizer styles (2 of 6). **Every one of those runs on the user's device at zero marginal cost.**
Under "free unless it costs us," all four must be free.

Reality has already moved: as of 2026-07-25 the app ships **18 viz styles**, **all formats**, and a
**Full/Balanced/Small quality selector including 1080p** — all free, all client-side. §5 is both stale
(2 of 6 styles) and superseded in principle.

**Decision needed:** retire §5's gate entirely, or keep a value-based (not cost-based) gate for
positioning? Retiring it means the *only* paid surface is alignment.

### 2.2 "Founder's Lifetime $24" + metered cost = unbounded liability

§4 sells *"all current Pro features + all future Pro features, no recurring charge."* If alignment
becomes a Pro feature, one $24 lifetime buyer aligning 10,000 songs costs **~$300** in Whisper spend.
The offer was designed when every Pro feature was free to serve. It no longer is.

**Decision needed** — pick one:
- (a) Lifetime covers client features only; alignment is separately metered.
- (b) Lifetime includes a **capped** allowance (e.g. 20 alignments/month), overage as credits.
- (c) Withdraw "lifetime" for new buyers; honour existing reservers under (b).

Reservations already captured in KV `FOUNDERS` were made against the §4 copy. Whatever is chosen, those
people were promised a specific thing — honour it explicitly rather than silently redefining it.

### 2.3 Alignment contradicts the product's headline promise

The differentiator, stated in §2 and rendered in the landing trust strip, is
**"100% browser-based · No upload · audio never leaves your device"** — called out as a real trust
advantage *for unreleased tracks*.

Auto-alignment uploads the audio to our Function and onward to OpenAI. That is the exact opposite, on
the exact asset (an unreleased master) the promise was about.

**Decision needed:** how to present this. Minimum: alignment is explicitly opt-in, per-use, with copy
naming OpenAI as a recipient, and the trust strip qualified ("every feature but one runs locally").
Silently weakening the claim would be the worst outcome — it is the product's main credibility asset.

## 3. The alternative that may remove the need for billing entirely

**Run Whisper in the browser** (`transformers.js` / `whisper.cpp` via WASM, `whisper-tiny`/`base`).

If viable it is strictly better on every axis this product cares about:

| | Server Whisper | In-browser Whisper |
|---|---|---|
| Marginal cost | ~$0.03/song | **zero** |
| Privacy promise | broken | **kept** |
| Needs auth + Stripe + D1 | **yes** | no |
| Needs abuse gating | yes | no |
| Accuracy | high | lower (tiny/base models) |
| First-use cost | none | ~40–150 MB model download |
| Speed | fast | slow, device-dependent; poor on mobile |

The aligner shipped in #26 is **model-agnostic** — it consumes `{text, start, end}[]` from any source.
So this is a swappable backend, not a rewrite.

**This should be spiked (1–2 days, throwaway) before committing to auth + billing.** If in-browser
Whisper produces word timings good enough for the aligner — and §4's stress test shows the aligner
tolerates heavy ASR error, median stayed exact at 80% word corruption — then the entire auth/Stripe/D1
programme is unnecessary for this feature, and alignment ships free.

Recommended spike gate: run `whisper-base` in-browser on the Kota Pagoh MP3, feed output through
`alignLyrics`, measure against the known `.lrc`. Pass = p90 error ≤ 1.0s. If it passes, stop here.

## 4. Free / Paid boundary (given the principle)

**Free — zero marginal cost, all client-side, no account:**
all 18 visualizer styles · all fonts · all colours/backgrounds · all formats & custom dims · all quality
levels incl. 1080p · export (client MediaRecorder) · Suno/LRC/SRT parsing · plain-lyric even-spread seed ·
tap-to-sync · project persistence (IndexedDB/localStorage).

**Paid — incurs marginal cost:**
automatic alignment (Whisper). **Currently the only item on this list.**

**Possible future paid items** (each would need the same justification): server-side render/transcode,
cloud project storage, email delivery of exports, hosted share pages.

## 5. Pricing model — credits, not subscription (recommendation)

With exactly one metered feature, a **subscription is the wrong instrument**:

- **Credits cap our downside.** Prepaid balance is a hard ceiling on Whisper spend per user. A
  subscription is unbounded unless separately rate-limited — you end up building metering anyway.
- **Machinery.** One-time Stripe Checkout needs `checkout.session.completed`. Subscriptions add
  invoices, renewals, proration, dunning, cancellation, reactivation, plan changes, and the Customer
  Portal. That is weeks of edge cases for one API call.
- **Churn.** A subscriber who makes three videos a year churns and resents it. A credit buyer returns
  when they have a new song. Usage here is inherently bursty — release-driven, not continuous.
- **Honesty.** Revenue tracks cost. No pressure to gate free features to justify a recurring price.

**Proposed:** credit packs, 1 credit = 1 alignment of ≤10 min audio.

| Pack | Price | Credits | Unit | Approx. gross margin |
|---|---|---|---|---|
| Starter | $5 | 25 | $0.20 | ~85% |
| Standard | $15 | 100 | $0.15 | ~80% |
| Studio | $40 | 400 | $0.10 | ~70% |

Plus **3 free credits on signup** — enough to prove the feature works on a real song without a card.
Free credits are the marketing spend; cap them per verified email to bound abuse.

Prices are placeholders for the owner to set. Margin assumes ~$0.03/song Whisper plus Workers/D1 at
effectively zero at this scale.

## 6. Architecture

### 6.1 Runtime: move to `adapter-cloudflare` (Workers)

Currently `adapter-static` + `functions/` (CF Pages Functions). That works — `functions/api/reserve.ts`
proves it — but auth and billing change the calculus:

- **Bindings become versioned.** KV `FOUNDERS` is bound by *dashboard click* today (`2026-06-08` §7.2).
  Auth adds D1 + secrets + Turnstile; hand-clicked bindings with no config in git is a liability once
  there are five of them. `wrangler.toml` puts them under review.
- **One routing model.** Auth needs `/api/auth/*` with cookie handling; SvelteKit `+server.ts` +
  `hooks.server.ts` is the documented Better Auth path. Splitting logic between `functions/` and
  `src/routes` is avoidable complexity.
- **Real local dev.** `wrangler dev` runs the actual runtime with local D1, so migrations and session
  cookies are testable offline. Today's `vite dev` cannot see a Function at all.
- **In-house precedent.** `prn` already runs `adapter-cloudflare` v7 Workers Static Assets with CF
  Workers Builds; manahalal pairs Better Auth + D1 on Workers. Copy those, don't invent.

`ssr=false` stays — this remains a client-rendered SPA. Workers is for `/api/*` and session, not SSR.

**Landmine (bit us on `prn`):** CF Workers Builds runs `npx wrangler deploy`, so **`wrangler` must be a
devDependency** or the build succeeds and the deploy dies with `sh: wrangler: not found`.

### 6.2 Auth: Better Auth + D1

- Email + password, plus Google OAuth (lowest friction for musicians).
- Email verification **required before free credits are granted** — otherwise free credits are farmable.
- Sessions: httpOnly, Secure, SameSite=Lax cookies. No JWT in localStorage.
- `BETTER_AUTH_SECRET` as a Workers secret. Note from manahalal: rotating it invalidates JWKS/sessions —
  document it, don't rotate casually.
- Schema owned by Drizzle. Per house rule: `db:generate` + `db:migrate`, **never `db:push`**.

**Migration discipline — cite the scar:** manahalal's Phase B forward-migration attempt (2026-07-22)
failed *after the first write* and caused a **9h55m outage**, resolved only by restore. D1 migrations here
must be: forward-only, additive, reviewed, applied manually, verified on a disposable DB first.

### 6.3 Data model (D1, Drizzle)

Better Auth owns `user`, `session`, `account`, `verification`. Ours:

```
credit_balance
  user_id      TEXT PK  -> user.id
  credits      INTEGER NOT NULL DEFAULT 0   -- never negative; CHECK (credits >= 0)
  updated_at   INTEGER NOT NULL

credit_ledger                     -- append-only; the audit trail, not a cache
  id           TEXT PK
  user_id      TEXT NOT NULL
  delta        INTEGER NOT NULL   -- +25 purchase, -1 alignment, +1 refund
  reason       TEXT NOT NULL      -- signup_grant | purchase | alignment | refund | adjustment
  ref          TEXT               -- stripe session id / align job id
  created_at   INTEGER NOT NULL
  UNIQUE (reason, ref)            -- idempotency: a replayed webhook cannot double-credit

purchase
  id                 TEXT PK
  user_id            TEXT NOT NULL
  stripe_session_id  TEXT UNIQUE NOT NULL
  pack               TEXT NOT NULL
  amount_cents       INTEGER NOT NULL
  currency           TEXT NOT NULL
  credits            INTEGER NOT NULL
  status             TEXT NOT NULL   -- pending | paid | failed | refunded
  created_at         INTEGER NOT NULL

align_job                          -- one row per attempt; supports refund-on-failure
  id           TEXT PK
  user_id      TEXT NOT NULL
  status       TEXT NOT NULL        -- reserved | ok | failed
  audio_bytes  INTEGER
  duration_sec REAL
  cost_cents   REAL                 -- our actual Whisper spend, for margin tracking
  created_at   INTEGER NOT NULL
```

`credit_balance` is derived state; `credit_ledger` is truth. Balance must be reconcilable by summing the
ledger — add a periodic assertion.

### 6.4 Debit protocol (must not double-spend)

D1 is SQLite; assume concurrent requests. Reserve → do work → commit or refund:

1. `UPDATE credit_balance SET credits = credits - 1 WHERE user_id = ? AND credits > 0` — check
   `meta.changes === 1`. Zero rows means insufficient credit; reject **before** calling Whisper. The
   `WHERE credits > 0` guard is what makes this safe without a transaction.
2. Insert `align_job` (`reserved`) + `credit_ledger` (`-1`, `reason='alignment'`, `ref=jobId`).
3. Call Whisper.
4. Success → `align_job.status='ok'`, record `cost_cents`.
5. Failure (OpenAI 5xx/timeout) → refund: `+1` ledger row (`reason='refund'`, same `ref`),
   `align_job.status='failed'`. **Never charge for our own failure.**

### 6.5 Gating chain for `POST /api/align`

manahalal-style layers, in cheapest-first order so expensive checks never run on junk:

| # | Check | Reject |
|---|---|---|
| 1 | Method `POST`, `Content-Length` present | 405 / 411 |
| 2 | `Origin` matches allowlist (own domains only) | 403 |
| 3 | Bot User-Agent denylist / missing UA | 403 |
| 4 | Body ≤ **25 MB** (Whisper's hard limit) | 413 |
| 5 | **Turnstile** token valid (single-use, server-verified) | 403 |
| 6 | Valid session cookie → `user_id` | 401 |
| 7 | Email verified | 403 |
| 8 | Per-user rate limit (KV, e.g. 10/hr, 60/day) | 429 |
| 9 | Credit reserve succeeds (§6.4 step 1) | 402 |
| 10 | Whisper call | 502 + refund |

Turnstile *and* auth: auth stops anonymous abuse, Turnstile stops a scripted authenticated client from
draining its own credits via a compromised session, and keeps headless traffic off the endpoint.

**Alignment runs client-side.** The Function is a thin Whisper proxy that returns word timings; `alignLyrics`
executes in the browser. Reasons: Workers have CPU-time limits, the aligner is pure and already
unit-tested, and the server never needs the lyrics — so **we never receive the user's words**, only the
audio. Smaller privacy surface and less to defend.

### 6.6 Stripe

- **Checkout Session** (one-time, `mode: 'payment'`), created server-side. Never trust client price:
  the pack id maps to a server-side price table.
- Webhook `POST /api/stripe/webhook`: verify signature with `STRIPE_WEBHOOK_SECRET`, handle
  `checkout.session.completed`, credit via the `UNIQUE (reason, ref)` ledger constraint for idempotency.
  Stripe retries — handlers must be safe to run twice.
- No subscriptions ⇒ no Customer Portal, no dunning. A receipt link is enough.
- **Refunds** stay manual (low volume) with an `adjustment` ledger row.
- **Test mode first**, with the CLI forwarding webhooks to `wrangler dev`.
- Not technical, owner-side: Stripe account + tax/business details for Malaysia, and consumer-facing
  terms/refund policy. Selling to consumers cross-border may raise VAT/GST obligations — take advice;
  this spec does not cover it.

## 7. Phased plan

Each phase independently shippable and reversible. **No phase after 0 starts until §2 is decided.**

- **Phase 0 — spike in-browser Whisper (§3).** 1–2 days, throwaway. If it passes the gate, phases 1–5
  are cancelled and alignment ships free. *Highest-value work in this document.*
- **Phase 1 — runtime migration.** `adapter-static` → `adapter-cloudflare`; `wrangler.toml` with existing
  KV; port `functions/api/reserve.ts` to `+server.ts`; add `wrangler` devDep. No user-visible change.
  Verify reserve still works before proceeding.
- **Phase 2 — auth.** Better Auth + D1 + Drizzle schema; signup/login/verify/reset; session in the SPA;
  account page. No billing, no gates. Ship and use it.
- **Phase 3 — credits (no payment).** Ledger + balance + debit protocol; manual grants via an admin
  script; `/api/align` behind the full §6.5 chain, spending credits. Alignment works end-to-end for
  hand-granted users. **This is the first release where the feature is real.**
- **Phase 4 — Stripe.** Checkout + webhook + purchase records, test mode → live. Packs on the pricing page.
- **Phase 5 — reconcile the offer.** Resolve §2.1/§2.2: retire the §5 gate, restate the founder promise,
  email the `FOUNDERS` cohort what they actually get.

Phases 1–4 are a **multi-week programme**, and it is worth being blunt about the ratio: it exists to
bill for one API call costing three cents. Phase 0 is the responsible first move.

## 8. Manual setup (owner-only; cannot be scripted from here)

1. D1 database created; `database_id` into `wrangler.toml`.
2. Secrets: `OPENAI_API_KEY`, `BETTER_AUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `TURNSTILE_SECRET_KEY` (+ public site key as a build var).
3. Google OAuth client (redirect URIs per environment).
4. Turnstile widget registered for the domain.
5. Stripe: account, products/prices, webhook endpoint, tax settings.
6. Custom domain — cookie-based auth on `*.pages.dev` is workable but a real domain is strongly
   preferable for cookie scoping and credibility.
7. Privacy policy + terms updated: accounts store PII (email), and alignment transmits audio to OpenAI.
   The current product stores nothing server-side; this is a genuine change in posture.

## 9. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Privacy claim undermined (§2.3) | **High** | Opt-in per use, explicit copy, qualify the trust strip, keep everything else local |
| Whole programme unnecessary if §3 spike passes | **High** | Do Phase 0 first |
| Lifetime + metered cost liability (§2.2) | **High** | Cap allowance before selling another lifetime seat |
| D1 migration outage (manahalal precedent) | **High** | Forward-only, additive, disposable-DB verify, manual apply |
| Credit double-spend | Medium | Guarded `UPDATE ... WHERE credits > 0`, `changes===1` check |
| Webhook replay double-credit | Medium | `UNIQUE (reason, ref)` on the ledger |
| Free-credit farming | Medium | Verified email required, per-email cap, Turnstile |
| Charged for our own failure | Medium | Refund ledger row on non-2xx (§6.4 step 5) |
| Whisper unusable on sung Malay | Medium | Unproven — Phase 0 settles it for both backends |
| Stripe/tax obligations | Medium | Owner + professional advice; out of scope here |
| Scope ratio (weeks of billing for $0.03/call) | Medium | Phase 0; credits over subscriptions |

## 10. Open decisions

1. §2.1 — retire the §5 Free/Pro gate? (principle says yes)
2. §2.2 — which lifetime resolution: (a), (b) or (c)?
3. §2.3 — how to present the privacy change?
4. §3 — run the Phase 0 spike before committing to auth + billing?
5. §5 — credits or subscription? Pack prices?
6. §6.1 — accept the `adapter-cloudflare` migration as a prerequisite?
