<!-- src/lib/components/Montage/PhotoTray.svelte -->
<script lang="ts">
  import { montageStore, PHOTO_SOFT_CAP } from '$lib/stores/montage.svelte';
  import { toast } from 'svelte-sonner';
  import { X } from '@lucide/svelte';

  let fileInput: HTMLInputElement;

  async function onFiles(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    if (montageStore.photos.length + files.length > PHOTO_SOFT_CAP) {
      toast.warning(`Soft limit is ${PHOTO_SOFT_CAP} photos; extra files past the cap are skipped.`);
    }
    const before = montageStore.photos.length;
    const skipped = await montageStore.addPhotos(files);
    if (skipped.length) {
      toast.error(`Skipped ${skipped.length} unsupported file(s): ${skipped.join(', ')}`);
    }
    const added = montageStore.photos.length - before;
    if (added > 0) toast.success(`${added} photo${added !== 1 ? 's' : ''} added`);
    input.value = '';
  }
</script>

<div class="flex flex-col gap-3">
  <span class="text-sm tracking-wider text-gold/60 uppercase" style="font-family:'Raleway',sans-serif">
    Photos ({montageStore.photos.length}/{PHOTO_SOFT_CAP})
  </span>
  <input bind:this={fileInput} type="file" accept="image/*" multiple class="hidden" onchange={onFiles} />
  <button
    onclick={() => fileInput.click()}
    class="bg-gold/15 border border-gold/30 text-gold px-4 py-2 text-sm tracking-widest uppercase rounded cursor-pointer hover:bg-gold/30 hover:border-gold transition-all"
    style="font-family:'Raleway',sans-serif"
  >
    Add Photos
  </button>

  <div class="grid grid-cols-4 gap-2">
    {#each montageStore.photos as photo, i (photo.id)}
      <div class="relative aspect-square bg-white/5 border border-gold/10 rounded overflow-hidden text-[10px] text-white/40 flex items-center justify-center">
        <span class="px-1 text-center break-all">{i + 1}. {photo.name}</span>
        <button
          onclick={() => montageStore.removePhoto(photo.id)}
          class="absolute top-0 right-0 bg-black/60 text-white/70 hover:text-white p-0.5"
          aria-label="Remove photo"
        >
          <X size={12} />
        </button>
      </div>
    {/each}
  </div>
</div>
