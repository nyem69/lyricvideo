<!-- src/lib/components/Landing/HowItWorks.svelte -->
<script lang="ts">
  const steps = [
    { n: '01', t: 'Paste lyrics or drop your song', d: 'Bring timestamped lyrics, or just your audio file — everything stays on your device.' },
    { n: '02', t: 'Pick a style, format and colours', d: 'Lyric card, visualizer or montage. Choose 16:9, 9:16 or 1:1.' },
    { n: '03', t: 'Export, ready to post', d: 'Render an MP4/WebM in your browser and upload it anywhere.' }
  ];
</script>

<section class="px-6 py-16">
  <div class="max-w-5xl mx-auto">
    <h2 class="text-center text-3xl text-white mb-12" style="font-family:'Playfair Display',serif">How it works</h2>
    <div class="grid md:grid-cols-3 gap-8">
      {#each steps as s}
        <div>
          <div class="text-gold/50 text-sm tracking-widest" style="font-family:'Raleway',sans-serif">{s.n}</div>
          <h3 class="mt-2 text-lg text-white" style="font-family:'Playfair Display',serif">{s.t}</h3>
          <p class="mt-2 text-sm text-white/55 leading-relaxed">{s.d}</p>
        </div>
      {/each}
    </div>
  </div>
</section>
