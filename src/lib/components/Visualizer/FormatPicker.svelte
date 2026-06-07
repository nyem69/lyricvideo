<!-- src/lib/components/Visualizer/FormatPicker.svelte -->
<script lang="ts">
  import { visualizerStore } from '$lib/stores/visualizer.svelte';
  import { FORMATS } from '$lib/visualizer/formats';

  function onCustomW(e: Event) {
    const w = Number((e.target as HTMLInputElement).value);
    visualizerStore.setCustomDims(w, visualizerStore.customHeight ?? 1080);
  }
  function onCustomH(e: Event) {
    const h = Number((e.target as HTMLInputElement).value);
    visualizerStore.setCustomDims(visualizerStore.customWidth ?? 1920, h);
  }
</script>

<div class="flex flex-col gap-2">
  <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif"
    >Video Format</span
  >
  <div class="flex flex-wrap gap-2">
    {#each FORMATS as f}
      <button
        onclick={() => visualizerStore.setFormat(f.id)}
        class="px-3 py-1 text-xs uppercase tracking-wider rounded border transition-all {f.id ===
        visualizerStore.formatId
          ? 'border-gold/50 text-gold bg-gold/10'
          : 'border-gold/15 text-white/50 hover:text-gold'}"
        style="font-family:'Raleway',sans-serif">{f.label}</button
      >
    {/each}
    <button
      onclick={() => visualizerStore.setFormat('custom')}
      class="px-3 py-1 text-xs uppercase tracking-wider rounded border transition-all {visualizerStore.formatId ===
      'custom'
        ? 'border-gold/50 text-gold bg-gold/10'
        : 'border-gold/15 text-white/50 hover:text-gold'}"
      style="font-family:'Raleway',sans-serif">Custom</button
    >
  </div>
  {#if visualizerStore.formatId === 'custom'}
    <div class="flex items-center gap-2 text-xs text-white/50">
      <input
        type="number"
        value={visualizerStore.customWidth ?? 1920}
        oninput={onCustomW}
        aria-label="Custom width (px)"
        class="w-20 bg-white/5 border border-gold/20 rounded px-2 py-1 text-white/80 focus:outline-none focus:border-gold/50"
      />
      <span>×</span>
      <input
        type="number"
        value={visualizerStore.customHeight ?? 1080}
        oninput={onCustomH}
        aria-label="Custom height (px)"
        class="w-20 bg-white/5 border border-gold/20 rounded px-2 py-1 text-white/80 focus:outline-none focus:border-gold/50"
      />
    </div>
  {/if}
</div>
