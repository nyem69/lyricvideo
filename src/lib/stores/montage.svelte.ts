// src/lib/stores/montage.svelte.ts
import { nanoid } from 'nanoid';
import type { Photo, MontageProject, TextStyle } from '$lib/montage/model';
import { DEFAULT_SETTINGS, DEFAULT_TITLE_STYLE, DEFAULT_BAND_STYLE } from '$lib/montage/model';
import { coerceTextStyle } from '$lib/montage/fonts';
import { deriveBands } from '$lib/montage/bands';
import { buildTimeline } from '$lib/montage/timeline';
import { parseLyrics } from '$lib/parser/lyrics';
import { downscaleToBlob } from '$lib/renderer/image-cache';
import { putAsset, getAsset, deleteAsset } from '$lib/storage/asset-store';
import { saveProject, loadProject, localStorageBackend } from '$lib/storage/project-store';
import { playerStore } from './player.svelte';

export const PHOTO_SOFT_CAP = 50;

class MontageStore {
  photos = $state<Photo[]>([]);
  lyricsText = $state('');
  videoTitle = $state('');
  // Non-optional in the live store (always a valid TextStyle); persisted as
  // optional and back-filled from defaults on restore for older projects.
  titleStyle = $state<TextStyle>({ ...DEFAULT_TITLE_STYLE });
  bandStyle = $state<TextStyle>({ ...DEFAULT_BAND_STYLE });
  styleId = $state('warm-memory');
  settings = $state({ ...DEFAULT_SETTINGS });
  audioKey = $state<string | undefined>(undefined);
  songDuration = $state(0);
  ready = $state(false);
  // True while an export is recording. The preview (MontageStage) shares the
  // same <canvas> as the export renderer, so the preview loop must stand down
  // during export or the two would interleave draws and corrupt the capture.
  exporting = $state(false);

  private song = $derived(this.lyricsText ? parseLyrics(this.lyricsText) : null);
  readonly bands = $derived(deriveBands(this.song));
  readonly cuts = $derived.by(() => {
    // [GUARD] clamp duration to a finite value before buildTimeline — playerStore
    // duration can be Infinity/NaN for some audio, which would yield Infinity cuts.
    const raw = this.songDuration || (this.song?.duration ?? 0);
    const dur = Number.isFinite(raw) ? raw : 0;
    return buildTimeline(
      this.photos.map((p) => p.id),
      dur,
      this.bands,
      this.settings
    );
  });
  // Title is fully user-owned (no longer derived from the parsed song header).
  // Blank falls back to 'Montage' so the title card / export filename are never empty.
  readonly title = $derived(this.videoTitle.trim() || 'Montage');
  // The montage's true rendered length = the last cut's end (already accounts
  // for opening/tail/bands). Single source of truth for the export duration so
  // the recording matches the rendered content exactly (no blank tail / cut-off).
  readonly totalDuration = $derived(
    this.cuts.length ? this.cuts[this.cuts.length - 1].end : 0
  );

  /**
   * Add photos one at a time, isolating per-file failures: a corrupt/non-image
   * file (downscaleToBlob throws) is skipped, never aborting the batch. Returns
   * the names of skipped files so the UI can surface them. persist() always runs
   * so successfully-added photos survive a refresh even if a later file fails.
   */
  async addPhotos(files: File[]): Promise<string[]> {
    const skipped: string[] = [];
    try {
      for (const file of files) {
        if (this.photos.length >= PHOTO_SOFT_CAP) break;
        try {
          const { blob, width, height } = await downscaleToBlob(file);
          const id = nanoid();
          const assetKey = `photo:${id}`;
          await putAsset(assetKey, blob);
          this.photos = [...this.photos, { id, name: file.name, width, height, assetKey }];
        } catch {
          skipped.push(file.name);
        }
      }
    } finally {
      this.persist();
    }
    return skipped;
  }

