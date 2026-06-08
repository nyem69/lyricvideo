# Lyric Studio — Multi-language (i18n) for the Landing Page — Design (Paraglide/Inlang)

**Date:** 2026-06-08
**Status:** Draft (rev 2 — Paraglide/Inlang) — awaiting user approval before an implementation plan is executed
**Author:** drafted from the user's brief; revised to use Paraglide v2 per the user's request
**Reference implementations:** `~/PROJECTS/SITE/nasab` and `~/PROJECTS/SITE/manahalal/manahalal-pwa` (both Paraglide v2 + inlang message-format).
**Related:** `docs/superpowers/specs/2026-06-08-lyric-studio-commercialization-design.md` (Slice 1, shipped).

## 1. Goal

Localize the **public marketing landing page** (`/`) of Lyric Studio into **English (`en`, base)**, **Bahasa Melayu (`ms`)**, and **Bahasa Indonesia (`id`)**, using **Paraglide JS v2 (`@inlang/paraglide-js`)** with the **inlang message-format** — matching the conventions already used in `nasab` and `manahalal-pwa`.

This slice localizes the **landing/public surface only**. The editor (`/studio`) and product routes (`/visualizer`, `/montage`) are **not** translated here (follow-up). All copy ships as **static, compiled message dictionaries** checked into the repo. **No runtime machine translation.**

## 2. Why Paraglide (vs the earlier hand-rolled rev)

The first draft proposed a custom `src/lib/i18n/` module. The user directed us to standardize on **Paraglide/Inlang** like the other repos. Paraglide gives us: a typed, tree-shakeable `m.key()` API generated at build time; the inlang message-format (`messages/{locale}.json`) that the team already uses; first-class locale strategies; and no bespoke store to maintain. We adopt the **same toolchain** as `nasab`/`manahalal-pwa`; we differ only where lyricvideo's deploy model forces it (see §4).

## 3. Locales

| Code | Language | Switcher label (native) | Note |
|------|----------|-------------------------|------|
| `en` | English (base) | English | `baseLocale`; fallback target. |
| `ms` | Bahasa Melayu | Bahasa Melayu | Malaysian register; native, not mechanical. |
| `id` | Bahasa Indonesia | Bahasa Indonesia | Distinct from `ms` (gratis≠percuma, unggah≠muat naik). |

- Indonesian locale code is **`id`** (not `in`).
- `ms` and `id` are **separate message files**, divergent vocabulary expected.

## 4. Toolchain & deploy adaptation (the one real difference from the reference repos)

Both reference repos run on **adapter-cloudflare (SSR)** and use Paraglide's **`url` strategy** (locale-prefixed paths like `/ms/...`) with a **`reroute` hook** + server **`paraglideMiddleware`**. lyricvideo is different:

- **`adapter-static`, global SPA** (`src/routes/+layout.ts`: `ssr=false; prerender=false`) — there is **no server at runtime**, so `paraglideMiddleware`/server hooks do **not** apply.
- **Dual deploy with two different base paths:** Cloudflare Pages at **root** (`lyricvideo.pages.dev`) and GitHub Pages at **subpath** `/lyricvideo`. Locale **path** routing (`/ms/…`) would have to compose with both bases — extra surface for breakage.

**DECISION D1 (for approval) — locale strategy.** Use Paraglide's **client strategies, no locale routes**:

```
strategy: ['localStorage', 'preferredLanguage', 'baseLocale']
```

- `localStorage` — persists the user's explicit choice across visits.
- `preferredLanguage` — first-visit auto-detect from the browser's **`navigator.languages`** (client-side, since this is a static SPA with no server `Accept-Language` handling; free with Paraglide, falls back cleanly). *(This flips the earlier "no auto-detect" rev-1 decision — Paraglide makes it idiomatic and it is good UX. Approve or veto.)*
- `baseLocale` — final fallback to `en`.

This keeps the **same Paraglide engine and `m.key()` idiom** as the repos while avoiding locale-path routing on a static SPA with two base paths. No `reroute` hook, no server middleware.

**Alternative (documented, NOT this slice) — Path A `url` strategy.** Adopt locale-prefixed paths (`/ms/`, `/id/`) with a `reroute` hook (works client-side via the SPA fallback) and `localizeHref` links, exactly like `nasab`/`manahalal`. This gives shareable per-locale URLs **and** would unlock **localized SEO** (each locale path prerendered) — pairing naturally with the deferred "Slice 1.5" prerender work. It costs: reroute + Paraglide base-path config for the CF-root vs GH-`/lyricvideo` split, and localized prerendering to realize the SEO gain. **Recommended as a follow-up**, not bundled here. (If you prefer to do `url` now to match the repos 1:1, say so and the plan switches to Path A.)

