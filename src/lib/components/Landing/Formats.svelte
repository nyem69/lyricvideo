<!-- src/lib/components/Landing/Formats.svelte -->
<script lang="ts">
  const formats = [
    { label: 'YouTube', ratio: '16 / 9', sub: '16:9' },
    { label: 'TikTok / Reels', ratio: '9 / 16', sub: '9:16' },
    { label: 'Instagram', ratio: '1 / 1', sub: '1:1' }
  ];
</script>

<section class="px-6 py-16">
  <div class="max-w-4xl mx-auto text-center">
    <h2 class="text-3xl text-white" style="font-family:'Playfair Display',serif">Made for every platform</h2>
    <p class="mt-3 text-white/55">Export the exact aspect ratio each platform wants — or set a custom size.</p>
    <div class="mt-10 flex items-end justify-center gap-8">
      {#each formats as f}
        <div class="flex flex-col items-center gap-2">
          <div class="w-24 ring-1 ring-gold/25 rounded bg-white/[0.03]" style="aspect-ratio:{f.ratio}"></div>
          <span class="text-sm text-white/70" style="font-family:'Raleway',sans-serif">{f.label}</span>
          <span class="text-xs text-gold/50">{f.sub}</span>
        </div>
      {/each}
    </div>
  </div>
</section>
