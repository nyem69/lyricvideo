# Lyric Studio — Commercialization (Phase 1: Validation) — Design

**Date:** 2026-06-08
**Status:** Approved (brainstorm) — ready for implementation plan
**Author:** brainstormed with the user

## 1. Goal

Validate whether people will **pay** for the existing browser-based lyric-video tool before
investing in accounts, billing, and feature gating. Produce a credible commercial **landing
page** with a concrete offer and a low-risk intent-capture mechanism, instrumented well enough
to make a go/no-go call on building real billing.

This is **Phase 1 (validate feasibility first)**, not a full revenue product. The full product
(accounts, Stripe Checkout/Customer Portal, license enforcement, premium flags) is deferred
until validation evidence justifies it.

## 2. Audience & positioning

- **Primary:** indie musicians / self-releasing artists who need lyric videos, visualizers, and
  Spotify-Canvas/Reels assets and can't justify hiring an editor per release.
- **Secondary:** social/content creators making audiogram/visualizer clips.
- **Not now:** agencies/studios (batch workflows, brand kits, white-label) — a heavier future segment.
- **Key differentiator to lead with:** the tool runs **100% in the browser** — audio and images
  never leave the user's device. For unreleased tracks this is a real trust advantage over cloud editors.

## 3. Strategy — two implementation slices

We never gate a feature before we can fulfill the purchase.

### Slice 1 — Landing page + intent capture (THIS build)
- A dedicated marketing landing page replaces the current app at `/`.
- The tool stays **100% free and ungated**.
- Offer presented: **Founder's Lifetime — $24 once** (anchored against a later $39).
- Primary CTA captures **intent via email reservation — no charge today**.
- Secondary CTA: **Try it free** → opens the studio.

### Slice 2 — Stripe + license + gate (NEXT build, documented here, not built now)
- Stripe Checkout / Payment Link → Cloudflare Pages Function webhook.
- Webhook issues an **Ed25519 offline-signed license key** (app verifies locally with an embedded
  public key — no runtime server call needed) and emails it via Resend.
- Cloudflare KV stores `email → {license, createdAt}` for support and a revocation list.
- Founder reservers (from Slice 1) are emailed the checkout link first.
- Only then introduce the soft gate (watermark / 1080p / formats — see §5).

## 4. The offer

**Founder's Lifetime — $24 one-time** (early-founder price; rises to **$39** after the founder window).
"Lifetime" = all current Pro features + all future Pro features, no recurring charge.

**Reserve CTA copy (Slice 1):**
- Button: **"Reserve your $24 founder price"**
- Subcopy: **"No charge today. We'll email you when Founder access opens."**
- Form: email (required) + "What will you make?" (optional, free text — qualitative signal)
- Success: **"You're on the Founder list. Your $24 early price is reserved."**

## 5. Free vs Pro split (EVENTUAL — enforced in Slice 2, NOT in Slice 1)

| Capability | Free | Founder's Lifetime ($24) |
|---|---|---|
| All three tools (lyrics / visualizer / montage) | ✅ | ✅ |
| Export resolution | 720p | **1080p** |
| Export watermark | small corner mark | **none** |
| Formats | YouTube 16:9 only | **all: 9:16, 1:1, custom** |
| Visualizer styles | 2 of 6 | **all 6 + future styles** |
| Future Pro features | — | **included, forever** |

The gate is **soft** (client-side; technically bypassable). Acceptable for the audience and for an
MVP — most users won't tamper, and the privacy/convenience value carries the offer. Not a security boundary.

## 6. Landing page — structure & aesthetic

**Product name:** **Lyric Studio** (descriptive, credible, expandable; chosen over generic
"LyricVideo" and premature brandables like "Versebloom").

