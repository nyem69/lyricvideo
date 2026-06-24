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

  // Live-level cue (feature identity): a few teal EQ bars driven by the same
  // analyser the renderer taps. `live` is false when there's no signal — the
  // bars then fall back to a CSS idle shimmer instead of sitting flat.
  const METER_BARS = 7;
  let meter = $state<number[]>(new Array(METER_BARS).fill(0));
  let live = $state(false);
  let analyser: AnalyserNode | null = null;
  let meterBuf: Uint8Array<ArrayBuffer> | null = null;

  onMount(() => {
    if (!canvas) return;
    if (onCanvasReady) onCanvasReady(canvas);
    renderer = new VisualizerRenderer({ canvas });
    renderer.resize(visualizerStore.dims.width, visualizerStore.dims.height);
    renderer.setSettings(visualizerStore.settings);
    analyser = playerStore.attachAnalyser();
    renderer.setAnalyser(analyser);
    meterBuf = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

    const loop = () => {
      if (!destroyed && renderer && !visualizerStore.exporting) {
        renderer.setStyle(visualizerStore.vizStyleId);
        renderer.setAccent(visualizerStore.vizColor);
        renderer.setSurface(visualizerStore.vizBg);
        renderer.setAnchors(visualizerStore.vizAnchor, visualizerStore.lyricAnchor);
        renderer.setBands(visualizerStore.bands);
        renderer.setTitle(visualizerStore.title);
        renderer.setTextStyles(visualizerStore.titleStyle, visualizerStore.bandStyle);
        renderer.setSettings(visualizerStore.settings);
        renderer.setBackground(bg);
        renderer.renderAt(playerStore.currentTime);
        updateMeter();
      }
      if (!destroyed) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  });

  function updateMeter() {
    if (!analyser || !meterBuf) return;
    analyser.getByteFrequencyData(meterBuf);
    const n = meterBuf.length;
    const next: number[] = new Array(METER_BARS);
    let total = 0;
    // Average a log-ish band per bar so lows don't dominate the strip.
    for (let b = 0; b < METER_BARS; b++) {
      const lo = Math.floor((n * b) / METER_BARS);
      const hi = Math.floor((n * (b + 1)) / METER_BARS);
      let sum = 0;
      for (let i = lo; i < hi; i++) sum += meterBuf[i];
      const avg = hi > lo ? sum / (hi - lo) / 255 : 0;
      next[b] = avg;
      total += sum;
    }
    const isLive = total > 0;
    if (isLive !== live) live = isLive;
    if (isLive) meter = next;
  }

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

  // Portrait (vertical-video) preview: a w-full box would span the whole stage
  // and tower far taller than the viewport on desktop. Cap its WIDTH so the box
  // never grows past PORTRAIT_PREVIEW_VH of viewport height (width follows from
  // the aspect ratio) and centre it. Export is unaffected — the renderer still
  // draws at full dims.{width,height}; this is display sizing only.
  const PORTRAIT_PREVIEW_VH = 72;
  const portrait = $derived(visualizerStore.dims.height > visualizerStore.dims.width);
  const previewMaxWidth = $derived(
    portrait
      ? `calc(${PORTRAIT_PREVIEW_VH}svh * ${visualizerStore.dims.width} / ${visualizerStore.dims.height})`
      : undefined
  );
</script>

<!-- Stage surface: a framed plinth a shade cooler than the page, with a teal
     top-glow, so the canvas reads as an active "screen" rather than a hole. -->
<div
  class="rounded-xl p-3 ring-1 ring-gold/10 bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(70,214,200,0.06),transparent_60%)]"
>
  <div
    class="relative w-full mx-auto bg-black rounded-lg overflow-hidden ring-1 ring-gold/20 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.8)]"
    style="aspect-ratio: {visualizerStore.dims.width} / {visualizerStore.dims.height}{previewMaxWidth
      ? `; max-width: ${previewMaxWidth}`
      : ''}"
  >
    <canvas bind:this={canvas} class="w-full h-full object-contain"></canvas>

    <!-- Inset hairline to lift the frame off a dark canvas -->
    <div class="pointer-events-none absolute inset-0 rounded-lg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"></div>

    <!-- Live-level cue -->
    <div
      class="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/40 px-2.5 py-1 ring-1 ring-white/5 backdrop-blur-sm"
    >
      <span
        class="inline-block h-1.5 w-1.5 rounded-full transition-colors duration-300 {live
          ? 'bg-audio shadow-[0_0_6px_var(--color-audio)]'
          : 'bg-white/25'}"
      ></span>
      <span
        class="text-[9px] tracking-[0.2em] uppercase {live ? 'text-audio' : 'text-white/35'}"
        style="font-family:'Raleway',sans-serif">{live ? 'Live' : 'Idle'}</span
      >
      <span class="flex items-end gap-[2px] h-3">
        {#each meter as v, i}
          <span
            class="w-[3px] rounded-full bg-audio origin-bottom"
            style={live
              ? `height:${Math.max(12, v * 100)}%;opacity:${0.4 + v * 0.6}`
              : `height:100%;opacity:0.4;animation:audio-idle 1.1s ease-in-out ${i * 0.12}s infinite`}
          ></span>
        {/each}
      </span>
    </div>
  </div>
</div>
