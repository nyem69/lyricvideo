<!-- src/routes/visualizer/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import Controls from '$lib/components/Player/Controls.svelte';
  import TextStylePanel from '$lib/components/Montage/TextStylePanel.svelte';
  import VisualizerStage from '$lib/components/Visualizer/VisualizerStage.svelte';
  import VizStylePicker from '$lib/components/Visualizer/VizStylePicker.svelte';
  import FormatPicker from '$lib/components/Visualizer/FormatPicker.svelte';
  import ExportButton from '$lib/components/Visualizer/ExportButton.svelte';
  import { visualizerStore } from '$lib/stores/visualizer.svelte';

  let canvasEl = $state<HTMLCanvasElement>();
  let audioInput: HTMLInputElement;
  let bgInput: HTMLInputElement;

  onMount(() => {
    visualizerStore.restore();
  });

  function onAudio(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) visualizerStore.loadAudio(file);
  }
  function onBackground(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) visualizerStore.setBackground(file);
  }
</script>

<div class="min-h-screen bg-surface text-white">
  <header class="flex items-center justify-between px-6 py-4 border-b border-gold/10">
    <h1 class="text-gold text-lg tracking-[0.3em] uppercase" style="font-family:'Raleway',sans-serif">
      Audio Visualizer
    </h1>
    <div class="flex gap-4 items-center">
      <a href="{base}/studio" class="text-gold/40 hover:text-gold text-xs uppercase tracking-wider">← Studio</a>
      <a href="{base}/montage" class="text-gold/40 hover:text-gold text-xs uppercase tracking-wider">Photo montage →</a>
    </div>
  </header>

  <div class="flex flex-col min-[1100px]:flex-row items-start gap-6 p-6">
    <aside class="w-full min-[1100px]:w-96 flex-shrink-0 flex flex-col gap-6 order-2 min-[1100px]:order-1">
      <div class="flex flex-col gap-2">
        <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif">Video Title</span>
        <input
          type="text"
          value={visualizerStore.videoTitle}
          oninput={(e) => visualizerStore.setTitle((e.target as HTMLInputElement).value)}
          placeholder="Visualizer"
          class="w-full bg-white/5 border border-gold/20 rounded px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-gold/50"
        />
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif">Song</span>
        <input bind:this={audioInput} type="file" accept="audio/*" class="hidden" onchange={onAudio} />
        <button
          onclick={() => audioInput.click()}
          class="bg-gold/15 border border-gold/30 text-gold px-4 py-2 text-sm tracking-widest uppercase rounded cursor-pointer hover:bg-gold/30 transition-all"
          style="font-family:'Raleway',sans-serif">Add Song</button
        >
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif">Background / Album Art</span>
        <input bind:this={bgInput} type="file" accept="image/*" class="hidden" onchange={onBackground} />
        <div class="flex gap-2">
          <button
            onclick={() => bgInput.click()}
            class="flex-1 bg-gold/15 border border-gold/30 text-gold px-4 py-2 text-sm tracking-widest uppercase rounded cursor-pointer hover:bg-gold/30 transition-all"
            style="font-family:'Raleway',sans-serif">{visualizerStore.backgroundKey ? 'Change' : 'Add Image'}</button
          >
          {#if visualizerStore.backgroundKey}
            <button
              onclick={() => visualizerStore.removeBackground()}
              class="bg-white/5 border border-gold/20 text-white/60 px-3 py-2 text-sm rounded cursor-pointer hover:bg-white/10 transition-all">Remove</button
            >
          {/if}
        </div>
      </div>

      <VizStylePicker />
      <FormatPicker />

      <div class="flex flex-col gap-2">
        <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif">Lyrics (timestamps)</span>
        <textarea
          value={visualizerStore.lyricsText}
          oninput={(e) => visualizerStore.importLyrics((e.target as HTMLTextAreaElement).value)}
          rows="8"
          placeholder={"[00:11.162] Sembah [00:11.392] berlalu..."}
          class="w-full bg-white/5 border border-gold/20 rounded px-3 py-2 text-sm text-white/80 font-mono placeholder:text-white/20 focus:outline-none focus:border-gold/50 resize-y"
        ></textarea>
      </div>

      <TextStylePanel
        titleStyle={visualizerStore.titleStyle}
        bandStyle={visualizerStore.bandStyle}
        setTitleStyle={(p) => visualizerStore.setTitleStyle(p)}
        setBandStyle={(p) => visualizerStore.setBandStyle(p)}
      />
    </aside>

    <main
      class="w-full flex-1 flex flex-col gap-4 order-1 min-[1100px]:order-2 min-[1100px]:sticky min-[1100px]:top-6 min-[1100px]:self-start"
    >
      <VisualizerStage onCanvasReady={(c) => (canvasEl = c)} />
      <Controls hideAudioUpload />
      {#if canvasEl && visualizerStore.ready}
        <ExportButton getCanvas={() => canvasEl} />
      {/if}
    </main>
  </div>
</div>
