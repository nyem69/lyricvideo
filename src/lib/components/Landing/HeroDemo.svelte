<!-- src/lib/components/Landing/HeroDemo.svelte -->
<!-- A CSS-only stand-in for the product: a synced lyric line over a reactive
     equalizer, inside a 16:9 "video frame". Pure presentation, respects
     prefers-reduced-motion. -->
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  const bars = Array.from({ length: 28 }, (_, i) => i);
</script>

<div class="relative w-full rounded-xl overflow-hidden ring-1 ring-gold/20 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.85)]"
     aria-hidden="true"
     style="aspect-ratio:16/9;background:radial-gradient(90% 120% at 50% 120%, rgba(212,175,55,.18), transparent 60%), #0a1a0a">
  <div class="absolute inset-0 flex items-center justify-center px-8 text-center">
    <p class="lyric text-white" style="font-family:'Fraunces',serif;font-style:italic;font-size:clamp(20px,3vw,34px)">
      sembah berlalu, <span class="text-white/35">tinggal bayang…</span>
    </p>
  </div>
  <div class="eq absolute bottom-0 left-0 right-0 flex items-end gap-[3px] h-16 px-3 opacity-90">
    {#each bars as i}
      <span class="flex-1 rounded-t-sm" style="background:linear-gradient(#46d6c8,#d4af37);animation-delay:{(i % 7) * 0.09}s"></span>
    {/each}
  </div>
  <div class="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/40 px-2.5 py-1 ring-1 ring-white/10 backdrop-blur-sm">
    <span class="h-1.5 w-1.5 rounded-full bg-audio shadow-[0_0_6px_var(--color-audio)]"></span>
    <span class="text-[9px] tracking-[0.2em] uppercase text-audio" style="font-family:'Raleway',sans-serif">{m.hero_preview_badge()}</span>
  </div>
</div>

<style>
  .eq span { height: 20%; animation: bar 1s ease-in-out infinite; }
  @keyframes bar { 0%, 100% { height: 18%; } 50% { height: 92%; } }
  .lyric { animation: fade 4s ease-in-out infinite; }
  @keyframes fade { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    .eq span { animation: none; height: 55%; }
    .lyric { animation: none; opacity: 1; }
  }
</style>
