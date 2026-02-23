import type { StylePreset } from '$lib/model/types';

export const cinematicMinimal: StylePreset = {
  id: 'cinematic-minimal',
  name: 'Cinematic Minimal',
  description: 'Thin uppercase text with dark gradients',
  renderer: 'css',
  config: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 'clamp(24px, 3.5vw, 48px)',
    fontWeight: 200,
    fontStyle: 'normal',
    color: '#ffffff',
    letterSpacing: '6px',
    textTransform: 'uppercase',
    textShadow: '0 0 40px rgba(0,0,0,0.8)',
    background: 'radial-gradient(ellipse at center, #0d1a2b 0%, #050d14 50%, #030508 100%)',
    enterAnimation: 'fade-up',
    exitAnimation: 'fade-out',
    maxVisibleLines: 3,
    transitionDuration: 1200
  }
};
