<!-- src/lib/components/Landing/Pricing.svelte -->
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  const free = [m.pricing_free_1, m.pricing_free_2, m.pricing_free_3, m.pricing_free_4, m.pricing_free_5];
  const pro = [m.pricing_pro_1, m.pricing_pro_2, m.pricing_pro_3, m.pricing_pro_4, m.pricing_pro_5, m.pricing_pro_6];
</script>

<section id="pricing" class="px-6 py-16 border-t border-gold/10">
  <div class="max-w-4xl mx-auto">
    <h2 class="text-center text-3xl text-white mb-3" style="font-family:'Playfair Display',serif">{m.pricing_title()}</h2>
    <p class="text-center text-white/55 mb-10">{m.pricing_subhead()}</p>
    <div class="grid md:grid-cols-2 gap-6">
      <div class="rounded-2xl border border-gold/15 p-7">
        <h3 class="text-xl text-white" style="font-family:'Playfair Display',serif">{m.pricing_free_name()}</h3>
        <p class="mt-1 text-3xl text-white" style="font-family:'Playfair Display',serif">$0</p>
        <ul class="mt-5 space-y-2 text-sm text-white/60">
          {#each free as f}<li>· {f()}</li>{/each}
        </ul>
      </div>
      <div class="rounded-2xl border border-gold/50 bg-gold/[0.06] p-7 relative">
        <span class="absolute top-5 right-5 text-[10px] uppercase tracking-widest bg-gold text-surface px-2 py-1 rounded">{m.pricing_founder_badge()}</span>
        <h3 class="text-xl text-gold" style="font-family:'Playfair Display',serif">{m.pricing_founder_name()}</h3>
        <p class="mt-1 text-3xl text-white" style="font-family:'Playfair Display',serif">$24 <s class="text-base text-white/40"><span class="sr-only">{m.pricing_price_was()} </span>$39</s> <span class="text-sm text-white/50">{m.pricing_price_once()}</span></p>
        <ul class="mt-5 space-y-2 text-sm text-white/75">
          {#each pro as p}<li>· {p()}</li>{/each}
        </ul>
        <a href="#reserve" class="mt-6 block text-center bg-gold text-surface font-semibold px-5 py-3 rounded-lg text-sm uppercase tracking-wide hover:bg-gold/90 transition-all" style="font-family:'Raleway',sans-serif">{m.pricing_founder_cta()}</a>
      </div>
    </div>
  </div>
</section>
