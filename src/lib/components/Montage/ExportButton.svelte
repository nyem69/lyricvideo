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

  async function onExport() {
    const canvas = getCanvas();
    if (!canvas) return toast.error('Canvas not ready');
    if (montageStore.photos.length === 0) return toast.error('Add photos first');

    const duration = montageStore.songDuration || playerStore.duration;
    if (!duration) return toast.error('Add a song or lyrics to set the duration');

    recording = true;
    progress = 0;
    playerStore.pause();

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
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${montageStore.title.replace(/\s+/g, '-').toLowerCase()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Video downloaded');
    } catch (err) {
      toast.error('Export failed — try Chrome or Edge');
      console.error(err);
    } finally {
      recording = false;
      playerStore.restart();
      cache.clear();
    }
  }
</script>

<button
  onclick={onExport}
  disabled={recording}
  class="bg-gold/20 border border-gold/40 text-gold px-4 py-2 text-sm tracking-widest uppercase rounded cursor-pointer hover:bg-gold/30 disabled:opacity-50 disabled:cursor-wait transition-all"
  style="font-family:'Raleway',sans-serif"
>
  {recording ? `Recording… ${Math.round(progress * 100)}%` : 'Download Video'}
</button>
