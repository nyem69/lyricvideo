<!-- src/routes/dev/visualizer/+page.svelte -->
<!-- DEV MOCKUP index — gallery of candidate visualizer styles for review. -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { base } from '$app/paths';
  import { VizAudio } from '$lib/dev/visualizer/audio-harness';
  import { VIZ_STYLES } from '$lib/dev/visualizer/viz-styles';

  // One shared synthetic-audio source drives every thumbnail so the gallery is
  // alive at a glance (no song needed — open a style to load your own track).
  let audio: VizAudio | null = null;
  let canvases: HTMLCanvasElement[] = [];
  let raf = 0;
  let destroyed = false;

  onMount(() => {
    audio = new VizAudio();
    const start = performance.now();
    const loop = () => {
      if (destroyed) return;
      if (audio) {
        audio.sample();
        const t = (performance.now() - start) / 1000;
        VIZ_STYLES.forEach((style, i) => {
          const c = canvases[i];
          const ctx = c?.getContext('2d');
          if (ctx && audio) {
            style.draw({ ctx, w: c.width, h: c.height, freq: audio.freq, wave: audio.wave, t, title: '' });
          }
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  });

  onDestroy(() => {
    destroyed = true;
    cancelAnimationFrame(raf);
    audio?.destroy();
  });
</script>

<svelte:head><title>Visualizer style mockups</title></svelte:head>

<div class="min-h-screen bg-surface text-white">
  <header class="flex items-center justify-between px-6 py-4 border-b border-gold/10">
    <h1 class="text-gold text-lg tracking-[0.3em] uppercase" style="font-family:'Raleway',sans-serif">
      Visualizer Mockups
    </h1>
    <a href="{base}/montage" class="text-gold/40 hover:text-gold text-xs uppercase tracking-wider">Montage &rarr;</a>
  </header>

  <div class="p-6 max-w-6xl mx-auto flex flex-col gap-6">
    <p class="text-white/50 text-sm leading-relaxed max-w-2xl">
      Candidate styles for the audio-visualizer feature (a sibling to
      <code class="text-gold">/montage</code> that animates to the song instead of photos).
      Thumbnails below run on a synthetic signal. Click any style to open it full-size and load your
      own track for a real, audio-reactive preview.
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {#each VIZ_STYLES as style, i}
        <a
          href="{base}/dev/visualizer/{style.id}"
          class="group flex flex-col gap-2 rounded-lg border border-gold/10 hover:border-gold/40 bg-black/30 overflow-hidden transition-all"
        >
          <div class="w-full aspect-video bg-black">
            <canvas
              bind:this={canvases[i]}
              width="480"
              height="270"
              class="w-full h-full object-contain"
            ></canvas>
          </div>
          <div class="px-4 pb-4 pt-1 flex flex-col gap-1">
            <span
              class="text-gold text-sm tracking-widest uppercase group-hover:translate-x-0.5 transition-transform"
              style="font-family:'Raleway',sans-serif">{style.name}</span
            >
            <span class="text-white/40 text-xs leading-snug">{style.desc}</span>
          </div>
        </a>
      {/each}
    </div>
  </div>
</div>
