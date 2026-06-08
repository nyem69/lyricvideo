<!-- src/lib/components/Landing/SiteHeader.svelte -->
<script lang="ts">
  import { base } from '$app/paths';
  import * as m from '$lib/paraglide/messages';
  import LanguageSwitcher from './LanguageSwitcher.svelte';
</script>

<header class="flex items-center justify-between px-6 py-4 border-b border-gold/10">
  <a href="{base}/" class="text-gold text-lg tracking-[0.3em] uppercase" style="font-family:'Raleway',sans-serif">Lyric Studio</a>
  <nav aria-label="Main" class="flex gap-5 items-center text-xs uppercase tracking-wider">
    <!-- secondary in-page anchors: hidden on mobile (also in the footer), shown from sm+ -->
    <a href="#features" class="hidden sm:inline text-gold/40 hover:text-gold transition-colors">{m.header_nav_features()}</a>
    <a href="#pricing" class="hidden sm:inline text-gold/40 hover:text-gold transition-colors">{m.header_nav_pricing()}</a>
    <a href="#faq" class="hidden sm:inline text-gold/40 hover:text-gold transition-colors">{m.header_nav_faq()}</a>
    <LanguageSwitcher />
    <a href="{base}/studio" class="bg-gold/15 border border-gold/30 text-gold px-4 py-2 rounded hover:bg-gold/30 transition-all whitespace-nowrap">
      <!-- short label on mobile, full label from sm+ -->
      <span class="sm:hidden">{m.header_open_studio_short()}</span>
      <span class="hidden sm:inline">{m.header_open_studio()}</span>
    </a>
  </nav>
</header>
