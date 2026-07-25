<!-- src/lib/components/Visualizer/FormatPicker.svelte -->
<script lang="ts">
  import { visualizerStore } from '$lib/stores/visualizer.svelte';
  import { FORMATS } from '$lib/visualizer/formats';
  import {
    QUALITY_LEVELS,
    QUALITY_MAP,
    DEFAULT_QUALITY,
    estimateBytes,
    formatBytes,
  } from '$lib/visualizer/quality';

  function onCustomW(e: Event) {
    const w = Number((e.target as HTMLInputElement).value);
    visualizerStore.setCustomDims(w, visualizerStore.customHeight ?? 1080);
  }
  function onCustomH(e: Event) {
    const h = Number((e.target as HTMLInputElement).value);
    visualizerStore.setCustomDims(visualizerStore.customWidth ?? 1920, h);
  }

  // Surface the active format in the collapsed summary so it stays informative
  // when folded (the section defaults closed to keep the sidebar short).
  const activeLabel = $derived(
    visualizerStore.formatId === 'custom'
      ? `Custom ${visualizerStore.customWidth ?? 1920}×${visualizerStore.customHeight ?? 1080}`
      : (FORMATS.find((f) => f.id === visualizerStore.formatId)?.label ?? 'YouTube')
  );

  const exportDims = $derived(visualizerStore.exportDims);
  const activeQuality = $derived(
    QUALITY_MAP[visualizerStore.quality] ?? QUALITY_MAP[DEFAULT_QUALITY]
  );
  // Estimate is bitrate x duration — indicative, not a promise, so it stays
  // labelled "approx". Reads '—' until a song or lyrics set the duration.
  const estimate = $derived(
    formatBytes(estimateBytes(exportDims.width, exportDims.height, visualizerStore.totalDuration))
  );
  const summary = $derived(
    `${activeLabel} · ${activeQuality.label}`
  );
</script>

<details class="border border-gold/15 rounded">
  <summary
    class="cursor-pointer select-none px-3 py-2 text-sm tracking-wider text-gold/60 uppercase flex items-center justify-between gap-2"
    style="font-family:'Raleway',sans-serif"
  >
    <span>Video Format</span>
    <span class="text-xs normal-case tracking-normal text-gold/40">{summary}</span>
  </summary>
  <div class="flex flex-col gap-2 px-3 pb-3 pt-1">
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
  <div class="mt-1 border-t border-gold/10 pt-2">
    <span
      class="block text-xs tracking-wider text-gold/50 uppercase"
      style="font-family:'Raleway',sans-serif">Export Quality</span
    >
    <div class="mt-2 flex flex-wrap gap-2">
      {#each QUALITY_LEVELS as q}
        <button
          onclick={() => visualizerStore.setQuality(q.id)}
          aria-pressed={q.id === visualizerStore.quality}
          class="px-3 py-1 text-xs uppercase tracking-wider rounded border transition-all {q.id ===
          visualizerStore.quality
            ? 'border-gold/50 text-gold bg-gold/10'
            : 'border-gold/15 text-white/50 hover:text-gold'}"
          style="font-family:'Raleway',sans-serif">{q.label}</button
        >
      {/each}
    </div>
    <p class="mt-2 text-[11px] leading-relaxed text-white/40">
      {activeQuality.hint} · records at {exportDims.width}×{exportDims.height} · approx <span
        class="text-gold/60">{estimate}</span
      >
    </p>
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
</details>
