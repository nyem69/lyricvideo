import type { StylePreset } from '$lib/model/types';

export const cleanSubtitle: StylePreset = {
  id: 'clean-subtitle',
  name: 'Clean Subtitle',
  description: 'Minimal white text on dark background',
  renderer: 'css',
  config: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: 'clamp(20px, 3vw, 36px)',
    fontWeight: 400,
    fontStyle: 'normal',
    color: '#ffffff',
    letterSpacing: '0.5px',
    textTransform: 'none',
    textShadow: '0 2px 8px rgba(0,0,0,0.8)',
    background: 'linear-gradient(to bottom, #0a0a0a 0%, #1a1a1a 100%)',
    enterAnimation: 'fade-in',
    exitAnimation: 'fade-out',
    maxVisibleLines: 2,
    transitionDuration: 300
  }
};
