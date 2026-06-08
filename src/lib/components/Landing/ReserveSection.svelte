<!-- src/lib/components/Landing/ReserveSection.svelte -->
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import ReserveForm from './ReserveForm.svelte';
</script>

<section id="reserve" class="px-6 py-20 border-t border-gold/10">
  <div class="max-w-xl mx-auto text-center">
    <p class="text-xs tracking-[0.3em] uppercase text-gold/60" style="font-family:'Raleway',sans-serif">{m.reserve_eyebrow()}</p>
    <h2 class="mt-3 text-3xl md:text-4xl text-white" style="font-family:'Playfair Display',serif">{m.reserve_heading()}</h2>
    <p class="mt-3 text-white/55">{m.reserve_supporting()}</p>
    <div class="mt-8 text-left">
      <ReserveForm />
    </div>
  </div>
</section>
