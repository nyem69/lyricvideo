<!-- src/lib/components/Visualizer/ExportButton.svelte -->
<script lang="ts">
  import { visualizerStore } from '$lib/stores/visualizer.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { exportMontage } from '$lib/montage/export';
  import { VisualizerRenderer } from '$lib/renderer/visualizer-renderer';
  import { getAsset } from '$lib/storage/asset-store';
  import { toast } from 'svelte-sonner';

  let { getCanvas }: { getCanvas: () => HTMLCanvasElement | undefined } = $props();

  let recording = $state(false);
  let progress = $state(0);

  async function onExport() {
    const canvas = getCanvas();
    if (!canvas) return toast.error('Canvas not ready');

    const duration = visualizerStore.totalDuration;
    if (!duration) return toast.error('Add a song or lyrics to set the duration');

    recording = true;
    progress = 0;
    playerStore.pause();
    visualizerStore.exporting = true;

    const renderer = new VisualizerRenderer({ canvas });
    renderer.resize(visualizerStore.dims.width, visualizerStore.dims.height);
    renderer.setStyle(visualizerStore.vizStyleId);
    renderer.setBands(visualizerStore.bands);
    renderer.setTitle(visualizerStore.title);
    renderer.setTextStyles(visualizerStore.titleStyle, visualizerStore.bandStyle);
    renderer.setSettings(visualizerStore.settings);

    // Asset fetches are inside the try so a corrupt/missing blob can't escape
    // before `finally` resets the recording/exporting flags (stuck-state guard).
    let bg: ImageBitmap | null = null;
    try {
      if (visualizerStore.backgroundKey) {
        const bgBlob = await getAsset(visualizerStore.backgroundKey);
        if (bgBlob) {
          bg = await createImageBitmap(bgBlob);
          renderer.setBackground(bg);
        }
      }

      const audioBlob = visualizerStore.audioKey ? await getAsset(visualizerStore.audioKey) : null;

      const blob = await exportMontage({
        canvas,
        audioFile: audioBlob,
        durationSec: duration,
        fps: visualizerStore.settings.fps,
        onAnalyserReady: (a) => renderer.setAnalyser(a),
        renderFrame: (t) => renderer.renderAt(t),
        onProgress: (f) => (progress = f),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${visualizerStore.title.replace(/\s+/g, '-').toLowerCase()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Video downloaded');
    } catch (err) {
      toast.error('Export failed — try Chrome or Edge');
      console.error(err);
    } finally {
      bg?.close?.();
      recording = false;
      visualizerStore.exporting = false;
      playerStore.restart();
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
