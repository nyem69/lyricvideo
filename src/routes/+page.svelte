<!-- src/routes/+page.svelte -->
<script lang="ts">
  import SiteHeader from '$lib/components/Landing/SiteHeader.svelte';
  import Hero from '$lib/components/Landing/Hero.svelte';
  import TrustStrip from '$lib/components/Landing/TrustStrip.svelte';
  import HowItWorks from '$lib/components/Landing/HowItWorks.svelte';
  import ToolsTrio from '$lib/components/Landing/ToolsTrio.svelte';
  import Formats from '$lib/components/Landing/Formats.svelte';
  import Pricing from '$lib/components/Landing/Pricing.svelte';
  import Faq from '$lib/components/Landing/Faq.svelte';
  import SiteFooter from '$lib/components/Landing/SiteFooter.svelte';
  import * as m from '$lib/paraglide/messages';
  import { browser } from '$app/environment';

  // app.html ships an English <meta name="description" data-static-fallback> for no-JS
  // crawlers. For JS visitors, drop it so the localized one in <svelte:head> below is the
  // sole description tag. Browser-safe + idempotent (?.remove() is a no-op once gone).
  $effect(() => {
    if (!browser) return;
    document.head.querySelector('meta[name="description"][data-static-fallback]')?.remove();
  });
</script>

<svelte:head>
  <title>{m.meta_title()}</title>
  <meta name="description" content={m.meta_description()} />
</svelte:head>

<div class="min-h-screen bg-surface text-white">
  <SiteHeader />
  <Hero />
  <TrustStrip />
  <HowItWorks />
  <ToolsTrio />
  <Formats />
  <Pricing />
  <Faq />
  <SiteFooter />
</div>

<style>
  /* Smooth-scroll for the in-page anchor links (#features, #pricing, #faq).
     Must target the scroll container (html), not an inner div, to take effect. */
  :global(html) { scroll-behavior: smooth; }
</style>
