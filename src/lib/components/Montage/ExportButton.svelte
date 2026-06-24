<!-- src/lib/components/Montage/ExportButton.svelte -->
<script lang="ts">
  import { montageStore } from '$lib/stores/montage.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { exportMontage } from '$lib/montage/export';
  import { MontageRenderer } from '$lib/renderer/montage-renderer';
  import { ImageCache } from '$lib/renderer/image-cache';
  import { getMontageStyle } from '$lib/montage/style';
  import { getAsset } from '$lib/storage/asset-store';
  import { toast } from 'svelte-sonner';

  let { getCanvas }: { getCanvas: () => HTMLCanvasElement | undefined } = $props();

  let recording = $state(false);
  let progress = $state(0);
  // Lets the Stop button abort the in-flight recording (cleared in `finally`).
  let controller: AbortController | null = null;

  function stop() {
    controller?.abort();
  }

  async function onExport() {
    const canvas = getCanvas();
    if (!canvas) return toast.error('Canvas not ready');
    if (montageStore.photos.length === 0) return toast.error('Add photos first');

    // Match the rendered montage length exactly (last cut's end) — not raw audio
    // length — so the WebM has no blank tail and isn't cut off mid-montage.
    const duration = montageStore.totalDuration;
    if (!duration) return toast.error('Add a song or lyrics to set the duration');

    recording = true;
    progress = 0;
    controller = new AbortController();
    playerStore.pause();
    // Suspend the preview loop — it shares this canvas with the export renderer.
    montageStore.exporting = true;

    // Dedicated renderer bound to the SAME canvas, driven by the export clock.
    const cache = new ImageCache((key) => getAsset(key));
    const renderer = new MontageRenderer({ canvas, imageCache: cache });
    renderer.resize(1920, 1080);
    renderer.setPhotos(montageStore.photos);
    renderer.setCuts(montageStore.cuts);
    renderer.setBands(montageStore.bands);
    renderer.setStyle(getMontageStyle(montageStore.styleId));
    renderer.setSettings(montageStore.settings);
    renderer.setTitle(montageStore.title);
    renderer.setTextStyles(montageStore.titleStyle, montageStore.bandStyle);

    const audioBlob = montageStore.audioKey ? await getAsset(montageStore.audioKey) : null;

    try {
      const blob = await exportMontage({
        canvas,
        audioFile: audioBlob,
        durationSec: duration,
        fps: montageStore.settings.fps,
        renderFrame: async (t) => {
          // await warm so a cold cut's first frame isn't captured blank
          await renderer.warm(t);
          renderer.renderAt(t);
        },
        onProgress: (f) => (progress = f),
        signal: controller.signal,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${montageStore.title.replace(/\s+/g, '-').toLowerCase()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Video downloaded');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast('Recording stopped');
      } else {
        toast.error('Export failed — try Chrome or Edge');
        console.error(err);
      }
    } finally {
      controller = null;
      recording = false;
      montageStore.exporting = false; // resume the preview loop
      playerStore.restart();
      cache.clear();
    }
  }
</script>

{#if recording}
  <div class="flex gap-2">
    <span
      class="flex-1 bg-gold/15 border border-gold/30 text-gold px-4 py-2 text-sm tracking-widest uppercase rounded text-center"
      style="font-family:'Raleway',sans-serif">Recording… {Math.round(progress * 100)}%</span
    >
    <button
      onclick={stop}
      title="Stop recording"
      class="bg-red-500/15 border border-red-400/40 text-red-300 px-4 py-2 text-sm tracking-widest uppercase rounded cursor-pointer hover:bg-red-500/30 transition-all"
      style="font-family:'Raleway',sans-serif">Stop</button
    >
  </div>
{:else}
  <button
    onclick={onExport}
    class="bg-gold/20 border border-gold/40 text-gold px-4 py-2 text-sm tracking-widest uppercase rounded cursor-pointer hover:bg-gold/30 transition-all"
    style="font-family:'Raleway',sans-serif"
  >
    Download Video
  </button>
{/if}
