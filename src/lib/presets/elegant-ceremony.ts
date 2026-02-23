import type { StylePreset } from '$lib/model/types';

export const elegantCeremony: StylePreset = {
  id: 'elegant-ceremony',
  name: 'Elegant Ceremony',
  description: 'Gold serif text with ornate dark backgrounds',
  renderer: 'css',
  config: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 'clamp(28px, 4vw, 56px)',
    fontWeight: 700,
    fontStyle: 'normal',
    color: '#d4af37',
    letterSpacing: '2px',
    textTransform: 'none',
    textShadow: '0 0 40px rgba(0,0,0,0.8), 0 0 80px rgba(0,0,0,0.5)',
    background: 'radial-gradient(ellipse at center, #0d2b0d 0%, #071407 50%, #030a03 100%)',
    enterAnimation: 'fade-up',
    exitAnimation: 'fade-up-out',
    maxVisibleLines: 3,
    transitionDuration: 1200
  }
};
