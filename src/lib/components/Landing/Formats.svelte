<!-- src/lib/components/Landing/Formats.svelte -->
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  const formats = [
    { label: m.formats_youtube, ratio: '16 / 9', sub: '16:9' },
    { label: m.formats_tiktok, ratio: '9 / 16', sub: '9:16' },
    { label: m.formats_instagram, ratio: '1 / 1', sub: '1:1' }
  ];
</script>

<section class="px-6 py-16">
  <div class="max-w-4xl mx-auto text-center">
    <h2 class="text-3xl text-white" style="font-family:'Playfair Display',serif">{m.formats_title()}</h2>
    <p class="mt-3 text-white/55">{m.formats_subhead()}</p>
    <div class="mt-10 flex items-end justify-center gap-8">
      {#each formats as f}
        <div class="flex flex-col items-center gap-2">
          <div class="w-24 ring-1 ring-gold/25 rounded bg-white/[0.03]" style="aspect-ratio:{f.ratio}"></div>
          <span class="text-sm text-white/70" style="font-family:'Raleway',sans-serif">{f.label()}</span>
          <span class="text-xs text-gold/50">{f.sub}</span>
        </div>
      {/each}
    </div>
  </div>
</section>
