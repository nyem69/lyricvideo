# Lyric Studio — Slice 1 (Landing + Reserve) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a commercial landing page for "Lyric Studio" at `/` with an email "reserve founder access" capture (no charge), while moving the existing editor to `/studio`.

**Architecture:** SvelteKit (adapter-static) marketing page composed of focused section components; pure logic extracted into testable modules (`src/lib/...`). A Cloudflare Pages Function `functions/api/reserve.ts` stores reservations in KV; the reserve form is progressive-enhancement with a `mailto:` fallback so it degrades gracefully where Functions don't run (GitHub Pages mirror). Spec: `docs/superpowers/specs/2026-06-08-lyric-studio-commercialization-design.md`.

**Tech Stack:** SvelteKit 2 / Svelte 5 (runes), Tailwind v4 (`@theme` tokens already define `--color-gold`, `--color-surface`, `--color-audio`), Vitest (pure logic), Playwright MCP (UI verification), Cloudflare Pages Functions + KV, Resend (optional confirmation email).

**Conventions carried from the codebase:**
- New links MUST use `base` from `$app/paths` (NOT `import.meta.env.BASE_URL` — it doubles the subpath).
- Local dev runs on port **5310** (`vite.config.ts`, `strictPort`). Use `pnpm dev` then drive the URL `http://localhost:5310/lyricvideo/...`.
- Build/verify recipe: `pnpm build` then `pnpm preview --port <free>`; Playwright MCP screenshots land in `~/.jinn` (read then delete).
- `pnpm check` must stay 0/0 and `pnpm test` green after every task.

**Working-tree discipline (CRITICAL — the tree is dirty at plan time):**
- The repo currently has **unrelated uncommitted changes** that must NOT be swept into this slice:
  visualizer polish (`src/app.css`, `src/lib/components/Visualizer/*`, `src/lib/renderer/visualizer-renderer.ts`,
  `src/routes/montage/+page.svelte`, `src/routes/visualizer/+page.svelte`), the `vite.config.ts` dev-port change,
  and deleted `extracted-*.txt` / `karabatan*.srt` artifacts.
- **Whole-file `git add <path>` is only safe on files with NO pre-existing modifications.** `montage/+page.svelte`
  and `visualizer/+page.svelte` are already dirty AND are edited by Task 1 — they must be cleaned first (Task 0).
- **Rule:** for any file a task touches that still has unrelated pre-existing edits, use `git add -p` (hunk staging),
  never whole-file. Every commit stages an explicit file list — never `git add -A` / `git add .`.

---

## File Structure

**Create:**
- `src/routes/studio/+page.svelte` — the moved editor (was `/`)
- `src/lib/landing/reserve-client.ts` — browser reserve logic (validate, submit, mailto fallback)
- `src/lib/landing/reserve-client.test.ts` — unit tests
- `src/lib/server/reserve-logic.ts` — framework-agnostic reserve decision logic (shared with the Function)
- `src/lib/server/reserve-logic.test.ts` — unit tests
- `src/lib/components/Landing/ReserveForm.svelte`
- `src/lib/components/Landing/ReserveSection.svelte`
- `src/lib/components/Landing/HeroDemo.svelte`
- `src/lib/components/Landing/Hero.svelte`
- `src/lib/components/Landing/SiteHeader.svelte`
- `src/lib/components/Landing/SiteFooter.svelte`
- `src/lib/components/Landing/TrustStrip.svelte`
- `src/lib/components/Landing/HowItWorks.svelte`
- `src/lib/components/Landing/ToolsTrio.svelte`
- `src/lib/components/Landing/Formats.svelte`
- `src/lib/components/Landing/Pricing.svelte`
- `src/lib/components/Landing/Faq.svelte`
- `functions/api/reserve.ts` — CF Pages Function (POST handler)
- `static/_routes.json` — limits Function invocation to `/api/*`

**Modify:**
- `src/routes/+page.svelte` — becomes the landing page (was the editor)
- `src/routes/visualizer/+page.svelte` — nav cross-links → `/studio` via `base`
- `src/routes/montage/+page.svelte` — nav cross-links → `/studio` via `base`
- `src/app.html` — add Fraunces font (used for hero italic accents)

---

## Task 0: Pre-flight — isolate the dirty tree (do this FIRST)

**Why:** Task 1 edits `montage/+page.svelte` and `visualizer/+page.svelte`, which already carry unrelated
visualizer-polish edits. We must bake those in (their own commit) BEFORE Task 1 so Task 1's whole-file
staging can't sweep them into the commercialization slice. Non-overlapping leftovers stay out of this slice.

- [ ] **Step 1: Inspect the working tree**

Run: `git status --short`
Expected (or similar): modified `src/app.css`, `src/lib/components/Visualizer/{ExportButton,FormatPicker,VisualizerStage,VizStylePicker}.svelte`, `src/lib/renderer/visualizer-renderer.ts`, `src/routes/montage/+page.svelte`, `src/routes/visualizer/+page.svelte`, `vite.config.ts`; deleted `extracted-*.txt`, `karabatan*.srt`.

- [ ] **Step 2: Commit the visualizer polish as its OWN commit (explicit file list)**

This is the critical isolation step — it removes the overlap on the two route files.

```bash
git add src/app.css \
        src/lib/components/Visualizer/ExportButton.svelte \
        src/lib/components/Visualizer/FormatPicker.svelte \
        src/lib/components/Visualizer/VisualizerStage.svelte \
        src/lib/components/Visualizer/VizStylePicker.svelte \
        src/lib/renderer/visualizer-renderer.ts \
        src/routes/montage/+page.svelte \
        src/routes/visualizer/+page.svelte
git commit -m "feat(visualizer): UI polish (stage frame, teal audio accent, idle shimmer, export states, collapsible format)"
```

(If the user would rather keep this work uncommitted, the only safe alternative is to `git add -p` those two
route files in Task 1 instead of whole-file — but committing here is cleaner and is the recommended path.)

- [ ] **Step 3: Leave non-overlapping leftovers out of scope**

`vite.config.ts` (dev-port pin) and the deleted `extracted-*.txt` / `karabatan*.srt` artifacts do NOT overlap
any file in this slice. Leave them as-is — no task in this plan stages them. (The user may commit/handle them
separately; they will simply remain in `git status` and that is expected.)

- [ ] **Step 4: Confirm the slice can start clean**