## 5. Switching & fallback behavior

- The header **LanguageSwitcher** calls Paraglide's **`setLocale(code)`** (writes `localStorage`, triggers a reload so every `m.*()` re-renders in the new locale — same reload approach the reference `LanguageSwitcher` uses). With the `localStorage` strategy read at runtime init (client-only SPA), the reloaded page paints directly in the chosen locale → **no FOUC**.
- **Resolution order** is Paraglide's strategy order: `localStorage` › `preferredLanguage` › `baseLocale (en)`.
- **Missing key** → Paraglide's compile step requires every locale to define every message used (or it warns); `en` is the base. We treat **missing/!translated** as a build-surfaced issue, with `en` as the base fallback.

## 6. Project layout (mirrors the reference repos)

```
project.inlang/
  settings.json          # baseLocale en, locales [en,ms,id], message-format + m-function-matcher plugins, pathPattern ./messages/{locale}.json
messages/
  en.json                # base — { "$schema": ".../inlang-message-format", "key": "value", ... }
  ms.json
  id.json
src/lib/paraglide/        # GENERATED by paraglide compile / the Vite plugin. GITIGNORED — Paraglide writes an inner `.gitignore` (`*`) that self-ignores the output, exactly as nasab/manahalal do (verified: `git ls-files` shows 0 tracked there). Regenerated by the compile prefixes on `check`/`build` + `postinstall`.
vite.config.ts            # + paraglideVitePlugin({ project:'./project.inlang', outdir:'./src/lib/paraglide', strategy:['localStorage','preferredLanguage','baseLocale'] })
package.json              # devDep @inlang/paraglide-js; scripts: build -> "paraglide-js compile && vite build", postinstall -> "paraglide-js compile"
```

- **Message access in components:** `import * as m from '$lib/paraglide/messages';` then `m.hero_title_part1()` etc. (Flat message keys — Paraglide messages are functions, not nested objects.)
- **Runtime:** `import { locales, getLocale, setLocale } from '$lib/paraglide/runtime';`
- **Import alias:** use `$lib/paraglide/...` (matches `nasab`; no extra alias needed; `outdir` under `src/lib`).
- **Message format:** flat `messages/{locale}.json`, `"key": "value"`, `{param}` for interpolation. lyricvideo's strings need **no runtime params** (the reserve mailto body is assembled in code from label messages + the user's email/note), so all messages are plain strings.

## 7. Message key inventory (flat keys)

Naming convention: `<section>_<element>` (snake_case, Paraglide-friendly). Lists become numbered keys (no arrays in message-format). Full set (English values are the current landing copy, verbatim):

- **meta:** `meta_title`, `meta_description`
- **header:** `header_nav_features`, `header_nav_pricing`, `header_nav_faq`, `header_open_studio`, `header_language` (selector aria-label)
- **hero:** `hero_eyebrow`, `hero_title_part1` ("Turn your song into a "), `hero_title_accent` ("video", Fraunces), `hero_title_part2` (" people watch."), `hero_subhead`, `hero_cta_reserve`, `hero_cta_try`, `hero_privacy`, `hero_preview_badge`
- **trust:** `trust_browser`, `trust_no_upload`, `trust_no_account`
- **how:** `how_title`, `how_step1_title`/`how_step1_desc`, `how_step2_title`/`_desc`, `how_step3_title`/`_desc`
- **tools:** `tools_title`, `tools_open`, `tools_lyric_title`/`tools_lyric_desc`, `tools_visualizer_title`/`_desc`, `tools_montage_title`/`_desc`
- **formats:** `formats_title`, `formats_subhead`, `formats_youtube`, `formats_tiktok`, `formats_instagram`
- **pricing:** `pricing_title`, `pricing_subhead`, `pricing_free_name`, `pricing_free_1..5`, `pricing_founder_badge`, `pricing_founder_name`, `pricing_price_was`, `pricing_price_once`, `pricing_pro_1..6`, `pricing_founder_cta`
- **reserve:** `reserve_eyebrow`, `reserve_heading`, `reserve_supporting`, `reserve_email_placeholder`, `reserve_email_label`, `reserve_note_placeholder`, `reserve_note_label`, `reserve_submit_idle`, `reserve_submit_busy`, `reserve_helper`, `reserve_success_title`, `reserve_success_body`, `reserve_err_invalid`, `reserve_err_unreachable`, `reserve_mailto_link`, `reserve_mailto_link_label`, `reserve_mailto_subject`, `reserve_mailto_email`, `reserve_mailto_make`, `reserve_mailto_unspecified`
- **faq:** `faq_title`, `faq_q1`/`faq_a1` … `faq_q5`/`faq_a5`
- **footer:** `footer_tagline`, `footer_link_try`, `footer_link_visualizer`, `footer_link_montage`, `footer_link_pricing`, `footer_link_faq`

