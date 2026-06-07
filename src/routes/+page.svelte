<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  onMount(() => { goto(`${base}/studio`, { replaceState: true }); });
</script>

<p style="padding:2rem;color:#888">Redirecting to the studio…</p>