Run: `git status --short`
Expected: the visualizer-polish files no longer appear; only `vite.config.ts` (M) and the deleted artifacts (D) remain.
Now Task 1 can whole-file stage `montage/+page.svelte` and `visualizer/+page.svelte` safely.

---

## Task 1: Move the editor from `/` to `/studio`

**Files:**
- Create: `src/routes/studio/+page.svelte`
- Modify: `src/routes/+page.svelte` (temporary redirect), `src/routes/visualizer/+page.svelte`, `src/routes/montage/+page.svelte`

- [ ] **Step 1: Create `/studio` with the current editor markup**

Copy the entire current contents of `src/routes/+page.svelte` into a new file `src/routes/studio/+page.svelte`. Then change its two header nav links to use `base`. At the top of `<script>` add:

```svelte
  import { base } from '$app/paths';
```

Replace the two header links so they read:

```svelte
      <a href="{base}/visualizer" class="text-gold/40 hover:text-gold text-xs uppercase tracking-wider">Audio Visualizer →</a>
      <a href="{base}/montage" class="text-gold/40 hover:text-gold text-xs uppercase tracking-wider">Photo montage →</a>
```

- [ ] **Step 2: Replace `/` with a temporary redirect to `/studio`**

Overwrite `src/routes/+page.svelte` with a minimal redirect (the real landing replaces this in Task 8):

```svelte
<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  onMount(() => { goto(`${base}/studio`, { replaceState: true }); });
</script>

<p style="padding:2rem;color:#888">Redirecting to the studio…</p>
```

- [ ] **Step 3: Rewire visualizer + montage cross-links to `/studio`**

In `src/routes/visualizer/+page.svelte`, the header has a single "Photo montage →" link. Leave it but confirm it uses `base` (it already does). No "home" link exists there — add one pointing to the studio. Replace the header's link group so it reads:

```svelte
    <div class="flex gap-4 items-center">
      <a href="{base}/studio" class="text-gold/40 hover:text-gold text-xs uppercase tracking-wider">← Studio</a>
      <a href="{base}/montage" class="text-gold/40 hover:text-gold text-xs uppercase tracking-wider">Photo montage →</a>
    </div>
```

In `src/routes/montage/+page.svelte`, replace the two existing `import.meta.env.BASE_URL` header links with `base` versions pointing at the studio + visualizer (add `import { base } from '$app/paths';` to its `<script>` if not present):

```svelte
      <a href="{base}/studio" class="text-gold/40 hover:text-gold text-xs uppercase tracking-wider">← Studio</a>
      <a href="{base}/visualizer" class="text-gold/40 hover:text-gold text-xs uppercase tracking-wider">Visualizer →</a>
```

- [ ] **Step 4: Type-check and build**

Run: `pnpm check && pnpm build`
Expected: 0 errors, build succeeds (routes `/`, `/studio`, `/visualizer`, `/montage` all present in output).

- [ ] **Step 5: Browser-verify the move**

Run: `pnpm preview --port 5320` then drive Playwright:
- Navigate `http://localhost:5320/lyricvideo/` → should redirect to `/lyricvideo/studio` and show the editor (LyricsImport + StylePicker + player).
- Navigate `http://localhost:5320/lyricvideo/visualizer` → "← Studio" link present and points to `/lyricvideo/studio`.
Expected: editor loads at `/studio`; no console errors beyond the known favicon 404.

- [ ] **Step 6: Commit**

```bash
git add src/routes/studio/+page.svelte src/routes/+page.svelte src/routes/visualizer/+page.svelte src/routes/montage/+page.svelte
git commit -m "refactor(routes): move editor to /studio, temp redirect at /"
```

---

## Task 2: Reserve client logic + tests (TDD)

**Files:**
- Create: `src/lib/landing/reserve-client.ts`
- Test: `src/lib/landing/reserve-client.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/landing/reserve-client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { validateEmail, buildMailtoFallback, submitReserve } from './reserve-client';

describe('validateEmail', () => {
  it('accepts a normal address', () => expect(validateEmail('a@b.co')).toBe(true));
  it('rejects missing @', () => expect(validateEmail('ab.co')).toBe(false));
  it('rejects empty', () => expect(validateEmail('   ')).toBe(false));
});

describe('buildMailtoFallback', () => {
  it('encodes email + note into a mailto url', () => {
    const url = buildMailtoFallback('me@x.com', 'a reggae video');
    expect(url.startsWith('mailto:')).toBe(true);
    expect(url).toContain('subject=');
    expect(decodeURIComponent(url)).toContain('me@x.com');
    expect(decodeURIComponent(url)).toContain('a reggae video');
  });
});

describe('submitReserve', () => {
  it('returns invalid for a bad email without calling fetch', async () => {
    const fetchSpy = vi.fn();
    const r = await submitReserve({ email: 'nope', note: '', hp: '' }, { fetch: fetchSpy as any });
    expect(r.ok).toBe(false);
    expect(r.invalid).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns ok when the endpoint returns ok:true', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const r = await submitReserve({ email: 'me@x.com', note: 'hi', hp: '' }, { fetch: fetchSpy as any });
    expect(r.ok).toBe(true);
  });

  it('falls back to mailto when the endpoint is missing (non-OK)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    const r = await submitReserve({ email: 'me@x.com', note: 'hi', hp: '' }, { fetch: fetchSpy as any });
    expect(r.ok).toBe(false);
    expect(r.fallback?.startsWith('mailto:')).toBe(true);
  });

  it('falls back to mailto when the endpoint returns 200 but non-JSON (SPA fallback HTML)', async () => {
    // On a static preview / GitHub Pages mirror, /api/reserve returns the SPA
    // index.html with HTTP 200 — res.ok is true but res.json() throws. Must fall back.
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token <'); }
    });
    const r = await submitReserve({ email: 'me@x.com', note: 'hi', hp: '' }, { fetch: fetchSpy as any });
    expect(r.ok).toBe(false);
    expect(r.fallback?.startsWith('mailto:')).toBe(true);
  });

  it('falls back to mailto when fetch throws', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('network'));
    const r = await submitReserve({ email: 'me@x.com', note: '', hp: '' }, { fetch: fetchSpy as any });
    expect(r.ok).toBe(false);
    expect(r.fallback?.startsWith('mailto:')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/landing/reserve-client.test.ts`
Expected: FAIL — `reserve-client` module not found.

- [ ] **Step 3: Implement the module**

