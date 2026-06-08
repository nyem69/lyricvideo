<!-- src/lib/components/Landing/HowItWorks.svelte -->
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  const steps = [
    { n: '01', t: m.how_step1_title, d: m.how_step1_desc },
    { n: '02', t: m.how_step2_title, d: m.how_step2_desc },
    { n: '03', t: m.how_step3_title, d: m.how_step3_desc }
  ];
</script>

<section class="px-6 py-16">
  <div class="max-w-5xl mx-auto">
    <h2 class="text-center text-3xl text-white mb-12" style="font-family:'Playfair Display',serif">{m.how_title()}</h2>
    <div class="grid md:grid-cols-3 gap-8">
      {#each steps as s}
        <div>
          <div class="text-gold/50 text-sm tracking-widest" style="font-family:'Raleway',sans-serif">{s.n}</div>
          <h3 class="mt-2 text-lg text-white" style="font-family:'Playfair Display',serif">{s.t()}</h3>
          <p class="mt-2 text-sm text-white/55 leading-relaxed">{s.d()}</p>
        </div>
      {/each}
    </div>
  </div>
</section>
