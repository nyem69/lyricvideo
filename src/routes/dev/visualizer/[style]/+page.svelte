<!-- src/routes/dev/visualizer/[style]/+page.svelte -->
<!-- DEV MOCKUP — live audio-reactive preview of one visualizer style. -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { VizAudio } from '$lib/dev/visualizer/audio-harness';
  import { VIZ_STYLES, VIZ_STYLE_MAP } from '$lib/dev/visualizer/viz-styles';

  let canvas = $state<HTMLCanvasElement>();
  let fileInput = $state<HTMLInputElement>();
  let audio: VizAudio | null = null;
  let raf = 0;
  let destroyed = false;

  let playing = $state(false);
  let hasAudio = $state(false);
  let title = $state('Your Song Title');
  let fileName = $state('');

  const styleId = $derived($page.params.style ?? '');
  const style = $derived(VIZ_STYLE_MAP[styleId]);

  onMount(() => {
    audio = new VizAudio();
    const start = performance.now();
    const loop = () => {
      if (destroyed) return;
      if (canvas && audio && style) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          audio.sample();
          style.draw({
            ctx,
            w: canvas.width,
            h: canvas.height,
            freq: audio.freq,
            wave: audio.wave,
            t: (performance.now() - start) / 1000,
            title,
          });
        }
        playing = audio.isPlaying;
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

  async function onFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !audio) return;
    fileName = file.name;
    if (!title || title === 'Your Song Title') title = file.name.replace(/\.[^.]+$/, '');
    await audio.load(file);
    hasAudio = true;
    await audio.play();
  }

  function toggle() {
    audio?.toggle();
  }
</script>

<svelte:head><title>Visualizer mockup — {style?.name ?? styleId}</title></svelte:head>

<div class="min-h-screen bg-surface text-white">
  <header class="flex items-center justify-between px-6 py-4 border-b border-gold/10">
    <a
      href="{base}/dev/visualizer"
      class="text-gold/40 hover:text-gold text-xs uppercase tracking-wider">&larr; All styles</a
    >
    <h1
      class="text-gold text-lg tracking-[0.3em] uppercase"
      style="font-family:'Raleway',sans-serif"
    >
      {style?.name ?? 'Unknown style'}
    </h1>
    <span class="text-white/20 text-xs uppercase tracking-wider">mockup</span>
  </header>

  {#if !style}
    <p class="p-6 text-white/60">
      No style named <code class="text-gold">{styleId}</code>. Go back to
      <a class="text-gold underline" href="{base}/dev/visualizer">all styles</a>.
    </p>
  {:else}
    <div class="p-6 flex flex-col gap-4 max-w-5xl mx-auto">
      <p class="text-white/50 text-sm leading-relaxed">{style.desc}</p>

      <div class="w-full aspect-video bg-black rounded overflow-hidden border border-gold/10">
        <canvas bind:this={canvas} width="1280" height="720" class="w-full h-full object-contain"
        ></canvas>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <input
          bind:this={fileInput}
          type="file"
          accept="audio/*"
          class="hidden"
          onchange={onFile}
        />
        <button
          onclick={() => fileInput?.click()}
          class="bg-gold/15 border border-gold/30 text-gold px-4 py-2 text-sm tracking-widest uppercase rounded cursor-pointer hover:bg-gold/30 transition-all"
          style="font-family:'Raleway',sans-serif">Load song</button
        >
        <button
          onclick={toggle}
          disabled={!hasAudio}
          class="bg-white/5 border border-gold/20 text-white/80 px-4 py-2 text-sm tracking-widest uppercase rounded cursor-pointer hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style="font-family:'Raleway',sans-serif">{playing ? 'Pause' : 'Play'}</button
        >
        <input
          type="text"
          bind:value={title}
          placeholder="Title overlay"
          class="flex-1 min-w-40 bg-white/5 border border-gold/20 rounded px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-gold/50"
        />
      </div>
      <p class="text-white/30 text-xs">
        {#if fileName}Loaded: {fileName}{:else}No song loaded — showing a synthetic signal so you
          can see the motion. Load a song to react to real audio.{/if}
      </p>

      <nav class="flex flex-wrap gap-2 pt-2 border-t border-gold/10">
        {#each VIZ_STYLES as s}
          <a
            href="{base}/dev/visualizer/{s.id}"
            class="px-3 py-1 text-xs uppercase tracking-wider rounded border transition-all {s.id ===
            styleId
              ? 'border-gold/50 text-gold bg-gold/10'
              : 'border-gold/15 text-white/40 hover:text-gold'}">{s.name}</a
          >
        {/each}
      </nav>
    </div>
  {/if}
</div>