```ts
// src/lib/landing/reserve-client.ts

// Fallback inbox used when the /api/reserve Function isn't reachable (e.g. the
// GitHub Pages static mirror, or before the Function is deployed). NEVER a personal
// address — defaults to a branded inbox and can be overridden at build time via
// VITE_FOUNDER_INBOX (set in CF Pages env / .env). Set up the mailbox before launch.
const FOUNDER_INBOX = import.meta.env.VITE_FOUNDER_INBOX ?? 'founders@lyricstudio.app';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function buildMailtoFallback(email: string, note: string): string {
  const subject = 'Reserve founder access — Lyric Studio';
  const body = `Email: ${email}\nWhat I'll make: ${note || '(not specified)'}`;
  return `mailto:${FOUNDER_INBOX}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export interface ReserveInput {
  email: string;
  note: string;
  hp: string; // honeypot — must stay empty for real users
}

export interface ReserveResult {
  ok: boolean;
  invalid?: boolean;   // client-side validation failed (no request made)
  fallback?: string;   // a mailto: url to fall back to when the endpoint is unavailable
}

export async function submitReserve(
  input: ReserveInput,
  deps: { fetch?: typeof fetch } = {}
): Promise<ReserveResult> {
  const email = input.email.trim();
  if (!validateEmail(email)) return { ok: false, invalid: true };

  const doFetch = deps.fetch ?? fetch;
  try {
    const res = await doFetch('/api/reserve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, note: input.note.trim(), hp: input.hp })
    });
    if (!res.ok) return { ok: false, fallback: buildMailtoFallback(email, input.note) };
    const data = await res.json().catch(() => ({}));
    if (data && data.ok) return { ok: true };
    return { ok: false, fallback: buildMailtoFallback(email, input.note) };
  } catch {
    return { ok: false, fallback: buildMailtoFallback(email, input.note) };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/landing/reserve-client.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/landing/reserve-client.ts src/lib/landing/reserve-client.test.ts
git commit -m "feat(landing): reserve client logic with mailto fallback"
```

---

## Task 3: ReserveForm + ReserveSection components

**Files:**
- Create: `src/lib/components/Landing/ReserveForm.svelte`, `src/lib/components/Landing/ReserveSection.svelte`

- [ ] **Step 1: Create `ReserveForm.svelte`**

```svelte
<!-- src/lib/components/Landing/ReserveForm.svelte -->
<script lang="ts">
  import { submitReserve } from '$lib/landing/reserve-client';

  let email = $state('');
  let note = $state('');
  let hp = $state(''); // honeypot
  let state = $state<'idle' | 'submitting' | 'success' | 'error'>('idle');
  let errorMsg = $state('');
  let fallbackUrl = $state('');

  async function onSubmit(e: Event) {
    e.preventDefault();
    if (state === 'submitting') return;
    state = 'submitting';
    errorMsg = '';
    fallbackUrl = '';
    const r = await submitReserve({ email, note, hp });
    if (r.ok) {
      state = 'success';
    } else if (r.invalid) {
      state = 'error';
      errorMsg = 'Please enter a valid email address.';
    } else {
      // endpoint unavailable — offer the mailto fallback so no reservation is lost
      state = 'error';
      errorMsg = 'Could not reach our list. Tap below to reserve by email instead.';
      fallbackUrl = r.fallback ?? '';
    }
  }
</script>

{#if state === 'success'}
  <div class="rounded-xl border border-audio/40 bg-audio/10 p-6 text-center">
    <p class="text-audio font-semibold" style="font-family:'Raleway',sans-serif">You're on the Founder list.</p>
    <p class="text-white/70 text-sm mt-1">Your $24 early price is reserved. We'll email you when Founder access opens.</p>
  </div>
{:else}
  <form onsubmit={onSubmit} class="flex flex-col gap-3" novalidate>
    <!-- honeypot: hidden from humans, bots fill it -->
    <input
      bind:value={hp}
      name="company"
      tabindex="-1"
      autocomplete="off"
      aria-hidden="true"
      class="absolute left-[-9999px] h-0 w-0 opacity-0"
    />
    <input
      bind:value={email}
      type="email"
      required
      placeholder="you@email.com"
      aria-label="Email address"
      class="w-full bg-white/5 border border-gold/25 rounded-lg px-4 py-3 text-white/90 placeholder:text-white/30 focus:outline-none focus:border-gold/60"
    />
    <textarea
      bind:value={note}
      rows="2"
      placeholder="What will you make? (optional)"
      aria-label="What will you make"
      class="w-full bg-white/5 border border-gold/20 rounded-lg px-4 py-3 text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-gold/50 resize-y"
    ></textarea>
    <button
      type="submit"
      disabled={state === 'submitting'}
      class="bg-gold text-surface font-semibold px-5 py-3 rounded-lg tracking-wide uppercase text-sm hover:bg-gold/90 disabled:opacity-60 disabled:cursor-wait transition-all"
      style="font-family:'Raleway',sans-serif"
    >
      {state === 'submitting' ? 'Reserving…' : 'Reserve my $24 founder price'}
    </button>
    <p class="text-xs text-white/40 text-center">No charge today. We'll email you when Founder access opens.</p>
    {#if state === 'error'}
      <p class="text-sm text-red-300 text-center">{errorMsg}</p>
      {#if fallbackUrl}
        <a href={fallbackUrl} class="text-sm text-audio underline text-center">Reserve by email →</a>
      {/if}
    {/if}
  </form>
{/if}
```

- [ ] **Step 2: Create `ReserveSection.svelte`**

```svelte
<!-- src/lib/components/Landing/ReserveSection.svelte -->
<script lang="ts">
  import ReserveForm from './ReserveForm.svelte';
</script>

<section id="reserve" class="px-6 py-20 border-t border-gold/10">
  <div class="max-w-xl mx-auto text-center">
    <p class="text-xs tracking-[0.3em] uppercase text-gold/60" style="font-family:'Raleway',sans-serif">Founder access</p>
    <h2 class="mt-3 text-3xl md:text-4xl text-white" style="font-family:'Playfair Display',serif">
      Reserve your <span class="text-gold">$24</span> founder price
    </h2>
    <p class="mt-3 text-white/55">Lock in lifetime access at the early price. Pro features roll out over the coming weeks — founders get them all.</p>
    <div class="mt-8 text-left">
      <ReserveForm />
    </div>
  </div>
</section>
```