**Frozen literals (NOT messages):** "Lyric Studio", "Founder", "$0/$24/$39", "16:9/9:16/1:1", "01/02/03", platform names, "MP4/WebM", "Pro", route hrefs.

## 8. Static metadata (`src/app.html`) (DECISION D2 — for approval)

- `src/app.html` keeps the **English** static `<title>`/description/OG/Twitter meta as the non-JS crawler fallback (unchanged from Slice 1.5).
- For JS visitors, `/`'s `<svelte:head>` sets `<title>`/description from `m.meta_title()`/`m.meta_description()` (current locale).
- **Localized crawler metadata** + `hreflang` needs per-locale prerendered routes (the Path A `url` strategy, §4) — **deferred** as SEO follow-up.

## 9. Language selector (design)

- Compact, polished, consistent with the gold-on-green aesthetic; not a settings panel.
- **`LanguageSwitcher.svelte`** (new) modeled on the reference repos' switcher but restyled: a small button showing the active language's native label + a chevron, opening a compact dropdown of the three locales; `currentLocale = $state(getLocale())` updated via `$effect`; selecting calls `setLocale(code)` (reload). Closes on outside-click.
- **Mobile:** the dropdown (anchored, `z`-managed) does not widen the header; on very narrow widths the trigger collapses to a globe/▾ icon with the label hidden (`sr-only`). The three header nav anchors + CTA remain uncrowded.
- **A11y:** trigger has `aria-label` from `header_language`; open state via `aria-expanded`; active option marked (`aria-current`); full keyboard operation.
- **Placement this slice:** landing header only. (`/studio` etc. get a switcher when those surfaces are localized — follow-up.)

## 10. Testing & verification

**Unit (Vitest):**
- Paraglide owns locale resolution, so there is little bespoke logic to test. Test the **reserve `mailto:` builder**: with the default (base `en`) locale, `buildMailtoFallback(email, note)` returns a `mailto:` whose subject/body use the `m.reserve_mailto_*()` strings and include the email + note (or the "unspecified" label when empty). (Optionally assert it switches when `setLocale('ms')` is set in the test.)
- Keep the existing `reserve-client` validation/fetch/fallback tests; adapt only where the mailto strings changed.
- Message/locale completeness is enforced by `paraglide-js compile` (warns on missing keys) + `pnpm check`.

**Project gates:** `paraglide-js compile` (no errors), `pnpm check` (0/0), `pnpm test` (green), `pnpm build` (clean).

**Browser (each of `en`, `ms`, `id`):**
- Switcher flips **all** landing copy (every section + reserve form + FAQ + footer + document title).
- Choice **persists across reload** (localStorage strategy).
- First-visit `preferredLanguage` (client-side = `navigator.languages`, NOT a server `Accept-Language` header): a browser whose context locale is `ms` (or `navigator.languages` overridden) shows Malay on first load with no stored preference; a locale outside `[en,ms,id]` → `en`.
- **No FOUC** — reloaded/visited page paints directly in the resolved locale.
- In-app links keep the correct **`base`** (CF root vs GH `/lyricvideo`); reserve form still submits / falls back to a **localized** `mailto:`; invalid email shows the localized error.
- No new console errors beyond the known favicon 404.
- Mobile: switcher doesn't crowd the nav.

## 11. Risks & mitigations

- **Generated `src/lib/paraglide/` and CI ordering** → gitignore the generated output (as the reference repos do — Paraglide writes an inner `.gitignore`), and prepend `paraglide-js compile` to the `check`/`build` scripts + a `postinstall: "paraglide-js compile"`, so `pnpm check`/local/CI always regenerate it before svelte-check/vite. No generated code in commits.
- **`setLocale` reload UX** → acceptable on a marketing page; localStorage read at init keeps the reload flash-free.
- **`preferredLanguage` surprising a user** → explicit `setLocale` always wins and persists; auto-detect only applies with no stored choice.
- **Translation quality (`ms`/`id`)** → native per-locale, brand tokens frozen, **user copy-review gate** on each (the user has explicit Malaysian-BM standards); `id` kept distinct from `ms`.
- **Scope creep** → only landing components, `src/routes/+page.svelte`, and `reserve-client.ts` change; product routes, the reserve Function, Stripe, `app.html` meta, `svelte.config.js`, `vite.config.ts` (except adding the plugin) are untouched.

## 12. Non-goals

