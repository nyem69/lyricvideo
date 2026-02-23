<script lang="ts">
  import { projectStore } from '$lib/stores/project.svelte';
  import { presetList } from '$lib/presets';
  import type { PresetId } from '$lib/model/types';

  function select(id: PresetId) {
    projectStore.setGlobalPreset(id);
  }
</script>

<div class="flex flex-col gap-3">
  <label class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif">
    Style
  </label>
  <div class="grid grid-cols-2 gap-2">
    {#each presetList as preset}
      <button
        onclick={() => select(preset.id)}
        class="relative text-left p-3 rounded border transition-all cursor-pointer {projectStore.styleMap.global === preset.id
          ? 'border-gold bg-gold/15'
          : 'border-white/10 bg-white/5 hover:border-gold/30'}"
      >
        <div
          class="h-12 rounded mb-2 flex items-center justify-center overflow-hidden"
          style="background:{preset.config.background}"
        >
          <span style="font-family:{preset.config.fontFamily};color:{preset.config.color};font-size:14px;font-weight:{preset.config.fontWeight};letter-spacing:{preset.config.letterSpacing};text-transform:{preset.config.textTransform}">
            Sample
          </span>
        </div>
        <div class="text-xs text-white/80 font-medium">{preset.name}</div>
        <div class="text-xs text-white/40 mt-0.5">{preset.description}</div>
      </button>
    {/each}
  </div>
</div>