**Aesthetic:** Direction A — *Refined Studio*. Extends the app's existing identity so the site and
tool feel like one product:
- Palette: deep green `#0a1a0a` surface, gold `#d4af37` primary accent, teal `#46d6c8` reserved for
  audio-reactive / privacy cues (consistent with the visualizer's audio accent).
- Type: Playfair Display (display) + Fraunces italic accents + Raleway (UI/labels).
- Feel: editorial, premium, calm, generous negative space, one well-orchestrated load-in.
- Blended from Direction B: a **wider live "video frame" hero demo** in the first viewport and a
  **higher-contrast/more-motion equalizer** so the page doesn't feel too quiet.

**Section IA (top → bottom):**
1. **Top bar** — "Lyric Studio" wordmark · *Features · Pricing · FAQ* · **Open the studio** button.
2. **Hero (first viewport)** — kicker "Lyric videos · in your browser"; headline *"Turn your song
   into a video people watch."*; subhead (synced lyrics, visualizers, montages; no editor, no upload,
   free to start); dual CTA (**Reserve founder access · $24** scrolls to reserve; *Try it free →* →
   `/studio`); teal privacy line; **wide animated 16:9 video-frame demo** (synced lyric over a
   reactive visualizer).
3. **Trust strip** — *100% browser-based · No upload · No account to start.*
4. **How it works** — 3 steps: paste timestamped lyrics / drop your song → pick style & format → export.
5. **The three tools** — Lyric video · Audio visualizer · Photo montage; each a card with a mini
   animated preview + one-line benefit; each links to its route.
6. **Formats showcase** — 16:9 / 9:16 / 1:1 aspect chips: "made for every platform."
7. **Why musicians use it** — unreleased-safe (privacy), free to start, fast, lifetime founder option.
8. **Pricing** — Free vs **Founder's Lifetime $24** (later $39); founder card highlighted; "limited
   founder pricing."
9. **Reserve section** — the §4 form + success state.
10. **FAQ** — Does my audio upload? (no) / What does Founder include? / "You won't be charged today" /
    Which formats? / Browser support (export best in Chrome/Edge).
11. **Footer** — wordmark, links, "made for indie artists," socials.

Accessibility: semantic landmarks, keyboard-operable CTAs, `prefers-reduced-motion` disables the
hero/equalizer animation, color contrast AA for body text.

## 7. Technical architecture

### 7.1 Routes (SvelteKit, adapter-static)
- `/` → **new landing page** (`src/routes/+page.svelte` becomes the landing page).
- `/studio` → the **current lyrics editor** (moved from `/`).
- `/visualizer`, `/montage` → unchanged direct product routes.
- All cross-links and the landing CTAs use **`base` from `$app/paths`** (NOT `import.meta.env.BASE_URL`)
  to avoid the subpath-doubling bug seen previously. Existing one-level `import.meta.env.BASE_URL`
  links in the moved editor pages are updated as touched.
- "Try it free" → `/studio`; tool-specific CTAs may deep-link to `/visualizer` or `/montage`.

### 7.2 Reserve endpoint (Slice 1's only serverless)
- **Cloudflare Pages Function** at `functions/api/reserve.ts` (repo root `functions/`, served by CF Pages
  alongside the static `build/` output — adapter stays `adapter-static`).
- `POST /api/reserve` body `{ email, note? }`:
  - Validate email; reject on missing/invalid.
  - **Honeypot** hidden field + minimal rate limiting (per-IP, KV counter) for spam.
  - Store in **CF KV** namespace `FOUNDERS`: key = normalized email, value = `{ note, ts, ua }`. This KV
    namespace is the **source of truth for reservation count** (see §7.4).
  - Optional: send confirmation email via **Resend** (browser User-Agent header — Resend/CF 1010 gotcha).
  - Return `{ ok: true }` (idempotent on duplicate email).
- **KV binding (repo has no wrangler config today):** bind the `FOUNDERS` namespace via the **Cloudflare
  Pages dashboard** (Settings → Functions → KV namespace bindings, binding name `FOUNDERS`). This fits the
  existing Git-integration deploy and needs no `wrangler.toml`. *(Alternative: introduce a `wrangler.toml`
  with a `kv_namespaces` binding — only if we later move to wrangler-based deploys.)* The plan picks the
  dashboard path; this is a one-time manual step the plan calls out explicitly.
- **`_routes.json` placement:** create **`static/_routes.json`** so adapter-static copies it to
  **`build/_routes.json`** (CF Pages reads it from the build output). Content:
  `{"version":1,"include":["/api/*"],"exclude":[]}` — Functions run only for `/api/*`; the static SPA
  (incl. the `index.html` fallback) is untouched. The `functions/` directory itself lives at the **repo
  root** (not in `build/`). (Refs: CF Pages routing + Functions get-started docs.)

