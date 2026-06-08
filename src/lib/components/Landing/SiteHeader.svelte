<!-- src/lib/components/Landing/SiteHeader.svelte -->
<script lang="ts">
  import { base } from '$app/paths';
  import * as m from '$lib/paraglide/messages';
  import LanguageSwitcher from './LanguageSwitcher.svelte';
</script>

<header class="flex items-center justify-between px-6 py-4 border-b border-gold/10">
  <a href="{base}/" class="text-gold text-lg tracking-[0.3em] uppercase" style="font-family:'Raleway',sans-serif">Lyric Studio</a>
  <nav aria-label="Main" class="flex gap-5 items-center text-xs uppercase tracking-wider">
    <a href="#features" class="text-gold/40 hover:text-gold transition-colors">{m.header_nav_features()}</a>
    <a href="#pricing" class="text-gold/40 hover:text-gold transition-colors">{m.header_nav_pricing()}</a>
    <a href="#faq" class="text-gold/40 hover:text-gold transition-colors">{m.header_nav_faq()}</a>
    <LanguageSwitcher />
    <a href="{base}/studio" class="bg-gold/15 border border-gold/30 text-gold px-4 py-2 rounded hover:bg-gold/30 transition-all">{m.header_open_studio()}</a>
  </nav>
</header>