- [ ] **Step 3: Type-check**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/Landing/ReserveForm.svelte src/lib/components/Landing/ReserveSection.svelte
git commit -m "feat(landing): reserve form + section with success/error/fallback states"
```

---

## Task 4: HeroDemo + Hero components

**Files:**
- Create: `src/lib/components/Landing/HeroDemo.svelte`, `src/lib/components/Landing/Hero.svelte`
- Modify: `src/app.html` (add Fraunces font)

- [ ] **Step 1: Add the Fraunces font to `src/app.html`**

In `src/app.html`, replace the existing Google Fonts `<link href="https://fonts.googleapis.com/css2?...">` line with one that also requests Fraunces italic:

```html
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,500&family=Great+Vibes&family=Bebas+Neue&family=Fraunces:ital,opsz,wght@1,9..144,500&family=Raleway:wght@100;200;300;400;600&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Create `HeroDemo.svelte` (animated 16:9 demo)**

```svelte
<!-- src/lib/components/Landing/HeroDemo.svelte -->
<!-- A CSS-only stand-in for the product: a synced lyric line over a reactive
     equalizer, inside a 16:9 "video frame". Pure presentation, respects
     prefers-reduced-motion. -->
<script lang="ts">
  const bars = Array.from({ length: 28 }, (_, i) => i);
</script>

<div class="relative w-full rounded-xl overflow-hidden ring-1 ring-gold/20 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.85)]"
     style="aspect-ratio:16/9;background:radial-gradient(90% 120% at 50% 120%, rgba(212,175,55,.18), transparent 60%), #0a1a0a">
  <div class="absolute inset-0 flex items-center justify-center px-8 text-center">
    <p class="lyric text-white" style="font-family:'Fraunces',serif;font-style:italic;font-size:clamp(20px,3vw,34px)">
      sembah berlalu, <span class="text-white/35">tinggal bayang…</span>
    </p>
  </div>
  <div class="eq absolute bottom-0 left-0 right-0 flex items-end gap-[3px] h-16 px-3 opacity-90">
    {#each bars as i}
      <span class="flex-1 rounded-t-sm" style="background:linear-gradient(#46d6c8,#d4af37);animation-delay:{(i % 7) * 0.09}s"></span>
    {/each}
  </div>
  <div class="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/40 px-2.5 py-1 ring-1 ring-white/10 backdrop-blur-sm">
    <span class="h-1.5 w-1.5 rounded-full bg-audio shadow-[0_0_6px_var(--color-audio)]"></span>
    <span class="text-[9px] tracking-[0.2em] uppercase text-audio" style="font-family:'Raleway',sans-serif">Preview</span>
  </div>
</div>

<style>
  .eq span { height: 20%; animation: bar 1s ease-in-out infinite; }
  @keyframes bar { 0%, 100% { height: 18%; } 50% { height: 92%; } }
  .lyric { animation: fade 4s ease-in-out infinite; }
  @keyframes fade { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    .eq span { animation: none; height: 55%; }
    .lyric { animation: none; opacity: 1; }
  }
</style>
```

- [ ] **Step 3: Create `Hero.svelte`**

```svelte
<!-- src/lib/components/Landing/Hero.svelte -->
<script lang="ts">
  import { base } from '$app/paths';
  import HeroDemo from './HeroDemo.svelte';
</script>

<section class="px-6 pt-16 pb-12 md:pt-24 md:pb-16">
  <div class="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
    <div>
      <p class="text-xs tracking-[0.3em] uppercase text-gold/70" style="font-family:'Raleway',sans-serif">Lyric videos · in your browser</p>
      <h1 class="mt-4 text-4xl md:text-6xl leading-[1.05] text-[#fbf4e2]" style="font-family:'Playfair Display',serif;font-weight:900">
        Turn your song into a <span style="font-family:'Fraunces',serif;font-style:italic" class="text-audio">video</span> people watch.
      </h1>
      <p class="mt-5 text-white/60 text-lg max-w-md leading-relaxed">
        Synced lyrics, audio visualizers and photo montages — exported in minutes. No editor, no upload, free to start.
      </p>
      <div class="mt-7 flex flex-wrap gap-3">
        <a href="#reserve" class="bg-gold text-surface font-semibold text-sm px-6 py-3.5 rounded-lg shadow-[0_10px_30px_-10px_var(--color-gold)] hover:bg-gold/90 transition-all" style="font-family:'Raleway',sans-serif">Reserve founder access · $24</a>
        <a href="{base}/studio" class="text-gold text-sm px-6 py-3.5 rounded-lg border border-gold/30 hover:border-gold/60 transition-all" style="font-family:'Raleway',sans-serif">Try it free →</a>
      </div>
      <p class="mt-6 flex items-center gap-2 text-sm text-audio/90">
        <span class="h-1.5 w-1.5 rounded-full bg-audio shadow-[0_0_8px_var(--color-audio)]"></span>
        Runs entirely in your browser — your unreleased track never leaves your device.
      </p>
    </div>
    <HeroDemo />
  </div>
</section>
```

- [ ] **Step 4: Type-check and build**

Run: `pnpm check && pnpm build`
Expected: 0 errors, build OK.

- [ ] **Step 5: Commit**

```bash
git add src/app.html src/lib/components/Landing/HeroDemo.svelte src/lib/components/Landing/Hero.svelte
git commit -m "feat(landing): hero with animated 16:9 demo + Fraunces font"
```

---

## Task 5: Chrome — SiteHeader, SiteFooter, TrustStrip

**Files:**
- Create: `src/lib/components/Landing/SiteHeader.svelte`, `SiteFooter.svelte`, `TrustStrip.svelte`

- [ ] **Step 1: Create `SiteHeader.svelte`**

```svelte
<!-- src/lib/components/Landing/SiteHeader.svelte -->
<script lang="ts">
  import { base } from '$app/paths';
</script>

<header class="flex items-center justify-between px-6 py-4 border-b border-gold/10">
  <a href="{base}/" class="text-gold text-lg tracking-[0.3em] uppercase" style="font-family:'Raleway',sans-serif">Lyric Studio</a>
  <nav class="flex gap-5 items-center text-xs uppercase tracking-wider">
    <a href="#features" class="text-gold/40 hover:text-gold transition-colors">Features</a>
    <a href="#pricing" class="text-gold/40 hover:text-gold transition-colors">Pricing</a>
    <a href="#faq" class="text-gold/40 hover:text-gold transition-colors">FAQ</a>
    <a href="{base}/studio" class="bg-gold/15 border border-gold/30 text-gold px-4 py-2 rounded hover:bg-gold/30 transition-all">Open the studio</a>
  </nav>
</header>
```

