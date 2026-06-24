// src/lib/stores/visualizer.svelte.ts
import { nanoid } from 'nanoid';
import type { TextStyle } from '$lib/montage/model';
import { DEFAULT_SETTINGS, DEFAULT_TITLE_STYLE, DEFAULT_BAND_STYLE } from '$lib/montage/model';
import { coerceTextStyle } from '$lib/montage/fonts';
import { deriveBands } from '$lib/montage/bands';
import { parseSunoTimestamps } from '$lib/parser/suno';
import { putAsset, getAsset, deleteAsset } from '$lib/storage/asset-store';
import {
  saveVisualizerProject,
  loadVisualizerProject,
  localStorageBackend,
} from '$lib/storage/project-store';
import {
  computeTotalDuration,
  DEFAULT_VIZ_STYLE,
  DEFAULT_VIZ_ANCHOR,
  DEFAULT_LYRIC_ANCHOR,
  DEFAULT_VIZ_COLOR,
  DEFAULT_VIZ_BG,
  type VisualizerProject,
  type VizStyleId,
  type VAnchor,
} from '$lib/visualizer/model';
import { DEFAULT_FORMAT, resolveFormat } from '$lib/visualizer/formats';
import { playerStore } from './player.svelte';

class VisualizerStore {
  lyricsText = $state('');
  videoTitle = $state('');
  titleStyle = $state<TextStyle>({ ...DEFAULT_TITLE_STYLE });
  bandStyle = $state<TextStyle>({ ...DEFAULT_BAND_STYLE });
  vizStyleId = $state<VizStyleId>(DEFAULT_VIZ_STYLE);
  vizColor = $state<string>(DEFAULT_VIZ_COLOR);
  vizBg = $state<string>(DEFAULT_VIZ_BG);
  vizAnchor = $state<VAnchor>(DEFAULT_VIZ_ANCHOR);
  lyricAnchor = $state<VAnchor>(DEFAULT_LYRIC_ANCHOR);
  formatId = $state<string>(DEFAULT_FORMAT);
  customWidth = $state<number | undefined>(undefined);
  customHeight = $state<number | undefined>(undefined);
  backgroundKey = $state<string | undefined>(undefined);
  audioKey = $state<string | undefined>(undefined);
  songDuration = $state(0);
  settings = $state({ ...DEFAULT_SETTINGS });
  ready = $state(false);
  exporting = $state(false);

  private song = $derived(this.lyricsText ? parseSunoTimestamps(this.lyricsText) : null);
  readonly bands = $derived(deriveBands(this.song));
  readonly title = $derived(this.videoTitle.trim() || 'Visualizer');
  readonly dims = $derived(
    resolveFormat({
      formatId: this.formatId,
      customWidth: this.customWidth,
      customHeight: this.customHeight,
    })
  );
  readonly totalDuration = $derived(
    computeTotalDuration(this.songDuration || (this.song?.duration ?? 0), this.bands, this.settings)
  );

  importLyrics(text: string) {
    this.lyricsText = text;
    const song = parseSunoTimestamps(text);
    if (!this.audioKey) {
      this.songDuration = song.duration;
      playerStore.setDuration(song.duration);
    }
    this.persist();
  }

  async loadAudio(file: File) {
    // Drop the previous song's blob first so swapping songs doesn't orphan it
    // in IndexedDB (mirrors setBackground's cleanup).
    if (this.audioKey) await deleteAsset(this.audioKey);
    const key = `audio:${nanoid()}`;
    await putAsset(key, file);
    this.audioKey = key;
    playerStore.loadAudio(file);
    this.persist();
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.addEventListener(
      'loadedmetadata',
      () => {
        URL.revokeObjectURL(url);
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

  async setBackground(file: File) {
    if (this.backgroundKey) await deleteAsset(this.backgroundKey);
    const key = `vizbg:${nanoid()}`;
    await putAsset(key, file);
    this.backgroundKey = key;
    this.persist();
  }

  async removeBackground() {
    if (this.backgroundKey) await deleteAsset(this.backgroundKey);
    this.backgroundKey = undefined;
    this.persist();
  }

  setVizStyle(id: VizStyleId) {
    this.vizStyleId = id;
    this.persist();
  }

  setVizColor(color: string) {
    this.vizColor = color;
    this.persist();
  }

  setVizBg(color: string) {
    this.vizBg = color;
    this.persist();
  }

  setVizAnchor(a: VAnchor) {
    this.vizAnchor = a;
    this.persist();
  }

  setLyricAnchor(a: VAnchor) {
    this.lyricAnchor = a;
    this.persist();
  }

  setFormat(id: string) {
    this.formatId = id;
    this.persist();
  }

  setCustomDims(width: number, height: number) {
    this.customWidth = width;
    this.customHeight = height;
    this.persist();
  }

  setTitle(text: string) {
    this.videoTitle = text;
    this.persist();
  }

  setTitleStyle(patch: Partial<TextStyle>) {
    this.titleStyle = coerceTextStyle({ ...this.titleStyle, ...patch });
    this.persist();
  }

  setBandStyle(patch: Partial<TextStyle>) {
    this.bandStyle = coerceTextStyle({ ...this.bandStyle, ...patch });
    this.persist();
  }

  private persist() {
    const project: VisualizerProject = {
      version: 1,
      lyricsText: this.lyricsText,
      videoTitle: this.videoTitle,
      titleStyle: this.titleStyle,
      bandStyle: this.bandStyle,
      vizStyleId: this.vizStyleId,
      vizColor: this.vizColor,
      vizBg: this.vizBg,
      vizAnchor: this.vizAnchor,
      lyricAnchor: this.lyricAnchor,
      formatId: this.formatId,
      customWidth: this.customWidth,
      customHeight: this.customHeight,
      backgroundKey: this.backgroundKey,
      audioKey: this.audioKey,
      songDuration: this.songDuration,
      settings: this.settings,
      updatedAt: Date.now(),
    };
    saveVisualizerProject(project, localStorageBackend);
  }

  async restore() {
    const project = loadVisualizerProject(localStorageBackend);
    if (project) {
      this.lyricsText = project.lyricsText;
      this.videoTitle = project.videoTitle ?? '';
      this.titleStyle = coerceTextStyle({ ...DEFAULT_TITLE_STYLE, ...project.titleStyle });
      this.bandStyle = coerceTextStyle({ ...DEFAULT_BAND_STYLE, ...project.bandStyle });
      this.vizStyleId = project.vizStyleId;
      this.vizColor = project.vizColor ?? DEFAULT_VIZ_COLOR;
      this.vizBg = project.vizBg ?? DEFAULT_VIZ_BG;
      this.vizAnchor = project.vizAnchor ?? DEFAULT_VIZ_ANCHOR;
      this.lyricAnchor = project.lyricAnchor ?? DEFAULT_LYRIC_ANCHOR;
      this.formatId = project.formatId;
      this.customWidth = project.customWidth;
      this.customHeight = project.customHeight;
      this.backgroundKey = project.backgroundKey;
      this.audioKey = project.audioKey;
      // Guard a corrupted/non-finite persisted duration (probe only filters live loads).
      this.songDuration = Number.isFinite(project.songDuration) ? project.songDuration : 0;
      this.settings = project.settings;

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

export const visualizerStore = new VisualizerStore();
