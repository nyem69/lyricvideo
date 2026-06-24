<!-- src/lib/components/Visualizer/PlacementPicker.svelte -->
<script lang="ts">
  import { visualizerStore } from '$lib/stores/visualizer.svelte';
  import type { VAnchor } from '$lib/visualizer/model';

  const OPTIONS: { id: VAnchor; label: string }[] = [
    { id: 'top', label: 'Top' },
    { id: 'center', label: 'Center' },
    { id: 'bottom', label: 'Bottom' },
  ];

  // Compact active-state summary for the folded section.
  const summary = $derived(
    `Viz ${visualizerStore.vizAnchor} · Lyrics ${visualizerStore.lyricAnchor}`
  );
</script>

<details class="border border-gold/15 rounded">
  <summary
    class="cursor-pointer select-none px-3 py-2 text-sm tracking-wider text-gold/60 uppercase flex items-center justify-between gap-2"
    style="font-family:'Raleway',sans-serif"
  >
    <span>Placement</span>
    <span class="text-xs normal-case tracking-normal text-gold/40 capitalize">{summary}</span>
  </summary>
  <div class="flex flex-col gap-3 px-3 pb-3 pt-1">
    <div class="flex flex-col gap-1.5">
      <span class="text-xs tracking-wider text-gold/50 uppercase" style="font-family:'Raleway',sans-serif">Visualizer</span>
      <div class="flex gap-2">
        {#each OPTIONS as o}
          <button
            onclick={() => visualizerStore.setVizAnchor(o.id)}
            aria-pressed={o.id === visualizerStore.vizAnchor}
            class="flex-1 px-3 py-1 text-xs uppercase tracking-wider rounded border transition-all {o.id ===
            visualizerStore.vizAnchor
              ? 'border-gold/50 text-gold bg-gold/10'
              : 'border-gold/15 text-white/50 hover:text-gold'}"
            style="font-family:'Raleway',sans-serif">{o.label}</button
          >
        {/each}
      </div>
    </div>

    <div class="flex flex-col gap-1.5">
      <span class="text-xs tracking-wider text-gold/50 uppercase" style="font-family:'Raleway',sans-serif">Lyrics</span>
      <div class="flex gap-2">
        {#each OPTIONS as o}
          <button
            onclick={() => visualizerStore.setLyricAnchor(o.id)}
            aria-pressed={o.id === visualizerStore.lyricAnchor}
            class="flex-1 px-3 py-1 text-xs uppercase tracking-wider rounded border transition-all {o.id ===
            visualizerStore.lyricAnchor
              ? 'border-gold/50 text-gold bg-gold/10'
              : 'border-gold/15 text-white/50 hover:text-gold'}"
            style="font-family:'Raleway',sans-serif">{o.label}</button
          >
        {/each}
      </div>
    </div>
  </div>
</details>
