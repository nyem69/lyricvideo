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
        <p class="mt-1 text-3xl text-white" style="font-family:'Playfair Display',serif">$24 <s class="text-base text-white/40"><span class="sr-only">was </span>$39</s> <span class="text-sm text-white/50">once</span></p>
        <ul class="mt-5 space-y-2 text-sm text-white/75">
          {#each pro as p}<li>· {p}</li>{/each}
        </ul>
        <a href="#reserve" class="mt-6 block text-center bg-gold text-surface font-semibold px-5 py-3 rounded-lg text-sm uppercase tracking-wide hover:bg-gold/90 transition-all" style="font-family:'Raleway',sans-serif">Reserve founder price</a>
      </div>
    </div>
  </div>
</section>