- [ ] **Step 2: Create `TrustStrip.svelte`**

```svelte
<!-- src/lib/components/Landing/TrustStrip.svelte -->
<div class="px-6 py-5 border-y border-gold/10 bg-white/[0.02]">
  <div class="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-2 text-xs uppercase tracking-[0.18em] text-white/45" style="font-family:'Raleway',sans-serif">
    <span>100% browser-based</span>
    <span class="text-gold/30">·</span>
    <span>No upload</span>
    <span class="text-gold/30">·</span>
    <span>No account to start</span>
  </div>
</div>
```

- [ ] **Step 3: Create `SiteFooter.svelte`**

```svelte
<!-- src/lib/components/Landing/SiteFooter.svelte -->
<script lang="ts">
  import { base } from '$app/paths';
</script>

<footer class="px-6 py-10 border-t border-gold/10 text-sm text-white/40">
  <div class="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
    <span style="font-family:'Playfair Display',serif" class="text-white/60">Lyric Studio — made for indie artists.</span>
    <nav class="flex gap-5">
      <a href="{base}/studio" class="hover:text-gold transition-colors">Try it free</a>
      <a href="{base}/visualizer" class="hover:text-gold transition-colors">Visualizer</a>
      <a href="{base}/montage" class="hover:text-gold transition-colors">Montage</a>
      <a href="#pricing" class="hover:text-gold transition-colors">Pricing</a>
      <a href="#faq" class="hover:text-gold transition-colors">FAQ</a>
    </nav>
  </div>
</footer>
```

- [ ] **Step 4: Type-check**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Landing/SiteHeader.svelte src/lib/components/Landing/TrustStrip.svelte src/lib/components/Landing/SiteFooter.svelte
git commit -m "feat(landing): site header, trust strip, footer"
```

---

## Task 6: HowItWorks, ToolsTrio, Formats

**Files:**
- Create: `src/lib/components/Landing/HowItWorks.svelte`, `ToolsTrio.svelte`, `Formats.svelte`

- [ ] **Step 1: Create `HowItWorks.svelte`**

```svelte
<!-- src/lib/components/Landing/HowItWorks.svelte -->
<script lang="ts">
  const steps = [
    { n: '01', t: 'Paste lyrics or drop your song', d: 'Bring timestamped lyrics, or just your audio file — everything stays on your device.' },
    { n: '02', t: 'Pick a style, format and colours', d: 'Lyric card, visualizer or montage. Choose 16:9, 9:16 or 1:1.' },
    { n: '03', t: 'Export, ready to post', d: 'Render an MP4/WebM in your browser and upload it anywhere.' }
  ];
</script>

