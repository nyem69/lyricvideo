import type { StylePreset } from '$lib/model/types';

export const boldImpact: StylePreset = {
  id: 'bold-impact',
  name: 'Bold Impact',
  description: 'Massive text that slams onto screen',
  renderer: 'css',
  config: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 'clamp(36px, 7vw, 96px)',
    fontWeight: 400,
    fontStyle: 'normal',
    color: '#ffffff',
    letterSpacing: '4px',
    textTransform: 'uppercase',
    textShadow: '0 0 20px rgba(255,255,255,0.3)',
    background: '#000000',
    enterAnimation: 'slam',
    exitAnimation: 'fade-out',
    maxVisibleLines: 2,
    transitionDuration: 300
  }
};
