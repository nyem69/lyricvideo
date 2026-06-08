<!-- src/lib/components/Landing/SiteFooter.svelte -->
<script lang="ts">
  import { base } from '$app/paths';
</script>

<footer class="px-6 py-10 border-t border-gold/10 text-sm text-white/40">
  <div class="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
    <span style="font-family:'Playfair Display',serif" class="text-white/60">Lyric Studio — made for indie artists.</span>
    <nav aria-label="Footer" class="flex gap-5">
      <a href="{base}/studio" class="hover:text-gold transition-colors">Try it free</a>
      <a href="{base}/visualizer" class="hover:text-gold transition-colors">Visualizer</a>
      <a href="{base}/montage" class="hover:text-gold transition-colors">Montage</a>
      <a href="#pricing" class="hover:text-gold transition-colors">Pricing</a>
      <a href="#faq" class="hover:text-gold transition-colors">FAQ</a>
    </nav>
  </div>
</footer>
