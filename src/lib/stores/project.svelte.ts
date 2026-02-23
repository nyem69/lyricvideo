import type { Song, StyleMap, PresetId } from '$lib/model/types';
import { parseSunoTimestamps } from '$lib/parser/suno';
import { playerStore } from './player.svelte';

class ProjectStore {
  song = $state<Song | null>(null);
  styleMap = $state<StyleMap>({ global: 'elegant-ceremony', sections: {} });

  readonly currentSection = $derived.by(() => {
    if (!this.song) return null;
    const t = playerStore.currentTime;
    return this.song.sections.find(s => t >= s.startTime && t < s.endTime) ?? null;
  });

  readonly activePresetId = $derived.by(() => {
    const section = this.currentSection;
    if (section && this.styleMap.sections[section.id]) {
      return this.styleMap.sections[section.id];
    }
    return this.styleMap.global;
  });

  importTimestamps(text: string) {
    const result = parseSunoTimestamps(text);
    this.song = result;
    playerStore.setDuration(result.duration);
  }

  setGlobalPreset(presetId: PresetId) {
    this.styleMap = { ...this.styleMap, global: presetId };
  }

  setSectionPreset(sectionId: string, presetId: PresetId) {
    this.styleMap = {
      ...this.styleMap,
      sections: { ...this.styleMap.sections, [sectionId]: presetId }
    };
  }

  clear() {
    this.song = null;
    playerStore.restart();
  }
}

export const projectStore = new ProjectStore();
