<script lang="ts">
  import { projectStore } from '$lib/stores/project.svelte';
  import { toast } from 'svelte-sonner';

  let text = $state('');

  function handleImport() {
    if (!text.trim()) {
      toast.error('Paste timestamp data first');
      return;
    }
    projectStore.importTimestamps(text);
    const song = projectStore.song;
    if (song && song.sections.length > 0) {
      const lineCount = song.sections.reduce((n, s) => n + s.lines.length, 0);
      toast.success(`Imported ${lineCount} lines in ${song.sections.length} sections`);
    } else {
      toast.error('No lyrics found. Check the format.');
    }
  }
</script>

<div class="flex flex-col gap-3">
  <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif">
    Import Timestamps
  </span>
  <textarea
    bind:value={text}
    placeholder={"Paste Suno timestamp output here...\n\n[00:11.162] Sembah [00:11.392] berlalu..."}
    rows="8"
    class="w-full bg-white/5 border border-gold/20 rounded px-3 py-2 text-sm text-white/80 font-mono placeholder:text-white/20 focus:outline-none focus:border-gold/50 resize-y"
  ></textarea>
  <button
    onclick={handleImport}
    class="bg-gold/15 border border-gold/30 text-gold px-4 py-2 text-sm tracking-widest uppercase rounded cursor-pointer hover:bg-gold/30 hover:border-gold transition-all"
    style="font-family:'Raleway',sans-serif"
  >
    Parse
  </button>

  {#if projectStore.song}
    <div class="flex flex-col gap-1 mt-2">
      <div class="text-xs text-gold/40 uppercase tracking-wider">
        {projectStore.song.title}
      </div>
      {#each projectStore.song.sections as section, i}
        <div class="text-xs text-white/40 pl-2 border-l border-gold/10">
          {section.type} {i + 1} — {section.lines.length} lines
        </div>
      {/each}
    </div>
  {/if}
</div>