No product-UI translation (`/studio`, `/visualizer`, `/montage`, `/dev/*`); no locale routes this slice (Path A is a follow-up); no localized crawler meta this slice; no accounts/DB/server negotiation; no change to the reserve Function, Stripe/license/gating; no external i18n lib beyond Paraglide.

## 13. Decisions needing your approval

- **D1 — Strategy:** Paraglide client strategy `['localStorage','preferredLanguage','baseLocale']`, **no locale routes** (Path A `url`/locale-paths documented as the SEO follow-up). Includes **first-visit `preferredLanguage` auto-detect** — flag if you want it removed.
- **D2 — `app.html` static meta stays English**; JS visitors get localized `<svelte:head>`; localized crawler meta deferred.
- **D3 — Gitignore the generated `src/lib/paraglide/`** (match the reference repos, which self-ignore it via Paraglide's inner `.gitignore`) and regenerate via the `check`/`build`/`postinstall` compile. *(Corrected during Task 1: the reference repos do NOT commit the output as rev-2 originally claimed — `git ls-files` shows 0 tracked there. Gitignoring is the faithful match.)*
- **D4 — Switcher = native-label dropdown** modeled on the repos' `LanguageSwitcher`, restyled gold-on-green; landing header only.
- **D5 — Reserve `mailto:` localized** via `m.reserve_mailto_*` messages.

If you approve (or adjust) these, the implementation plan follows: install/config Paraglide → en messages → ms → id → wire `m.*` into each landing component → LanguageSwitcher → localized reserve form + mailto → localized `<svelte:head>` → browser verification.

## 14. Verification findings & follow-ups (Task 10, 2026-06-08)

Browser verification (Playwright, preview at `/lyricvideo/`) confirmed all functional i18n behavior: default→en, UI switch flips every section + `document.title` for ms/id, reload persistence, first-visit `navigator.languages` auto-detect (ms→Malay, unsupported→English), localized `mailto:` fallback + invalid-email error, console clean (favicon 404 only). Three items were observed and **deferred** (none block this slice):

- **F1 — Mobile header overflow (`<640px`). ✅ RESOLVED (follow-up, branch `feat/landing-mobile-nav`).** The landing `SiteHeader` nav (brand + 3 links + switcher + "Open studio" CTA, all inline, `gap-5`, no wrap/hamburger) was desktop-first and exceeded a 375–390px viewport — the CTA clipped off the right edge (pre-existing; ~388px wide even with the switcher hidden). Fixed by: (a) Task 10 compact switcher code (EN/MS/ID) below `sm`; (b) this follow-up hides the three secondary anchor links below `sm` (they remain in the footer + page scroll) and shortens the CTA to "Studio" (`header_open_studio_short`, en/ms/id). Verified no header overflow at 320–414px in all three locales; desktop unchanged. (Note: a separate ~24px *page-body* overflow persists at ≤320px from a non-header element — pre-existing, unrelated to the header, not addressed here.)
- **F2 — `<html lang>` stays `"en"`. ✅ RESOLVED client-only (branch `feat/landing-i18n-meta`).** `src/routes/+layout.svelte` now sets `document.documentElement.lang = getLocale()` in a client `$effect` (app-wide; locale fixed per load since `setLocale` reloads). No-JS crawlers still see `lang="en"` from `app.html` (intended fallback); JS visitors + JS-rendering crawlers get the correct locale.
- **F3 — Two `<meta name="description">` tags. ✅ RESOLVED client-only (branch `feat/landing-i18n-meta`).** `app.html`'s static English description is marked `data-static-fallback`; the landing `+page.svelte` removes it on hydration (browser-guarded, idempotent), leaving its single localized `<svelte:head>` description. Net: no-JS → one English description (fallback); JS → one localized description. OG/Twitter tags stay English (social unfurlers don't run the SPA). `<title>` already deduped.

### Decision: client-only F2/F3, localized-crawler SEO deferred (2026-06-09)

lyricvideo is a pure client SPA (`+layout.ts` `ssr=false`/`prerender=false`; product routes need browser-only APIs) deployed statically to CF Pages + GH Pages — so the reference repos' SSR-based Path A (adapter-cloudflare + `reroute` + server `transformPageChunk`) does **not** transfer. F2/F3 were fixed client-side only (above): correct signals for users and JS-rendering crawlers, English `app.html` fallback preserved for no-JS crawlers/social unfurls. **True crawler-visible localized pages** (per-locale URLs `/`,`/ms`,`/id`, prerendered HTML with baked-in `lang`/title/description + `hreflang`) remain a deferred **Path A slice** — it would require selectively re-enabling SSR+prerender for the landing route, a server hook, the `url` strategy + reroute, a switcher rewrite, and solving the CF-root vs GH-`/lyricvideo` base split. Deferred until commercial validation justifies that architecture work.
