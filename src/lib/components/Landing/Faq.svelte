<!-- src/lib/components/Landing/Faq.svelte -->
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  // The two founder-billing questions ("what do I get", "will I be charged")
  // went with the retired Founder tier; the rest renumbered down.
  const faqs = [
    { q: m.faq_q1, a: m.faq_a1 },
    { q: m.faq_q2, a: m.faq_a2 },
    { q: m.faq_q3, a: m.faq_a3 }
  ];
</script>

<section id="faq" class="px-6 py-16 border-t border-gold/10">
  <div class="max-w-2xl mx-auto">
    <h2 class="text-center text-3xl text-white mb-10" style="font-family:'Playfair Display',serif">{m.faq_title()}</h2>
    <div class="flex flex-col gap-3">
      {#each faqs as f}
        <details class="rounded-lg border border-gold/15 px-4 py-3">
          <summary class="cursor-pointer text-white/85 text-sm" style="font-family:'Raleway',sans-serif">{f.q()}</summary>
          <p class="mt-2 text-sm text-white/55 leading-relaxed">{f.a()}</p>
        </details>
      {/each}
    </div>
  </div>
</section>
