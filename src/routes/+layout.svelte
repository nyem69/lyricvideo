<script lang="ts">
  import '../app.css';
  import { Toaster } from 'svelte-sonner';
  import { getLocale } from '$lib/paraglide/runtime';
  let { children } = $props();

  // Reflect the active locale on <html lang> for assistive tech + JS-rendering crawlers.
  // app.html ships lang="en" as the no-JS fallback; setLocale() reloads the page, so the
  // locale is fixed per load and this sets it correctly on mount (effects are client-only).
  $effect(() => {
    document.documentElement.lang = getLocale();
  });
</script>

<Toaster position="top-center" richColors />
{@render children()}
