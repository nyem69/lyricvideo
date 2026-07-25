<!-- src/lib/components/Visualizer/SyncPanel.svelte -->
<script lang="ts">
  import { visualizerStore } from '$lib/stores/visualizer.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { plainEntries, toLrc, type PlainEntry } from '$lib/parser/lyrics';

  let open = $state(false);
  /** Tap time per LINE entry, in order. Length = how far through we are. */
  let taps = $state<number[]>([]);

  const entries = $derived(plainEntries(visualizerStore.lyricsText));
  const lines = $derived(entries.filter((e) => e.kind === 'line'));
  const done = $derived(taps.length >= lines.length && lines.length > 0);
  const currentLine = $derived(taps.length < lines.length ? lines[taps.length].text : '');
  const nextLine = $derived(taps.length + 1 < lines.length ? lines[taps.length + 1].text : '');

  function start() {
    taps = [];
    open = true;
    playerStore.seekTo(0);
    playerStore.play();
  }

  function tap() {
    if (done) return;
    taps = [...taps, playerStore.currentTime];
  }

  function undo() {
    taps = taps.slice(0, -1);
  }

  function reset() {
    taps = [];
    playerStore.seekTo(0);
  }

  function cancel() {
    playerStore.pause();
    open = false;
    taps = [];
  }

  /** Walk the ORIGINAL entry order so `[SECTION]` labels keep their place; a
   *  label takes the time of the line that follows it. */
  function apply() {
    playerStore.pause();
    let i = 0;
    const items: { text: string; startTime: number; label?: boolean }[] = [];
    for (const e of entries as PlainEntry[]) {
      if (e.kind === 'label') {
        items.push({ text: e.text, startTime: taps[i] ?? taps[taps.length - 1] ?? 0, label: true });
      } else {
        items.push({ text: e.text, startTime: taps[i] ?? 0 });
        i++;
      }
    }
    visualizerStore.importLyrics(toLrc(items));
    open = false;
    taps = [];
  }

  const mmss = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60)
      .toString()
      .padStart(2, '0')}`;
</script>

{#if !open}
  <button
    onclick={start}
    disabled={lines.length === 0}
    class="w-full rounded border border-gold/30 bg-gold/10 px-3 py-2 text-xs uppercase tracking-wider text-gold transition-all hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-40"
    style="font-family:'Raleway',sans-serif">Sync timings by tapping</button
  >
{:else}
  <div class="flex flex-col gap-2 rounded border border-gold/30 bg-gold/5 p-3">
    <div class="flex items-center justify-between text-[11px] uppercase tracking-wider text-gold/60">
      <span style="font-family:'Raleway',sans-serif">
        Tap each line · {taps.length}/{lines.length}
      </span>
      <span class="tabular-nums text-white/40">{mmss(playerStore.currentTime)}</span>
    </div>

    {#if done}
      <p class="py-2 text-center text-sm text-gold">All {lines.length} lines timed.</p>
    {:else}
      <p class="truncate py-1 text-center text-base font-semibold text-white">{currentLine}</p>
      {#if nextLine}
        <p class="truncate text-center text-[11px] text-white/35">next: {nextLine}</p>
      {/if}
    {/if}

    <!-- Big target: this gets tapped once per line, often on a phone. -->
    <button
      onclick={tap}
      disabled={done}
      class="w-full rounded bg-gold/20 py-4 text-sm uppercase tracking-[0.2em] text-gold transition-all hover:bg-gold/30 disabled:opacity-30"
      style="font-family:'Raleway',sans-serif">Tap</button
    >

    <div class="flex flex-wrap gap-2">
      <button
        onclick={() => playerStore.toggle()}
        class="flex-1 rounded border border-gold/20 px-2 py-1 text-[11px] uppercase tracking-wider text-white/60 hover:text-gold"
        style="font-family:'Raleway',sans-serif"
        >{playerStore.isPlaying ? 'Pause' : 'Play'}</button
      >
      <button
        onclick={undo}
        disabled={taps.length === 0}
        class="flex-1 rounded border border-gold/20 px-2 py-1 text-[11px] uppercase tracking-wider text-white/60 hover:text-gold disabled:opacity-30"
        style="font-family:'Raleway',sans-serif">Undo</button
      >
      <button
        onclick={reset}
        class="flex-1 rounded border border-gold/20 px-2 py-1 text-[11px] uppercase tracking-wider text-white/60 hover:text-gold"
        style="font-family:'Raleway',sans-serif">Reset</button
      >
    </div>

    <div class="flex gap-2">
      <button
        onclick={cancel}
        class="flex-1 rounded border border-white/15 px-2 py-1 text-[11px] uppercase tracking-wider text-white/50 hover:text-white"
        style="font-family:'Raleway',sans-serif">Cancel</button
      >
      <button
        onclick={apply}
        disabled={taps.length === 0}
        class="flex-1 rounded border border-gold/50 bg-gold/15 px-2 py-1 text-[11px] uppercase tracking-wider text-gold hover:bg-gold/25 disabled:opacity-30"
        style="font-family:'Raleway',sans-serif">Apply</button
      >
    </div>
    <p class="text-[10px] leading-relaxed text-white/30">
      Untapped lines keep 0:00 — Apply partway to time an intro, then re-sync.
    </p>
  </div>
{/if}
