<!-- src/lib/components/Landing/ReserveSection.svelte -->
<script lang="ts">
  import ReserveForm from './ReserveForm.svelte';
</script>

<section id="reserve" class="px-6 py-20 border-t border-gold/10">
  <div class="max-w-xl mx-auto text-center">
    <p class="text-xs tracking-[0.3em] uppercase text-gold/60" style="font-family:'Raleway',sans-serif">Founder access</p>
    <h2 class="mt-3 text-3xl md:text-4xl text-white" style="font-family:'Playfair Display',serif">
      Reserve your <span class="text-gold">$24</span> founder price
    </h2>
    <p class="mt-3 text-white/55">Lock in lifetime access at the early price. Pro features roll out over the coming weeks — founders get them all.</p>
    <div class="mt-8 text-left">
      <ReserveForm />
    </div>
  </div>
</section>
