<script lang="ts">
  import { playerStore } from '$lib/stores/player.svelte';
  import { Play, Pause, RotateCcw, Upload } from '@lucide/svelte';

  let audioInput: HTMLInputElement;

  function handleAudioUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) playerStore.loadAudio(file);
  }

  function handleSeekInput(e: Event) {
    playerStore.seekTo(parseFloat((e.target as HTMLInputElement).value));
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
    if (e.code === 'Space') { e.preventDefault(); playerStore.toggle(); }
    if (e.code === 'KeyR') playerStore.restart();
    if (e.code === 'ArrowLeft') { e.preventDefault(); playerStore.seekTo(playerStore.currentTime - 5); }
    if (e.code === 'ArrowRight') { e.preventDefault(); playerStore.seekTo(playerStore.currentTime + 5); }
  }}
/>

<div class="flex items-center gap-3 px-4 py-3 bg-black/50 rounded">
  <button
    onclick={() => playerStore.toggle()}
    class="text-gold hover:text-gold/80 transition-colors cursor-pointer"
    aria-label={playerStore.isPlaying ? 'Pause' : 'Play'}
  >
    {#if playerStore.isPlaying}
      <Pause size={20} />
    {:else}
      <Play size={20} />
    {/if}
  </button>

  <button
    onclick={() => playerStore.restart()}
    class="text-gold/60 hover:text-gold transition-colors cursor-pointer"
    aria-label="Restart"
  >
    <RotateCcw size={16} />
  </button>

  <span class="text-xs text-gold/50 font-mono min-w-[40px]">
    {playerStore.formattedTime}
  </span>

  <input
    type="range"
    min="0"
    max={playerStore.duration || 1}
    step="0.1"
    value={playerStore.currentTime}
    onmousedown={() => playerStore.isSeeking = true}
    ontouchstart={() => playerStore.isSeeking = true}
    oninput={handleSeekInput}
    class="flex-1 h-1 accent-gold cursor-pointer"
  />

  <span class="text-xs text-gold/50 font-mono min-w-[40px]">
    {playerStore.formattedDuration}
  </span>

  <button
    onclick={() => audioInput.click()}
    class="text-gold/60 hover:text-gold transition-colors cursor-pointer"
    aria-label="Upload audio"
  >
    <Upload size={16} />
  </button>
  <input
    bind:this={audioInput}
    type="file"
    accept="audio/*"
    onchange={handleAudioUpload}
    class="hidden"
  />
</div>

<svelte:document
  onmouseup={() => playerStore.isSeeking = false}
  ontouchend={() => playerStore.isSeeking = false}
/>
