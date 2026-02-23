<script lang="ts">
  import { onMount } from 'svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { projectStore } from '$lib/stores/project.svelte';
  import { CssRenderer } from '$lib/renderer/css-renderer';
  import { getPreset } from '$lib/presets';

  let containerEl: HTMLElement;
  let renderer: CssRenderer | null = null;

  onMount(() => {
    renderer = new CssRenderer();
    renderer.mount(containerEl);
    renderer.setPreset(getPreset(projectStore.styleMap.global));

    return () => renderer?.destroy();
  });

  $effect(() => {
    const presetId = projectStore.activePresetId;
    if (renderer) renderer.setPreset(getPreset(presetId));
  });

  $effect(() => {
    const time = playerStore.currentTime;
    const section = projectStore.currentSection;
    if (renderer) renderer.update(time, section);
  });
</script>

<div
  bind:this={containerEl}
  class="w-full aspect-video bg-black rounded overflow-hidden"
></div>
