<!-- src/lib/components/Visualizer/VisualizerStage.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { visualizerStore } from '$lib/stores/visualizer.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { VisualizerRenderer } from '$lib/renderer/visualizer-renderer';
  import { getFontFamily, ensureFontLoaded } from '$lib/montage/fonts';
  import { getAsset } from '$lib/storage/asset-store';

  interface Props {
    onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  }
  let { onCanvasReady }: Props = $props();

  let canvas = $state<HTMLCanvasElement>();
  let renderer: VisualizerRenderer | null = null;
  let raf = 0;
  let destroyed = false;
  let bg: ImageBitmap | null = null;
  let loadedBgKey: string | undefined;

  onMount(() => {
    if (!canvas) return;
    if (onCanvasReady) onCanvasReady(canvas);
    renderer = new VisualizerRenderer({ canvas });
    renderer.resize(visualizerStore.dims.width, visualizerStore.dims.height);
    renderer.setSettings(visualizerStore.settings);
    renderer.setAnalyser(playerStore.attachAnalyser());

    const loop = () => {
      if (!destroyed && renderer && !visualizerStore.exporting) {
        renderer.setStyle(visualizerStore.vizStyleId);
        renderer.setBands(visualizerStore.bands);
        renderer.setTitle(visualizerStore.title);
        renderer.setTextStyles(visualizerStore.titleStyle, visualizerStore.bandStyle);
        renderer.setSettings(visualizerStore.settings);
        renderer.setBackground(bg);
        renderer.renderAt(playerStore.currentTime);
      }
      if (!destroyed) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  });

  onDestroy(() => {
    destroyed = true;
    cancelAnimationFrame(raf);
    renderer = null;
    bg?.close?.();
    bg = null;
  });

  // Resize the canvas when the format/dims change.
  $effect(() => {
    const { width, height } = visualizerStore.dims;
    renderer?.resize(width, height);
  });

  // Load (and swap) the background bitmap when the stored key changes.
  $effect(() => {
    const key = visualizerStore.backgroundKey;
    if (key === loadedBgKey) return;
    loadedBgKey = key;
    if (!key) {
      bg?.close?.();
      bg = null;
      return;
    }
    void (async () => {
      const blob = await getAsset(key);
      // Re-check after each await: a rapid key change (A->B->C) leaves several
      // IIFEs in flight; only the one whose key is still selected may win, else
      // a slower-resolving stale load would clobber the current background.
      if (!blob || key !== visualizerStore.backgroundKey) return;
      const next = await createImageBitmap(blob);
      if (key !== visualizerStore.backgroundKey) {
        next.close();
        return;
      }
      bg?.close?.();
      bg = next;
    })();
  });

  // Preload fonts the active styles use, so the first title/band frame isn't a fallback.
  $effect(() => {
    const t = visualizerStore.titleStyle;
    const b = visualizerStore.bandStyle;
    void ensureFontLoaded(getFontFamily(t.fontFamilyId).stack, t.fontWeight);
    void ensureFontLoaded(getFontFamily(b.fontFamilyId).stack, b.fontWeight);
  });
</script>

<div
  class="w-full bg-black rounded overflow-hidden border border-gold/10"
  style="aspect-ratio: {visualizerStore.dims.width} / {visualizerStore.dims.height}"
>
  <canvas bind:this={canvas} class="w-full h-full object-contain"></canvas>
</div>
