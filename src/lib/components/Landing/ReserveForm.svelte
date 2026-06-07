<!-- src/lib/components/Landing/ReserveForm.svelte -->
<script lang="ts">
  import { tick } from 'svelte';
  import { submitReserve } from '$lib/landing/reserve-client';

  let email = $state('');
  let note = $state('');
  let hp = $state(''); // honeypot
  let formState: 'idle' | 'submitting' | 'success' | 'error' = $state('idle');
  let errorMsg = $state('');
  let fallbackUrl = $state('');
  let successEl = $state<HTMLDivElement>();

  async function onSubmit(e: Event) {
    e.preventDefault();
    if (formState === 'submitting') return;
    formState = 'submitting';
    errorMsg = '';
    fallbackUrl = '';
    const r = await submitReserve({ email, note, hp });
    if (r.ok) {
      formState = 'success';
      // The success view replaces the form; move focus to it so a screen-reader
      // user isn't dropped on <body>, and the role="status" region is announced.
      await tick();
      successEl?.focus();
    } else if (r.invalid) {
      formState = 'error';
      errorMsg = 'Please enter a valid email address.';
    } else {
      // endpoint unavailable — offer the mailto fallback so no reservation is lost
      formState = 'error';
      errorMsg = 'Could not reach our list. Tap below to reserve by email instead.';
      fallbackUrl = r.fallback ?? '';
    }
  }
</script>

{#if formState === 'success'}
  <div
    bind:this={successEl}
    tabindex="-1"
    role="status"
    aria-atomic="true"
    class="rounded-xl border border-audio/40 bg-audio/10 p-6 text-center focus:outline-none"
  >
    <p class="text-audio font-semibold" style="font-family:'Raleway',sans-serif">You're on the Founder list.</p>
    <p class="text-white/70 text-sm mt-1">Your $24 early price is reserved. We'll email you when Founder access opens.</p>
  </div>
{:else}
  <form onsubmit={onSubmit} class="flex flex-col gap-3" novalidate>
    <!-- honeypot: hidden from humans, bots fill it -->
    <input
      bind:value={hp}
      name="company"
      tabindex="-1"
      autocomplete="off"
      aria-hidden="true"
      class="absolute left-[-9999px] h-0 w-0 opacity-0"
    />
    <input
      bind:value={email}
      type="email"
      required
      placeholder="you@email.com"
      aria-label="Email address"
      class="w-full bg-white/5 border border-gold/25 rounded-lg px-4 py-3 text-white/90 placeholder:text-white/30 focus:outline-none focus:border-gold/60"
    />
    <textarea
      bind:value={note}
      rows="2"
      placeholder="What will you make? (optional)"
      aria-label="What will you make"
      class="w-full bg-white/5 border border-gold/20 rounded-lg px-4 py-3 text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-gold/50 resize-y"
    ></textarea>
    <button
      type="submit"
      disabled={formState === 'submitting'}
      class="bg-gold text-surface font-semibold px-5 py-3 rounded-lg tracking-wide uppercase text-sm hover:bg-gold/90 disabled:opacity-60 disabled:cursor-wait transition-all"
      style="font-family:'Raleway',sans-serif"
    >
      {formState === 'submitting' ? 'Reserving…' : 'Reserve my $24 founder price'}
    </button>
    <p class="text-xs text-white/40 text-center">No charge today. We'll email you when Founder access opens.</p>
    <!-- Live region is always in the DOM so injected error text is announced (AT
         miss content added together with a fresh role="alert" node). -->
    <div role="alert" aria-live="assertive" aria-atomic="true" class="flex flex-col gap-1">
      {#if formState === 'error'}
        <p class="text-sm text-red-300 text-center">{errorMsg}</p>
        {#if fallbackUrl}
          <a href={fallbackUrl} aria-label="Reserve by email" class="text-sm text-audio underline text-center">Reserve by email →</a>
        {/if}
      {/if}
    </div>
  </form>
{/if}
