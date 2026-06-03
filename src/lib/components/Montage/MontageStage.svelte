<!-- src/lib/components/Montage/MontageStage.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { montageStore } from '$lib/stores/montage.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { MontageRenderer } from '$lib/renderer/montage-renderer';
  import { ImageCache } from '$lib/renderer/image-cache';
  import { getMontageStyle } from '$lib/montage/style';
  import { getAsset } from '$lib/storage/asset-store';

  interface Props {
    /** Callback invoked once the canvas element is mounted — lets the export
     *  controller (Task 11) obtain a reference without needing a prop binding. */
    onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  }

  let { onCanvasReady }: Props = $props();

  let canvas = $state<HTMLCanvasElement>();
  let renderer: MontageRenderer | null = null;
  let cache: ImageCache | null = null;
  let raf = 0;
  let destroyed = false;

  onMount(() => {
    if (!canvas) return;
    if (onCanvasReady) onCanvasReady(canvas);
    cache = new ImageCache((key) => getAsset(key));
    renderer = new MontageRenderer({ canvas, imageCache: cache });
    renderer.resize(1920, 1080);
    renderer.setSettings(montageStore.settings);

    const loop = async () => {
      // Stand down while an export records — both share this canvas (see store).
      if (!destroyed && renderer && !montageStore.exporting) {
        renderer.setPhotos(montageStore.photos);
        renderer.setCuts(montageStore.cuts);
        renderer.setBands(montageStore.bands);
        renderer.setStyle(getMontageStyle(montageStore.styleId));
        renderer.setSettings(montageStore.settings);
        renderer.setTitle(montageStore.title);
        await renderer.warm(playerStore.currentTime);
        // re-check after the await: onDestroy may have fired while warm() was pending
        if (!destroyed && renderer) renderer.renderAt(playerStore.currentTime);
      }
      if (!destroyed) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  });

  onDestroy(() => {
    destroyed = true;
    cancelAnimationFrame(raf);
    renderer = null;
    cache?.clear(); // close decoded ImageBitmaps (GPU memory)
    cache = null;
  });
</script>

<div class="w-full aspect-video bg-black rounded overflow-hidden border border-gold/10">
  <canvas bind:this={canvas} class="w-full h-full object-contain"></canvas>
</div>
