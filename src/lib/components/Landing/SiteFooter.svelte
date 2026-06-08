<!-- src/lib/components/Landing/SiteFooter.svelte -->
<script lang="ts">
  import { base } from '$app/paths';
  import * as m from '$lib/paraglide/messages';
</script>

<footer class="px-6 py-10 border-t border-gold/10 text-sm text-white/40">
  <div class="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
    <span style="font-family:'Playfair Display',serif" class="text-white/60">{m.footer_tagline()}</span>
    <nav aria-label="Footer" class="flex gap-5">
      <a href="{base}/studio" class="hover:text-gold transition-colors">{m.footer_link_try()}</a>
      <a href="{base}/visualizer" class="hover:text-gold transition-colors">{m.footer_link_visualizer()}</a>
      <a href="{base}/montage" class="hover:text-gold transition-colors">{m.footer_link_montage()}</a>
      <a href="#pricing" class="hover:text-gold transition-colors">{m.footer_link_pricing()}</a>
      <a href="#faq" class="hover:text-gold transition-colors">{m.footer_link_faq()}</a>
    </nav>
  </div>
</footer>
