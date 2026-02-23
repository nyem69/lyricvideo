import type { StylePreset, PresetId } from '$lib/model/types';
import { cleanSubtitle } from './clean-subtitle';
import { cinematicMinimal } from './cinematic-minimal';
import { boldImpact } from './bold-impact';
import { elegantCeremony } from './elegant-ceremony';

export const presets: Record<PresetId, StylePreset> = {
  'clean-subtitle': cleanSubtitle,
  'cinematic-minimal': cinematicMinimal,
  'bold-impact': boldImpact,
  'elegant-ceremony': elegantCeremony
};

export const presetList: StylePreset[] = Object.values(presets);

export function getPreset(id: PresetId): StylePreset {
  return presets[id];
}
