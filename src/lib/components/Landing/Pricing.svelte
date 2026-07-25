<!-- src/lib/components/Landing/Pricing.svelte -->
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { base } from '$app/paths';

  // One tier. Everything the app does today runs on the user's device and costs
  // us nothing to serve, so it is all free — that is the governing principle, not
  // a promotion. The former Founder's Lifetime tier gated 720p / watermark /
  // formats / style count, all of which are zero-marginal-cost client features;
  // it was retired 2026-07-25 with zero real reservations taken.
  const free = [
    m.pricing_free_1,
    m.pricing_free_2,
    m.pricing_free_3,
    m.pricing_free_4,
    m.pricing_free_5
  ];
</script>

<section id="pricing" class="px-6 py-16 border-t border-gold/10">
  <div class="max-w-2xl mx-auto">
    <h2
      class="text-center text-3xl text-white mb-3"
      style="font-family:'Playfair Display',serif"
    >
      {m.pricing_title()}
    </h2>
    <p class="text-center text-white/55 mb-10">{m.pricing_subhead()}</p>

    <div class="rounded-2xl border border-gold/50 bg-gold/[0.06] p-7">
      <h3 class="text-xl text-gold" style="font-family:'Playfair Display',serif">
        {m.pricing_free_name()}
      </h3>
      <p class="mt-1 text-3xl text-white" style="font-family:'Playfair Display',serif">$0</p>
      <ul class="mt-5 space-y-2 text-sm text-white/75">
        {#each free as f}<li>· {f()}</li>{/each}
      </ul>
      <a
        href="{base}/studio"
        class="mt-6 block text-center bg-gold text-surface font-semibold px-5 py-3 rounded-lg text-sm uppercase tracking-wide hover:bg-gold/90 transition-all"
        style="font-family:'Raleway',sans-serif">{m.pricing_free_cta()}</a
      >
    </div>
  </div>
</section>
