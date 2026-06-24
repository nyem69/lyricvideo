<!-- src/lib/components/Visualizer/ColorPicker.svelte -->
<script lang="ts">
  import { DEFAULT_VIZ_COLOR } from '$lib/visualizer/model';

  interface Preset {
    hex: string;
    name: string;
  }

  // Generic swatch picker — drives any `#rrggbb` value via `onPick`. Used for both
  // the visualizer accent and the stage background color, so the two controls
  // stay visually identical without duplicating the swatch/markup logic.
  interface Props {
    label: string;
    value: string;
    onPick: (hex: string) => void;
    presets?: Preset[];
  }

  // Default presets read well as a visualizer ACCENT over the dark stage. The
  // first is the antique-gold default; the rest span warm -> cool.
  const DEFAULT_PRESETS: Preset[] = [
    { hex: DEFAULT_VIZ_COLOR, name: 'Gold' },
    { hex: '#46d6c8', name: 'Teal' },
    { hex: '#38bdf8', name: 'Sky' },
    { hex: '#8b5cf6', name: 'Violet' },
    { hex: '#ff4f81', name: 'Rose' },
    { hex: '#ef4444', name: 'Red' },
    { hex: '#f59e0b', name: 'Amber' },
    { hex: '#a3e635', name: 'Lime' },
    { hex: '#fdf6e3', name: 'Cream' },
  ];

  let { label, value, onPick, presets = DEFAULT_PRESETS }: Props = $props();

  const current = $derived(value.toLowerCase());
  const isPreset = $derived(presets.some((p) => p.hex.toLowerCase() === current));
</script>

<div class="flex flex-col gap-2">
  <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif"
    >{label}</span
  >
  <div class="flex flex-wrap items-center gap-2">
    {#each presets as p}
      <button
        type="button"
        title={p.name}
        aria-label={p.name}
        aria-pressed={p.hex.toLowerCase() === current}
        onclick={() => onPick(p.hex)}
        class="h-7 w-7 rounded-full ring-1 ring-white/15 transition-transform hover:scale-110 {p.hex.toLowerCase() ===
        current
          ? 'ring-2 ring-offset-2 ring-offset-surface ring-white/80'
          : ''}"
        style="background-color: {p.hex}"
      ></button>
    {/each}

    <!-- Custom: a native color well. The ring lights when the active color is
         not one of the presets, so a hand-picked hue reads as "selected". -->
    <label
      class="relative h-7 w-7 rounded-full overflow-hidden ring-1 ring-white/15 cursor-pointer transition-transform hover:scale-110 {!isPreset
        ? 'ring-2 ring-offset-2 ring-offset-surface ring-white/80'
        : ''}"
      title="Custom color"
      style="background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red)"
    >
      <input
        type="color"
        {value}
        oninput={(e) => onPick((e.target as HTMLInputElement).value)}
        class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  </div>
</div>
