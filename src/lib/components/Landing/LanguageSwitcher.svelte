<!-- src/lib/components/Landing/LanguageSwitcher.svelte -->
<script lang="ts">
  import { locales, getLocale, setLocale } from '$lib/paraglide/runtime';
  import * as m from '$lib/paraglide/messages';
  import { ChevronDown } from '@lucide/svelte';

  // Paraglide's generated runtime is JS (no exported `Locale` type) — derive the
  // union from the `locales` value tuple (Nasab pattern). If svelte-check rejects
  // this, fall back to: import { type locales as LocalesTuple } ...; type Locale = (typeof LocalesTuple)[number];
  type Locale = (typeof locales)[number];

  const NATIVE: Partial<Record<string, string>> = { en: 'English', ms: 'Bahasa Melayu', id: 'Bahasa Indonesia' };
  // Short codes for the compact mobile trigger (the long native names overflow the
  // desktop-first header below ~640px). Full names stay in the dropdown + aria-label.
  const SHORT: Partial<Record<string, string>> = { en: 'EN', ms: 'MS', id: 'ID' };

  // setLocale() reloads the page, so getLocale() is fixed for this page load — read it once.
  let open = $state(false);
  const current: Locale = getLocale();

  function choose(l: Locale) {
    open = false;
    if (l !== current) setLocale(l); // persists to localStorage + reloads
  }

  $effect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!(e.target as Element).closest('.lang-switch')) open = false; };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  });
</script>

<div class="lang-switch relative">
  <button
    type="button"
    onclick={() => (open = !open)}
    aria-label={`${m.header_language()}: ${NATIVE[current] ?? current}`}
    aria-expanded={open}
    class="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-gold/25 text-gold/80 hover:text-gold hover:border-gold/50 transition-colors"
    style="font-family:'Raleway',sans-serif"
  >
    <!-- compact code on mobile, full native name from sm+ (desktop stays polished) -->
    <span class="text-xs uppercase tracking-wider sm:hidden">{SHORT[current] ?? current}</span>
    <span class="text-xs uppercase tracking-wider hidden sm:inline">{NATIVE[current] ?? current}</span>
    <ChevronDown class="w-3.5 h-3.5 transition-transform {open ? 'rotate-180' : ''}" />
  </button>

  {#if open}
    <div class="absolute right-0 top-full mt-1 w-44 rounded-lg border border-gold/20 bg-surface shadow-xl overflow-hidden z-50">
      {#each locales as l}
        <button
          type="button"
          onclick={() => choose(l)}
          aria-current={l === current ? 'true' : undefined}
          class="w-full px-4 py-2.5 text-left text-sm transition-colors {l === current ? 'bg-gold/15 text-gold' : 'text-white/70 hover:bg-white/5 hover:text-gold'}"
          style="font-family:'Raleway',sans-serif"
        >{NATIVE[l] ?? l}</button>
      {/each}
    </div>
  {/if}
</div>