### 7.3 Deployment reality (the critical constraint)
The repo deploys to **two targets**:
- **GitHub Pages** (`.github/workflows/deploy.yml`, base `/lyricvideo`) — **static only, no Functions**.
- **Cloudflare Pages** (`lyricvideo.pages.dev`, base `''` via `CF_PAGES=1`) — **supports `/functions`**.

Therefore:
- **Cloudflare Pages is the canonical commercial site** (the reserve endpoint only exists there). A
  custom domain can be attached later.
- **Graceful degradation (required):** the reserve form is progressive-enhancement. It `POST`s to
  `/api/reserve`; if the response is not OK or the request throws (e.g. on the GitHub Pages mirror, or
  before the Function is wired), it **falls back by default to a pre-filled `mailto:`** (subject/body
  carrying the email + note) so no reservation is silently lost. An external hosted form (e.g. Tally/
  Formspree) is an optional drop-in replacement for the mailto fallback, configured via a single
  constant — not required for launch.
- **Verification gate:** before relying on the endpoint, **smoke-test `POST /api/reserve` on the
  `.pages.dev` deployment** (the plan includes this step). If CF Pages does not pick up `/functions`
  with this adapter-static setup, fall back to the external-form path until resolved.

### 7.4 Analytics
- **Cloudflare Web Analytics** for **page/path traffic only** (landing views, `/studio` views). It is
  a beacon/page-performance product, **not** a custom-event analytics tool — do **not** rely on it for
  events like `reserve_success`. (Refs: CF Web Analytics FAQ + data-collection docs.)
- **The reserve conversion is measured server-side**: the reserve Function counts/records submits in KV
  (the `FOUNDERS` namespace IS the source of truth for reservations). CTA attribution, if needed, uses
  **URL paths / query params** (e.g. `/studio?from=hero`) read from CF Web Analytics path data.
- Defer a real event-analytics product (Cloudflare **Zaraz** or **Plausible**) to later, only if
  custom-event tracking becomes important.
- **Funnel = page traffic (CF Web Analytics) + reservation count (KV).** No client event pipeline in Slice 1.

### 7.5 Manual one-time setup actions (called out in the plan)
- **KV binding** `FOUNDERS` via the CF Pages dashboard (§7.2).
- **Resend** API key + verified sender (reuse existing if available); store as a CF Pages env var.
- **Custom domain (optional, recommended):** reserve `lyricstudio.app` (or similar) if available at
  normal pricing and attach it to the CF Pages project. Not required for Slice 1, but cheap optionality
  and more credible for founder validation. Until then the canonical URL is `lyricvideo.pages.dev`.

## 8. Success metrics (validation go/no-go)

Measured over the founder window (suggest 2–4 weeks of real traffic):
- **Landing → studio** click-through rate (interest in the tool).
- **Landing → reserve submit** conversion (willingness-to-pay proxy). *Rough proceed threshold:*
  a reserve conversion that, at expected traffic, implies a worthwhile founder cohort (e.g. ≥ ~2–3%
  of landing visitors reserving). Exact bar set with the user once baseline traffic is known.
- **Qualitative:** the "What will you make?" notes (use-case clustering).
If signal clears the bar → build Slice 2. If not → revisit offer/price/audience before building billing.

## 9. Out of scope (YAGNI for Phase 1)

- User accounts / login / database of users.
- Actual Stripe charge, Checkout, Customer Portal, subscriptions (Slice 2).
- License generation/verification and the watermark/HD/format gate (Slice 2).
- Agency/white-label/batch features, templates, brand kits.
- ID3 album-art auto-extract, live style thumbnails, montage format presets (separate product backlog).

## 10. Risks & mitigations

- **CF Pages Functions not picked up with adapter-static** → smoke-test first; external-form fallback ready (§7.3).
- **Soft gate bypassable** → accepted for MVP; not a security boundary; revisit if abuse appears (§5).
- **Charging "lifetime" before Pro exists (Slice 2)** → mitigated by email-reserve-now/charge-later;
  Slice 2 checkout copy will state refund terms.
- **Two deploy targets diverging** → CF Pages is canonical; GitHub Pages mirror documented as
  static-only with degraded form.
- **Spam on the open reserve endpoint** → honeypot + KV rate limit (§7.2).
```
