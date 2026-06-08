<!-- src/lib/components/Visualizer/VizStylePicker.svelte -->
<script lang="ts">
  import { visualizerStore } from '$lib/stores/visualizer.svelte';
  import { VIZ_STYLES } from '$lib/visualizer/viz-styles';
</script>

<div class="flex flex-col gap-2">
  <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif"
    >Visualizer Style</span
  >
  <div class="grid grid-cols-2 gap-2">
    {#each VIZ_STYLES as style}
      <button
        onclick={() => visualizerStore.setVizStyle(style.id)}
        class="px-3 py-2 text-xs uppercase tracking-wider rounded border transition-all text-left {style.id ===
        visualizerStore.vizStyleId
          ? 'border-audio/60 text-audio bg-audio/10'
          : 'border-gold/15 text-white/50 hover:text-gold hover:border-gold/30'}"
        style="font-family:'Raleway',sans-serif">{style.name}</button
      >
    {/each}
  </div>
</div>