<section class="px-6 py-16">
  <div class="max-w-5xl mx-auto">
    <h2 class="text-center text-3xl text-white mb-12" style="font-family:'Playfair Display',serif">How it works</h2>
    <div class="grid md:grid-cols-3 gap-8">
      {#each steps as s}
        <div>
          <div class="text-gold/50 text-sm tracking-widest" style="font-family:'Raleway',sans-serif">{s.n}</div>
          <h3 class="mt-2 text-lg text-white" style="font-family:'Playfair Display',serif">{s.t}</h3>
          <p class="mt-2 text-sm text-white/55 leading-relaxed">{s.d}</p>
        </div>
      {/each}
    </div>
  </div>
</section>
```

- [ ] **Step 2: Create `ToolsTrio.svelte`**

```svelte
<!-- src/lib/components/Landing/ToolsTrio.svelte -->
<script lang="ts">
  import { base } from '$app/paths';
  const tools = [
    { t: 'Lyric Video', d: 'Word-perfect, beat-synced lyrics over your art.', href: `${base}/studio` },
    { t: 'Audio Visualizer', d: 'Six reactive styles that move with your music.', href: `${base}/visualizer` },
    { t: 'Photo Montage', d: 'Turn a folder of photos into a timed slideshow.', href: `${base}/montage` }
  ];
</script>

<section id="features" class="px-6 py-16 border-t border-gold/10">
  <div class="max-w-6xl mx-auto">
    <h2 class="text-center text-3xl text-white mb-12" style="font-family:'Playfair Display',serif">Three tools, one studio</h2>
    <div class="grid md:grid-cols-3 gap-6">
      {#each tools as tool}
        <a href={tool.href} class="group rounded-xl border border-gold/15 p-6 hover:border-gold/40 hover:bg-white/[0.02] transition-all">
          <div class="h-24 rounded-lg mb-4 ring-1 ring-gold/10" style="background:radial-gradient(80% 120% at 50% 120%, rgba(70,214,200,.15), transparent 60%), #0a1a0a"></div>
          <h3 class="text-lg text-gold" style="font-family:'Playfair Display',serif">{tool.t}</h3>
          <p class="mt-2 text-sm text-white/55">{tool.d}</p>
          <span class="mt-3 inline-block text-xs uppercase tracking-wider text-gold/50 group-hover:text-gold transition-colors">Open →</span>
        </a>
      {/each}
    </div>
  </div>
</section>
```

- [ ] **Step 3: Create `Formats.svelte`**

```svelte
<!-- src/lib/components/Landing/Formats.svelte -->
<script lang="ts">
  const formats = [
    { label: 'YouTube', ratio: '16 / 9', sub: '16:9' },
    { label: 'TikTok / Reels', ratio: '9 / 16', sub: '9:16' },
    { label: 'Instagram', ratio: '1 / 1', sub: '1:1' }
  ];
</script>

<section class="px-6 py-16">
  <div class="max-w-4xl mx-auto text-center">
    <h2 class="text-3xl text-white" style="font-family:'Playfair Display',serif">Made for every platform</h2>
    <p class="mt-3 text-white/55">Export the exact aspect ratio each platform wants — or set a custom size.</p>
    <div class="mt-10 flex items-end justify-center gap-8">
      {#each formats as f}
        <div class="flex flex-col items-center gap-2">
          <div class="w-24 ring-1 ring-gold/25 rounded bg-white/[0.03]" style="aspect-ratio:{f.ratio}"></div>
          <span class="text-sm text-white/70" style="font-family:'Raleway',sans-serif">{f.label}</span>
          <span class="text-xs text-gold/50">{f.sub}</span>
        </div>
      {/each}
    </div>
  </div>
</section>
```

- [ ] **Step 4: Type-check**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Landing/HowItWorks.svelte src/lib/components/Landing/ToolsTrio.svelte src/lib/components/Landing/Formats.svelte
git commit -m "feat(landing): how-it-works, tools trio, formats sections"
```

---

## Task 7: Pricing + Faq

**Files:**
- Create: `src/lib/components/Landing/Pricing.svelte`, `Faq.svelte`

- [ ] **Step 1: Create `Pricing.svelte`**

```svelte
<!-- src/lib/components/Landing/Pricing.svelte -->
<script lang="ts">
  const free = ['All three tools', '720p export', 'Small watermark', 'YouTube 16:9 only', '2 visualizer styles'];
  const pro = ['Everything in Free, plus:', '1080p export', 'No watermark', 'All formats (9:16, 1:1, custom)', 'All 6 visualizer styles', 'All future Pro features'];
</script>

<section id="pricing" class="px-6 py-16 border-t border-gold/10">
  <div class="max-w-4xl mx-auto">
    <h2 class="text-center text-3xl text-white mb-3" style="font-family:'Playfair Display',serif">Simple pricing</h2>
    <p class="text-center text-white/55 mb-10">Free to start. Pay once for lifetime Pro — no subscription.</p>
    <div class="grid md:grid-cols-2 gap-6">
      <div class="rounded-2xl border border-gold/15 p-7">
        <h3 class="text-xl text-white" style="font-family:'Playfair Display',serif">Free</h3>
        <p class="mt-1 text-3xl text-white" style="font-family:'Playfair Display',serif">$0</p>
        <ul class="mt-5 space-y-2 text-sm text-white/60">
          {#each free as f}<li>· {f}</li>{/each}
        </ul>
      </div>
      <div class="rounded-2xl border border-gold/50 bg-gold/[0.06] p-7 relative">
        <span class="absolute top-5 right-5 text-[10px] uppercase tracking-widest bg-gold text-surface px-2 py-1 rounded">Founder</span>
        <h3 class="text-xl text-gold" style="font-family:'Playfair Display',serif">Founder's Lifetime</h3>
        <p class="mt-1 text-3xl text-white" style="font-family:'Playfair Display',serif">$24 <span class="text-base text-white/40 line-through">$39</span> <span class="text-sm text-white/50">once</span></p>
        <ul class="mt-5 space-y-2 text-sm text-white/75">
          {#each pro as p}<li>· {p}</li>{/each}
        </ul>
        <a href="#reserve" class="mt-6 block text-center bg-gold text-surface font-semibold px-5 py-3 rounded-lg text-sm uppercase tracking-wide hover:bg-gold/90 transition-all" style="font-family:'Raleway',sans-serif">Reserve founder price</a>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Create `Faq.svelte`**

```svelte
<!-- src/lib/components/Landing/Faq.svelte -->
<script lang="ts">
  const faqs = [
    { q: 'Does my audio or images get uploaded?', a: 'No. Everything runs in your browser — your files never leave your device.' },
    { q: 'What do I get with Founder access?', a: 'Lifetime: 1080p exports, no watermark, every format and visualizer style, plus all future Pro features — one payment, no subscription.' },
    { q: 'Will I be charged today?', a: "No. You're reserving the $24 early price. We'll email you a checkout link when Founder access opens." },
    { q: 'Which formats can I export?', a: '16:9, 9:16, 1:1 and custom sizes.' },
    { q: 'Which browser works best?', a: 'Chrome or Edge give the most reliable video export.' }
  ];
</script>

<section id="faq" class="px-6 py-16 border-t border-gold/10">
  <div class="max-w-2xl mx-auto">
    <h2 class="text-center text-3xl text-white mb-10" style="font-family:'Playfair Display',serif">Questions</h2>
    <div class="flex flex-col gap-3">
      {#each faqs as f}
        <details class="rounded-lg border border-gold/15 px-4 py-3">
          <summary class="cursor-pointer text-white/85 text-sm" style="font-family:'Raleway',sans-serif">{f.q}</summary>
          <p class="mt-2 text-sm text-white/55 leading-relaxed">{f.a}</p>
        </details>
      {/each}
    </div>
  </div>
</section>
```

- [ ] **Step 3: Type-check**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/Landing/Pricing.svelte src/lib/components/Landing/Faq.svelte
git commit -m "feat(landing): pricing table + FAQ"
```

---

## Task 8: Assemble the landing page at `/`

**Files:**
- Modify: `src/routes/+page.svelte` (replace the temporary redirect with the real landing)
- Modify: `src/routes/studio/+page.svelte` (rename the editor header so it doesn't feel like a separate product)

- [ ] **Step 0: Rename the studio header (deferred from Task 1, approved by user)**

Now that `/` is the commercial landing, the editor must read as part of the same product. In
`src/routes/studio/+page.svelte`, change the header `<h1>` text from `Lyrics Video` to `Lyric Studio`
(keep all classes/markup identical — text only). Optionally make the wordmark a link to `{base}/` so users
can get back to the landing. Minimal change: just the `<h1>` text.

- [ ] **Step 1: Replace `/+page.svelte` with the composed landing**

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import SiteHeader from '$lib/components/Landing/SiteHeader.svelte';
  import Hero from '$lib/components/Landing/Hero.svelte';
  import TrustStrip from '$lib/components/Landing/TrustStrip.svelte';
  import HowItWorks from '$lib/components/Landing/HowItWorks.svelte';
  import ToolsTrio from '$lib/components/Landing/ToolsTrio.svelte';
  import Formats from '$lib/components/Landing/Formats.svelte';
  import Pricing from '$lib/components/Landing/Pricing.svelte';
  import ReserveSection from '$lib/components/Landing/ReserveSection.svelte';
  import Faq from '$lib/components/Landing/Faq.svelte';
  import SiteFooter from '$lib/components/Landing/SiteFooter.svelte';
</script>

<svelte:head>
  <title>Lyric Studio — Lyric videos & visualizers in your browser</title>
  <meta name="description" content="Make synced lyric videos, audio visualizers and photo montages in your browser. No upload, no editor, free to start. Built for indie musicians." />
</svelte:head>

<div class="min-h-screen bg-surface text-white" style="scroll-behavior:smooth">
  <SiteHeader />
  <Hero />
  <TrustStrip />
  <HowItWorks />
  <ToolsTrio />
  <Formats />
  <Pricing />
  <ReserveSection />
  <Faq />
  <SiteFooter />
</div>
```

- [ ] **Step 2: Type-check and build**

Run: `pnpm check && pnpm build`
Expected: 0 errors; `build/index.html` is the landing page.

- [ ] **Step 3: Browser-verify the full page + funnel**

Run: `pnpm preview --port 5321` then drive Playwright at `http://localhost:5321/lyricvideo/`:
- Screenshot the page; confirm hero, animated demo, trust strip, sections, pricing, reserve form, FAQ, footer all render in the gold-on-green aesthetic.
- Click "Try it free →" → lands on `/lyricvideo/studio` (editor).
- Click "Reserve founder access · $24" → scrolls to the `#reserve` form.
- In the reserve form, submit `test@example.com`. The static preview has no Function, so `/api/reserve`
  resolves to the **SPA fallback `index.html` (HTTP 200, non-JSON)** — the client treats "endpoint
  unavailable OR non-JSON OR non-OK" identically and shows the **error + "Reserve by email →" mailto
  fallback**. Confirm that fallback appears (proves graceful degradation; this is expected, not a bug).
- Submit an invalid email (`nope`) → expect "Please enter a valid email address."
Expected: all pass; only the known favicon 404 in console.

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.svelte src/routes/studio/+page.svelte
git commit -m "feat(landing): assemble Lyric Studio landing page at / + rename studio header"
```

---

## Task 9: Reserve Function logic + tests (TDD)

**Files:**
- Create: `src/lib/server/reserve-logic.ts`
- Test: `src/lib/server/reserve-logic.test.ts`

(Logic lives under `src/lib/server` so Vitest collects the test and the CF Function imports it via a relative path — keeps one tested source of truth.)

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/server/reserve-logic.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeEmail, isValidEmail, decideReserve } from './reserve-logic';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => expect(normalizeEmail('  Me@X.COM ')).toBe('me@x.com'));
});

describe('isValidEmail', () => {
  it('accepts valid', () => expect(isValidEmail('a@b.co')).toBe(true));
  it('rejects invalid', () => expect(isValidEmail('a@b')).toBe(false));
});

describe('decideReserve', () => {
  it('flags spam when honeypot is filled', () => {
    const d = decideReserve({ email: 'a@b.co', hp: 'bot' }, 'UA', 1000);
    expect(d.status).toBe('spam');
  });
  it('rejects an invalid email', () => {
    const d = decideReserve({ email: 'nope' }, 'UA', 1000);
    expect(d.status).toBe('invalid');
  });
  it('rejects a missing email', () => {
    const d = decideReserve({}, 'UA', 1000);
    expect(d.status).toBe('invalid');
  });
  it('accepts a valid reservation and builds a record', () => {
    const d = decideReserve({ email: ' A@B.co ', note: ' reggae ' }, 'UA/1', 1700);
    expect(d.status).toBe('ok');
    if (d.status === 'ok') {
      expect(d.key).toBe('a@b.co');
      expect(d.record).toEqual({ note: 'reggae', ts: 1700, ua: 'UA/1' });
    }
  });
  it('truncates an overlong note', () => {
    const d = decideReserve({ email: 'a@b.co', note: 'x'.repeat(2000) }, 'UA', 1);
    if (d.status === 'ok') expect(d.record.note.length).toBe(500);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/server/reserve-logic.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the logic**

```ts
// src/lib/server/reserve-logic.ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NOTE = 500;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export interface ReservePayload {
  email?: string;
  note?: string;
  hp?: string;
}

export type ReserveDecision =
  | { status: 'ok'; key: string; record: { note: string; ts: number; ua: string } }
  | { status: 'spam' }
  | { status: 'invalid'; error: string };

export function decideReserve(payload: ReservePayload, ua: string, now: number): ReserveDecision {
  if (payload.hp && payload.hp.trim() !== '') return { status: 'spam' };
  const email = (payload.email ?? '').trim();
  if (!email || !isValidEmail(email)) return { status: 'invalid', error: 'invalid email' };
  const note = (payload.note ?? '').trim().slice(0, MAX_NOTE);
  return { status: 'ok', key: normalizeEmail(email), record: { note, ts: now, ua } };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/server/reserve-logic.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/reserve-logic.ts src/lib/server/reserve-logic.test.ts
git commit -m "feat(reserve): framework-agnostic reserve decision logic"
```

---

## Task 10: Reserve Function handler + routing

**Files:**
- Create: `functions/api/reserve.ts`, `functions/tsconfig.json`, `static/_routes.json`
- Modify: `package.json` (devDep `@cloudflare/workers-types`)

**Typing note:** `tsconfig.json` extends `.svelte-kit/tsconfig.json`, which is **src-scoped** — so
`pnpm check` does NOT type-check `functions/` at all. We make Function typing deterministic with a
dedicated `functions/tsconfig.json` + `@cloudflare/workers-types`, and rely on `wrangler pages dev`
(local) and the deploy smoke-test (Task 11) for runtime verification. `pnpm check` still fully covers
the **shared logic** (`src/lib/server/reserve-logic.ts`), which is where the testable behavior lives.

- [ ] **Step 1: Create the Cloudflare Pages Function**

```ts
// functions/api/reserve.ts
import { decideReserve } from '../../src/lib/server/reserve-logic';

interface Env {
  FOUNDERS: KVNamespace;
  RESEND_API_KEY?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

// Single handler — method-checked inline. (Avoids the onRequest + onRequestPost
// + next() combo, whose ordering/precedence is ambiguous.)
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method not allowed' }, 405);
  }

  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }
  const ua = request.headers.get('user-agent') ?? '';
  const decision = decideReserve(payload as Record<string, string>, ua, Date.now());

  if (decision.status === 'invalid') return json({ ok: false, error: decision.error }, 400);
  if (decision.status === 'spam') return json({ ok: true }); // silently drop bots

  const existing = await env.FOUNDERS.get(decision.key);
  if (!existing) {
    await env.FOUNDERS.put(decision.key, JSON.stringify(decision.record));
    if (env.RESEND_API_KEY) {
      // best-effort confirmation; fire-and-forget so the response isn't blocked
      // on email delivery. (Slice-2 hardening: wrap in context.waitUntil(...) so
      // CF doesn't cancel it on worker teardown — acceptable to drop occasionally in MVP.)
      sendConfirmation(env.RESEND_API_KEY, decision.key).catch(() => {});
    }
  }
  return json({ ok: true });
};

async function sendConfirmation(apiKey: string, email: string): Promise<void> {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      // Resend behind Cloudflare blocks default UAs with error 1010 — send a browser UA.
      'user-agent': 'Mozilla/5.0 (LyricStudio reserve)'
    },
    body: JSON.stringify({
      from: 'Lyric Studio <founders@lyricstudio.app>',
      to: email,
      subject: "You're on the Founder list — Lyric Studio",
      text: "Thanks for reserving the $24 founder price. No charge today — we'll email you a checkout link when Founder access opens."
    })
  });
}
```

- [ ] **Step 2: Add Cloudflare Function types (deterministic typing)**

Install the types and give `functions/` its own tsconfig so `PagesFunction`/`KVNamespace` resolve in the
editor and `tsc` without polluting the src-scoped svelte config.

Run: `pnpm add -D @cloudflare/workers-types`

Create `functions/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "esnext",
    "moduleResolution": "bundler",
    "lib": ["esnext"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["**/*.ts"]
}
```

- [ ] **Step 3: Create `static/_routes.json`**

```json
{
  "version": 1,
  "include": ["/api/*"],
  "exclude": []
}
```

- [ ] **Step 4: Type-check both scopes**

Run: `pnpm check && npx tsc -p functions/tsconfig.json --noEmit`
Expected: `pnpm check` → 0 errors (covers `src/lib/server/reserve-logic.ts`, the imported shared logic).
`tsc -p functions/tsconfig.json` → 0 errors (covers the Function file + its CF types). The relative import
`../../src/lib/server/reserve-logic` resolves under bundler resolution.

- [ ] **Step 5: Build and confirm the routing file ships**

Run: `pnpm build && ls build/_routes.json`
Expected: `build/_routes.json` exists (adapter-static copied it from `static/`). `functions/` stays at repo
root (NOT copied into `build/` — CF Pages reads it separately).

- [ ] **Step 6: (Optional) Local Function test with wrangler**

Run: `npx wrangler pages dev build --kv FOUNDERS` then in another shell:
`curl -s -XPOST localhost:8788/api/reserve -H 'content-type: application/json' -d '{"email":"a@b.co","note":"test"}'`
Expected: `{"ok":true}`. A GET → `{"ok":false,"error":"method not allowed"}` (405). (Skip if wrangler isn't
desired locally — Task 11 smoke-tests on the deployed `.pages.dev`.)

- [ ] **Step 7: Commit**

```bash
git add functions/api/reserve.ts functions/tsconfig.json static/_routes.json package.json pnpm-lock.yaml
git commit -m "feat(reserve): CF Pages Function + KV storage + _routes.json + function types"
```

---

## Task 11: Manual setup + deploy smoke-test

**Files:** none (configuration + verification). Record outcomes in the commit message / PR description.

- [ ] **Step 1: Bind the KV namespace (Cloudflare dashboard)**

In the Cloudflare dashboard → the `lyricvideo` Pages project → Settings → Functions → KV namespace bindings: create/select a KV namespace and bind it with variable name **`FOUNDERS`** (Production + Preview). No `wrangler.toml` is required for this Git-integration deploy.

- [ ] **Step 2: (Optional) Add the Resend env var**

If sending confirmation emails: Settings → Environment variables → add `RESEND_API_KEY` (reuse an existing Resend key with a verified sender; update the `from:` address in `functions/api/reserve.ts` if `founders@lyricstudio.app` isn't verified). If omitted, the Function simply skips the email and still stores the reservation.

- [ ] **Step 3: Enable Cloudflare Web Analytics**

Dashboard → Web Analytics → enable for the Pages domain (auto-injects the beacon; no code). This covers page/path traffic only (per spec §7.4); reservation counts come from the `FOUNDERS` KV.

- [ ] **Step 4: Deploy (push to main) and smoke-test the endpoint on `.pages.dev`**

After CI deploys, run:
```bash
curl -s -XPOST https://lyricvideo.pages.dev/api/reserve \
  -H 'content-type: application/json' \
  -d '{"email":"smoke@example.com","note":"deploy smoke"}'
