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

<div class="min-h-screen bg-surface text-white">
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

<style>
  /* Smooth-scroll for the in-page anchor links (#features, #pricing, #reserve, #faq).
     Must target the scroll container (html), not an inner div, to take effect. */
  :global(html) { scroll-behavior: smooth; }
</style>
