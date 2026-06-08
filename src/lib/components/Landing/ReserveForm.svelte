<!-- src/lib/components/Landing/ReserveForm.svelte -->
<script lang="ts">
  import { tick } from 'svelte';
  import { submitReserve } from '$lib/landing/reserve-client';
  import * as m from '$lib/paraglide/messages';

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
      errorMsg = m.reserve_err_invalid();
    } else {
      // endpoint unavailable — offer the mailto fallback so no reservation is lost
      formState = 'error';
      errorMsg = m.reserve_err_unreachable();
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
    <p class="text-audio font-semibold" style="font-family:'Raleway',sans-serif">{m.reserve_success_title()}</p>
    <p class="text-white/70 text-sm mt-1">{m.reserve_success_body()}</p>
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
      placeholder={m.reserve_email_placeholder()}
      aria-label={m.reserve_email_label()}
      class="w-full bg-white/5 border border-gold/25 rounded-lg px-4 py-3 text-white/90 placeholder:text-white/30 focus:outline-none focus:border-gold/60"
    />
    <textarea
      bind:value={note}
      rows="2"
      placeholder={m.reserve_note_placeholder()}
      aria-label={m.reserve_note_label()}
      class="w-full bg-white/5 border border-gold/20 rounded-lg px-4 py-3 text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-gold/50 resize-y"
    ></textarea>
    <button
      type="submit"
      disabled={formState === 'submitting'}
      class="bg-gold text-surface font-semibold px-5 py-3 rounded-lg tracking-wide uppercase text-sm hover:bg-gold/90 disabled:opacity-60 disabled:cursor-wait transition-all"
      style="font-family:'Raleway',sans-serif"
    >
      {formState === 'submitting' ? m.reserve_submit_busy() : m.reserve_submit_idle()}
    </button>
    <p class="text-xs text-white/40 text-center">{m.reserve_helper()}</p>
    <!-- Live region is always in the DOM so injected error text is announced (AT
         miss content added together with a fresh role="alert" node). -->
    <div role="alert" aria-live="assertive" aria-atomic="true" class="flex flex-col gap-1">
      {#if formState === 'error'}
        <p class="text-sm text-red-300 text-center">{errorMsg}</p>
        {#if fallbackUrl}
          <a href={fallbackUrl} aria-label={m.reserve_mailto_link_label()} class="text-sm text-audio underline text-center">{m.reserve_mailto_link()}</a>
        {/if}
      {/if}
    </div>
  </form>
{/if}
