export interface Word {
  text: string;
  startTime: number;
}

export interface Line {
  id: string;
  text: string;
  startTime: number;
  words: Word[];
}

export type SectionType = 'intro' | 'verse' | 'chorus' | 'bridge' | 'interlude' | 'outro' | 'finale';

export interface Section {
  id: string;
  type: SectionType;
  label?: string;
  startTime: number;
  endTime: number;
  lines: Line[];
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  duration: number;
  sections: Section[];
}

export type PresetId = 'clean-subtitle' | 'cinematic-minimal' | 'bold-impact' | 'elegant-ceremony';

export type AnimationEnter = 'fade-up' | 'fade-in' | 'slide-left' | 'scale-in' | 'slam';
export type AnimationExit = 'fade-out' | 'fade-up-out' | 'dissolve';

export interface CssPresetConfig {
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  color: string;
  letterSpacing: string;
  textTransform: 'none' | 'uppercase';
  textShadow: string;
  background: string;
  enterAnimation: AnimationEnter;
  exitAnimation: AnimationExit;
  maxVisibleLines: number;
  transitionDuration: number;
}

export interface StylePreset {
  id: PresetId;
  name: string;
  description: string;
  renderer: 'css';
  config: CssPresetConfig;
}

export interface StyleMap {
  global: PresetId;
  sections: Record<string, PresetId>;
}
