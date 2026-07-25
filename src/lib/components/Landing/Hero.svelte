<!-- src/lib/components/Landing/Hero.svelte -->
<script lang="ts">
  import { base } from '$app/paths';
  import * as m from '$lib/paraglide/messages';
  import HeroDemo from './HeroDemo.svelte';
</script>

<section class="px-6 pt-16 pb-12 md:pt-24 md:pb-16">
  <div class="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
    <div>
      <p class="text-xs tracking-[0.3em] uppercase text-gold/70" style="font-family:'Raleway',sans-serif">{m.hero_eyebrow()}</p>
      <h1 class="mt-4 text-4xl md:text-6xl leading-[1.05] text-[#fbf4e2]" style="font-family:'Playfair Display',serif;font-weight:900">
        {m.hero_title_part1()}<span style="font-family:'Fraunces',serif;font-style:italic" class="text-audio">{m.hero_title_accent()}</span>{m.hero_title_part2()}
      </h1>
      <p class="mt-5 text-white/60 text-lg max-w-md leading-relaxed">
        {m.hero_subhead()}
      </p>
      <!-- Single CTA since the founder-reserve path was retired: "try it free" was
           the secondary outlined button and is promoted to primary here, rather
           than left as the only button in a de-emphasised style. -->
      <div class="mt-7 flex flex-wrap gap-3">
        <a href="{base}/studio" class="bg-gold text-surface font-semibold text-sm px-6 py-3.5 rounded-lg shadow-[0_10px_30px_-10px_var(--color-gold)] hover:bg-gold/90 transition-all" style="font-family:'Raleway',sans-serif">{m.hero_cta_try()}</a>
      </div>
      <p class="mt-6 flex items-center gap-2 text-sm text-audio/90">
        <span class="h-1.5 w-1.5 rounded-full bg-audio shadow-[0_0_8px_var(--color-audio)]"></span>
        {m.hero_privacy()}
      </p>
    </div>
    <HeroDemo />
  </div>
</section>
