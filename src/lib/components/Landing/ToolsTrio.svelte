<!-- src/lib/components/Landing/ToolsTrio.svelte -->
<script lang="ts">
  import { base } from '$app/paths';
  import * as m from '$lib/paraglide/messages';
  const tools = [
    { t: m.tools_lyric_title, d: m.tools_lyric_desc, href: `${base}/studio` },
    { t: m.tools_visualizer_title, d: m.tools_visualizer_desc, href: `${base}/visualizer` },
    { t: m.tools_montage_title, d: m.tools_montage_desc, href: `${base}/montage` }
  ];
</script>

<section id="features" class="px-6 py-16 border-t border-gold/10">
  <div class="max-w-6xl mx-auto">
    <h2 class="text-center text-3xl text-white mb-12" style="font-family:'Playfair Display',serif">{m.tools_title()}</h2>
    <div class="grid md:grid-cols-3 gap-6">
      {#each tools as tool}
        <a href={tool.href} class="group rounded-xl border border-gold/15 p-6 hover:border-gold/40 hover:bg-white/[0.02] transition-all">
          <div class="h-24 rounded-lg mb-4 ring-1 ring-gold/10" style="background:radial-gradient(80% 120% at 50% 120%, rgba(70,214,200,.15), transparent 60%), #0a1a0a"></div>
          <h3 class="text-lg text-gold" style="font-family:'Playfair Display',serif">{tool.t()}</h3>
          <p class="mt-2 text-sm text-white/55">{tool.d()}</p>
          <span class="mt-3 inline-block text-xs uppercase tracking-wider text-gold/50 group-hover:text-gold transition-colors">{m.tools_open()}</span>
        </a>
      {/each}
    </div>
  </div>
</section>