```
Expected: `{"ok":true}`. Then confirm the key `smoke@example.com` exists in the KV namespace (dashboard → KV → view). Send an invalid one (`-d '{"email":"nope"}'`) → expect HTTP 400 `{"ok":false,...}`.

- [ ] **Step 5: Verify graceful degradation on the GitHub Pages mirror**

Open the GitHub Pages URL (subpath `/lyricvideo`), go to the reserve form, submit a valid email. Expected: since `/api/reserve` 404s there, the form shows the **"Reserve by email →" mailto fallback** — no silent failure.

- [ ] **Step 6: Verify the funnel is observable**

In Cloudflare Web Analytics, confirm page views for `/` and `/studio` are recorded. Confirm reservations accumulate in KV. (These two together = the validation funnel.)

- [ ] **Step 7: Record results**

Note in the PR/commit: KV binding done, smoke-test result, fallback verified, analytics live, and (if reserved) the custom domain status.

---

## Self-Review Notes (author)

- **Working-tree isolation (T0):** pre-flight commits the visualizer polish first (it overlaps T1's two
  route files); non-overlapping leftovers (`vite.config.ts`, deleted artifacts) stay out via explicit
  per-file staging + the `git add -p` rule for any already-dirty file. No `git add -A`/`.` anywhere.
- **Spec coverage:** routes restructure (T1) ✓; reserve email-capture + mailto fallback incl. SPA-200/non-JSON case (T2, T3, T8 verify) ✓; hero w/ live demo + privacy line (T4) ✓; trust/how/tools/formats/pricing/faq/footer IA (T5–T7) ✓; landing assembly + SEO head (T8) ✓; reserve Function (single `onRequest`) + KV + Resend + `_routes.json` in `static/` + deterministic `functions/` typing (T9, T10) ✓; KV dashboard binding + smoke-test + GitHub-Pages degradation + CF Web Analytics (T11) ✓; analytics = page traffic + KV count (T11.6) ✓; free/paid split shown but NOT gated (Pricing copy only) ✓; Slice 2 deferred (not in plan) ✓.
- **Type consistency:** `submitReserve`/`ReserveResult` (T2) consumed in `ReserveForm` (T3); `decideReserve`/`ReserveDecision` (T9) consumed in `functions/api/reserve.ts` (T10) via relative import; KV binding name `FOUNDERS` consistent across T9/T10/T11. Function typed via `functions/tsconfig.json` (T10) since `pnpm check` is src-scoped.
- **No placeholders:** all component/code steps contain full code. `FOUNDER_INBOX` is a build-time env
  (`VITE_FOUNDER_INBOX`) with a branded (non-personal) default; Resend `from:` is a config constant with a
  change-note — not logic gaps.
```
