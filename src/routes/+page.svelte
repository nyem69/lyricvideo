<script lang="ts">
  import LyricsImport from '$lib/components/Editor/LyricsImport.svelte';
  import StylePicker from '$lib/components/Editor/StylePicker.svelte';
  import PlayerShell from '$lib/components/Player/PlayerShell.svelte';
  import Controls from '$lib/components/Player/Controls.svelte';
  import { Maximize } from '@lucide/svelte';

  let playerContainer: HTMLElement;

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      playerContainer?.requestFullscreen();
    }
  }
</script>

<div class="min-h-screen bg-surface text-white">
  <header class="flex items-center justify-between px-6 py-4 border-b border-gold/10">
    <h1 class="text-gold text-lg tracking-[0.3em] uppercase" style="font-family:'Raleway',sans-serif">Lyrics Video</h1>
    <button
      onclick={toggleFullscreen}
      class="text-gold/40 hover:text-gold transition-colors cursor-pointer"
      aria-label="Fullscreen"
    >
      <Maximize size={18} />
    </button>
  </header>

  <div class="flex flex-col lg:flex-row gap-6 p-6">
    <aside class="w-full lg:w-80 flex-shrink-0 flex flex-col gap-6">
      <LyricsImport />
      <StylePicker />
    </aside>

    <main class="flex-1 flex flex-col gap-4" bind:this={playerContainer}>
      <PlayerShell />
      <Controls />
    </main>
  </div>
</div>