  async removePhoto(id: string) {
    const photo = this.photos.find((p) => p.id === id);
    if (photo) await deleteAsset(photo.assetKey);
    this.photos = this.photos.filter((p) => p.id !== id);
    this.persist();
  }

  reorder(fromIndex: number, toIndex: number) {
    const next = [...this.photos];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    this.photos = next;
    this.persist();
  }

  importLyrics(text: string) {
    this.lyricsText = text;
    const song = parseLyrics(text);
    if (!this.audioKey) {
      this.songDuration = song.duration;
      playerStore.setDuration(song.duration);
    }
    this.persist();
  }

  async loadAudio(file: File) {
    const key = `audio:${nanoid()}`;
    await putAsset(key, file);
    this.audioKey = key;
    playerStore.loadAudio(file);
    this.persist();
    // Mirror the real audio duration event-driven (not a fixed timer that races
    // slow metadata loads). Decode metadata from a throwaway element, then revoke.
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.addEventListener(
      'loadedmetadata',
      () => {
        URL.revokeObjectURL(url);
        // [GUARD] only mirror a real, finite duration (reject Infinity/NaN).
        if (Number.isFinite(probe.duration) && probe.duration > 0) {
          this.songDuration = probe.duration;
          this.persist();
        }
      },
      { once: true }
    );
    probe.addEventListener('error', () => URL.revokeObjectURL(url), { once: true });
    probe.src = url;
  }

  setStyle(id: string) {
    this.styleId = id;
    this.persist();
  }

  setTitle(text: string) {
    this.videoTitle = text;
    this.persist();
  }

  setTitleStyle(patch: Partial<TextStyle>) {
    // coerceTextStyle re-validates the weight against the (possibly new) family
    // so a family change never leaves an unsupported weight behind.
    this.titleStyle = coerceTextStyle({ ...this.titleStyle, ...patch });
    this.persist();
  }

  setBandStyle(patch: Partial<TextStyle>) {
    this.bandStyle = coerceTextStyle({ ...this.bandStyle, ...patch });
    this.persist();
  }

  private persist() {
    const project: MontageProject = {
      version: 1,
      photoOrder: this.photos.map((p) => p.id),
      photos: this.photos,
      audioKey: this.audioKey,
      songDuration: this.songDuration,
      lyricsText: this.lyricsText,
      videoTitle: this.videoTitle,
      titleStyle: this.titleStyle,
      bandStyle: this.bandStyle,
      styleId: this.styleId,
      settings: this.settings,
      updatedAt: Date.now(),
    };
    saveProject(project, localStorageBackend);
  }

  async restore() {
    const project = loadProject(localStorageBackend);
    if (project) {
      // photoOrder is authoritative; re-sort the stored metadata by it
      const byId = new Map(project.photos.map((p) => [p.id, p]));
      this.photos = project.photoOrder.map((id) => byId.get(id)).filter((p): p is Photo => !!p);
      this.lyricsText = project.lyricsText;
      this.videoTitle = project.videoTitle ?? '';
      // Back-fill + coerce so an older project (or a hand-edited blob with a
      // stale family/weight combo) always lands as a valid TextStyle.
      this.titleStyle = coerceTextStyle({ ...DEFAULT_TITLE_STYLE, ...project.titleStyle });
      this.bandStyle = coerceTextStyle({ ...DEFAULT_BAND_STYLE, ...project.bandStyle });
      this.styleId = project.styleId;
      this.settings = project.settings;
      this.audioKey = project.audioKey;
      this.songDuration = project.songDuration ?? 0;

      if (this.lyricsText && !this.audioKey) {
        playerStore.setDuration(this.songDuration);
      }
      if (this.audioKey) {
        const blob = await getAsset(this.audioKey);
        if (blob) playerStore.loadAudio(new File([blob], 'audio'));
      }
    }
    this.ready = true;
  }
}

export const montageStore = new MontageStore();
