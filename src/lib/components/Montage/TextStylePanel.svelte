<!-- src/lib/components/Montage/TextStylePanel.svelte -->
<script lang="ts">
  import { montageStore } from '$lib/stores/montage.svelte';
  import { FONT_FAMILIES, getFontFamily } from '$lib/montage/fonts';
  import type { TextStyle } from '$lib/montage/model';

  // px the size maps to on the 1080p export frame — shown so the slider is legible.
  const pxAt1080 = (pct: number) => Math.round(1080 * pct);
</script>

{#snippet group(label: string, style: TextStyle, set: (patch: Partial<TextStyle>) => void)}
  <div class="flex flex-col gap-2">
    <span class="text-xs tracking-wider text-gold/50 uppercase" style="font-family:'Raleway',sans-serif">{label}</span>

    <div class="grid grid-cols-2 gap-2">
      <select
        aria-label="{label} font family"
        value={style.fontFamilyId}
        onchange={(e) => set({ fontFamilyId: (e.target as HTMLSelectElement).value })}
        class="bg-white/5 border border-gold/20 rounded px-2 py-1.5 text-sm text-white/80 focus:outline-none focus:border-gold/50"
      >
        {#each FONT_FAMILIES as f (f.id)}
          <option value={f.id}>{f.label}</option>
        {/each}
      </select>

      <select
        aria-label="{label} font weight"
        value={style.fontWeight}
        onchange={(e) => set({ fontWeight: Number((e.target as HTMLSelectElement).value) })}
        class="bg-white/5 border border-gold/20 rounded px-2 py-1.5 text-sm text-white/80 focus:outline-none focus:border-gold/50"
      >
        {#each getFontFamily(style.fontFamilyId).weights as w (w)}
          <option value={w}>{w}</option>
        {/each}
      </select>
    </div>

    <div class="flex items-center gap-3">
      <input
        aria-label="{label} font size"
        type="range"
        min="0.03"
        max="0.14"
        step="0.005"
        value={style.sizePct}
        oninput={(e) => set({ sizePct: Number((e.target as HTMLInputElement).value) })}
        class="flex-1 accent-gold"
      />
      <span class="text-xs text-white/40 tabular-nums w-12 text-right">{pxAt1080(style.sizePct)}px</span>
      <input
        aria-label="{label} text color"
        type="color"
        value={style.color}
        oninput={(e) => set({ color: (e.target as HTMLInputElement).value })}
        class="w-8 h-8 rounded cursor-pointer bg-transparent border border-gold/20"
      />
    </div>
  </div>
{/snippet}

<details class="border border-gold/15 rounded">
  <summary
    class="cursor-pointer select-none px-3 py-2 text-sm tracking-wider text-gold/60 uppercase"
    style="font-family:'Raleway',sans-serif"
  >
    Text Style
  </summary>
  <div class="flex flex-col gap-4 px-3 pb-3 pt-1">
    {@render group('Title', montageStore.titleStyle, (p) => montageStore.setTitleStyle(p))}
    {@render group('Lyrics', montageStore.bandStyle, (p) => montageStore.setBandStyle(p))}
  </div>
</details>
