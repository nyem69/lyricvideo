<!-- src/routes/montage/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { AUDIO_ACCEPT } from '$lib/media/accept';
  import { base } from '$app/paths';
  import Controls from '$lib/components/Player/Controls.svelte';
  import PhotoTray from '$lib/components/Montage/PhotoTray.svelte';
  import TextStylePanel from '$lib/components/Montage/TextStylePanel.svelte';
  import MontageStage from '$lib/components/Montage/MontageStage.svelte';
  import ExportButton from '$lib/components/Montage/ExportButton.svelte';
  import { montageStore } from '$lib/stores/montage.svelte';

  // MontageStage hands its canvas up via onCanvasReady; ExportButton reads it
  // back through getCanvas(). The {#if} below ensures it's set before export.
  let canvasEl = $state<HTMLCanvasElement>();
  let audioInput: HTMLInputElement;

  onMount(() => {
    montageStore.restore();
  });

  function onAudio(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) montageStore.loadAudio(file);
  }
</script>

<div class="min-h-screen bg-surface text-white">
  <header class="flex items-center justify-between px-6 py-4 border-b border-gold/10">
    <h1 class="text-gold text-lg tracking-[0.3em] uppercase" style="font-family:'Raleway',sans-serif">Photo Montage</h1>
    <div class="flex gap-4 items-center">
      <a href="{base}/studio" class="text-gold/40 hover:text-gold text-xs uppercase tracking-wider">← Studio</a>
      <a href="{base}/visualizer" class="text-gold/40 hover:text-gold text-xs uppercase tracking-wider">Visualizer →</a>
    </div>
  </header>

  <div class="flex flex-col min-[1100px]:flex-row items-start gap-6 p-6">
    <aside class="w-full min-[1100px]:w-96 flex-shrink-0 flex flex-col gap-6 order-2 min-[1100px]:order-1">
      <div class="flex flex-col gap-2">
        <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif">Video Title</span>
        <input
          type="text"
          value={montageStore.videoTitle}
          oninput={(e) => montageStore.setTitle((e.target as HTMLInputElement).value)}
          placeholder="Montage"
          class="w-full bg-white/5 border border-gold/20 rounded px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-gold/50"
        />
      </div>

      <PhotoTray />

      <div class="flex flex-col gap-2">
        <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif">Song</span>
        <input bind:this={audioInput} type="file" accept={AUDIO_ACCEPT} class="hidden" onchange={onAudio} />
        <button
          onclick={() => audioInput.click()}
          class="bg-gold/15 border border-gold/30 text-gold px-4 py-2 text-sm tracking-widest uppercase rounded cursor-pointer hover:bg-gold/30 transition-all"
          style="font-family:'Raleway',sans-serif"
        >
          Add Song
        </button>
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif">Lyrics (Suno / LRC / SRT)</span>
        <textarea
          value={montageStore.lyricsText}
          oninput={(e) => montageStore.importLyrics((e.target as HTMLTextAreaElement).value)}
          rows="8"
          placeholder={"Paste Suno [00:11.16] word timestamps, an .lrc, or an .srt — auto-detected"}
          class="w-full bg-white/5 border border-gold/20 rounded px-3 py-2 text-sm text-white/80 font-mono placeholder:text-white/20 focus:outline-none focus:border-gold/50 resize-y"
        ></textarea>
      </div>

      <TextStylePanel
        titleStyle={montageStore.titleStyle}
        bandStyle={montageStore.bandStyle}
        setTitleStyle={(p) => montageStore.setTitleStyle(p)}
        setBandStyle={(p) => montageStore.setBandStyle(p)}
      />
    </aside>

    <main
      class="w-full flex-1 flex flex-col gap-4 order-1 min-[1100px]:order-2 min-[1100px]:sticky min-[1100px]:top-6 min-[1100px]:self-start"
    >
      <MontageStage onCanvasReady={(c) => (canvasEl = c)} />
      <Controls hideAudioUpload />
      {#if canvasEl && montageStore.ready}
        <ExportButton getCanvas={() => canvasEl} />
      {/if}
    </main>
  </div>
</div>
