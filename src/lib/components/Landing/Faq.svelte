<!-- src/lib/components/Landing/Faq.svelte -->
<script lang="ts">
  const faqs = [
    { q: 'Does my audio or images get uploaded?', a: 'No. Everything runs in your browser — your files never leave your device.' },
    { q: 'What do I get with Founder access?', a: 'Lifetime: 1080p exports, no watermark, every format and visualizer style, plus all future Pro features — one payment, no subscription.' },
    { q: 'Will I be charged today?', a: "No. You're reserving the $24 early price. We'll email you a checkout link when Founder access opens." },
    { q: 'Which formats can I export?', a: '16:9, 9:16, 1:1 and custom sizes.' },
    { q: 'Which browser works best?', a: 'Chrome or Edge give the most reliable video export.' }
  ];
</script>

<section id="faq" class="px-6 py-16 border-t border-gold/10">
  <div class="max-w-2xl mx-auto">
    <h2 class="text-center text-3xl text-white mb-10" style="font-family:'Playfair Display',serif">Questions</h2>
    <div class="flex flex-col gap-3">
      {#each faqs as f}
        <details class="rounded-lg border border-gold/15 px-4 py-3">
          <summary class="cursor-pointer text-white/85 text-sm" style="font-family:'Raleway',sans-serif">{f.q}</summary>
          <p class="mt-2 text-sm text-white/55 leading-relaxed">{f.a}</p>
        </details>
      {/each}
    </div>
  </div>
</section>
