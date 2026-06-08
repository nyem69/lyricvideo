<!-- src/lib/components/Landing/TrustStrip.svelte -->
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
</script>

<div class="px-6 py-5 border-y border-gold/10 bg-white/[0.02]">
  <div class="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-2 text-xs uppercase tracking-[0.18em] text-white/45" style="font-family:'Raleway',sans-serif">
    <span>{m.trust_browser()}</span>
    <span aria-hidden="true" class="text-gold/30">·</span>
    <span>{m.trust_no_upload()}</span>
    <span aria-hidden="true" class="text-gold/30">·</span>
    <span>{m.trust_no_account()}</span>
  </div>
</div>
