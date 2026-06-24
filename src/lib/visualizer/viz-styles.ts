// src/lib/visualizer/viz-styles.ts
//
// Production visualizer styles — draw-only.
// Each style draws ONLY its visualizer graphics onto the provided canvas context.
// It does NOT clear the background and does NOT draw any title text.
// Those responsibilities belong to the renderer's own layers.

import type { VizStyleId } from './model';

export interface VizFrame {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  freq: Uint8Array; // 0..255 per bin
  wave: Uint8Array; // 0..255, silence = 128
  t: number; // seconds since start (rotations / drift)
  accent: string; // active accent color as `#rrggbb` — every style draws in this
}

export interface VizStyle {
  id: VizStyleId;
  name: string;
  desc: string;
  /** Where the style's graphics naturally sit vertically. 'bottom' styles rise
   *  from the canvas floor and can be raised but never pushed below it; 'center'
   *  styles are symmetric about the midline and follow any placement preset. */
  anchor: 'center' | 'bottom';
  draw: (f: VizFrame) => void;
}

// Neutral highlights/surface that read well over ANY accent — kept color-fixed
// on purpose: the cream specular caps and the dark centre wells are not tinted.
const CREAM = '#fdf6e3';
const WELL = '10,26,10'; // surface green, used as an rgb triple in gradient stops

// ---- shared helpers ---------------------------------------------------------

/** `#rgb`/`#rrggbb` -> `rgba(r,g,b,a)`. Lets every style derive translucent
 *  fills/strokes/glows from the single chosen accent hex. */
export function rgba(hex: string, a = 1): string {
  let h = hex.replace('#', '').trim();
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const n = Number.parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Average `freq` down to `bins` buckets, emphasising the audible low/mid range
 *  (the top of the FFT is mostly empty for music). Returns 0..1 values. */
function buckets(freq: Uint8Array, bins: number): number[] {
  const usable = Math.floor(freq.length * 0.7); // drop the dead high end
  const out: number[] = [];
  for (let b = 0; b < bins; b++) {
    // logarithmic-ish band edges so bass doesn't dominate the bar count
    const lo = Math.floor(Math.pow(b / bins, 1.4) * usable);
    const hi = Math.max(lo + 1, Math.floor(Math.pow((b + 1) / bins, 1.4) * usable));
    let sum = 0;
    for (let i = lo; i < hi; i++) sum += freq[i];
    out.push(sum / (hi - lo) / 255);
  }
  return out;
}

function bass(freq: Uint8Array): number {
  const n = Math.max(1, Math.floor(freq.length * 0.06));
  let s = 0;
  for (let i = 0; i < n; i++) s += freq[i];
  return s / n / 255; // 0..1
}

// ---- styles -----------------------------------------------------------------

const bars: VizStyle = {
  id: 'bars',
  name: 'Spectrum Bars',
  desc: 'Classic bottom-anchored frequency bars with a gold gradient. The safe, universally-readable default.',
  anchor: 'bottom',
  draw: (f) => {
    const { ctx, w, h, accent } = f;
    const N = 64;
    const vals = buckets(f.freq, N);
    const gap = w * 0.004;
    const bw = (w - gap * (N + 1)) / N;
    for (let i = 0; i < N; i++) {
      const v = vals[i];
      const bh = Math.max(2, v * h * 0.8);
      const x = gap + i * (bw + gap);
      const y = h - bh;
      const grad = ctx.createLinearGradient(0, h, 0, y);
      grad.addColorStop(0, rgba(accent, 0.35));
      grad.addColorStop(1, accent);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, bw, bh);
      // reflection glow cap
      ctx.fillStyle = rgba(CREAM, 0.85);
      ctx.fillRect(x, y, bw, Math.max(1, h * 0.004));
    }
  },
};

const mirror: VizStyle = {
  id: 'mirror',
  name: 'Mirror Bars',
  desc: 'Bars grow symmetrically from a centre line. Feels balanced and "designed"; title sits cleanly above or below.',
  anchor: 'center',
  draw: (f) => {
    const { ctx, w, h, accent } = f;
    const N = 72;
    const vals = buckets(f.freq, N);
    const mid = h / 2;
    const gap = w * 0.003;
    const bw = (w - gap * (N + 1)) / N;
    for (let i = 0; i < N; i++) {
      const v = vals[i];
      const half = Math.max(1, v * h * 0.42);
      const x = gap + i * (bw + gap);
      const grad = ctx.createLinearGradient(0, mid - half, 0, mid + half);
      grad.addColorStop(0, accent);
      grad.addColorStop(0.5, rgba(accent, 0.25));
      grad.addColorStop(1, accent);
      ctx.fillStyle = grad;
      ctx.fillRect(x, mid - half, bw, half * 2);
    }
    ctx.fillStyle = rgba(accent, 0.15);
    ctx.fillRect(0, mid - 1, w, 2);
  },
};

const radial: VizStyle = {
  id: 'radial',
  name: 'Radial Spectrum',
  desc: 'Bars radiate from a centre disc that slowly rotates and pulses with the bass. Title (or album art) lives in the middle. The most "music-app" look.',
  anchor: 'center',
  draw: (f) => {
    const { ctx, w, h, t, accent } = f;
    const cx = w / 2;
    const cy = h / 2;
    const b = bass(f.freq);
    const r0 = Math.min(w, h) * (0.16 + b * 0.04);
    const N = 96;
    const vals = buckets(f.freq, N);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.05);
    // Constant per frame (depends only on r0 and N) — hoisted out of the loop.
    ctx.lineWidth = Math.max(1, (Math.PI * 2 * r0) / N - 2);
    ctx.lineCap = 'round';
    for (let i = 0; i < N; i++) {
      const v = vals[i];
      const ang = (i / N) * Math.PI * 2;
      const len = v * Math.min(w, h) * 0.26;
      const x1 = Math.cos(ang) * r0;
      const y1 = Math.sin(ang) * r0;
      const x2 = Math.cos(ang) * (r0 + len);
      const y2 = Math.sin(ang) * (r0 + len);
      ctx.strokeStyle = rgba(accent, 0.4 + v * 0.6);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    // centre disc
    const glow = ctx.createRadialGradient(0, 0, r0 * 0.2, 0, 0, r0);
    glow.addColorStop(0, rgba(accent, 0.25));
    glow.addColorStop(1, `rgba(${WELL},0.9)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(accent, 0.5);
    ctx.lineWidth = Math.max(1, h * 0.002);
    ctx.stroke();
    ctx.restore();
  },
};

const wave: VizStyle = {
  id: 'wave',
  name: 'Waveform',
  desc: 'A single glowing oscilloscope line traces the raw audio waveform. Minimal, elegant, very legible behind lyrics.',
  anchor: 'center',
  draw: (f) => {
    const { ctx, w, h, accent } = f;
    const mid = h / 2;
    const amp = h * 0.34;
    const step = w / f.wave.length;
    ctx.save();
    ctx.lineWidth = Math.max(2, h * 0.005);
    ctx.strokeStyle = accent;
    ctx.shadowColor = rgba(accent, 0.8);
    ctx.shadowBlur = h * 0.03;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < f.wave.length; i++) {
      const y = mid + ((f.wave[i] - 128) / 128) * amp;
      const x = i * step;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // faint second pass for thickness
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = Math.max(1, h * 0.012);
    ctx.stroke();
    ctx.restore();
  },
};

const area: VizStyle = {
  id: 'area',
  name: 'Filled Spectrum',
  desc: 'A smooth filled curve over the spectrum with a soft gradient — a calmer, more cinematic take on bars.',
  anchor: 'bottom',
  draw: (f) => {
    const { ctx, w, h, accent } = f;
    const N = 96;
    const vals = buckets(f.freq, N);
    const pts = vals.map((v, i) => ({
      x: (i / (N - 1)) * w,
      y: h - Math.max(2, v * h * 0.82),
    }));
    const grad = ctx.createLinearGradient(0, h * 0.2, 0, h);
    grad.addColorStop(0, rgba(accent, 0.85));
    grad.addColorStop(1, rgba(accent, 0.05));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const xc = (pts[i].x + pts[i - 1].x) / 2;
      const yc = (pts[i].y + pts[i - 1].y) / 2;
      ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, xc, yc);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    // crest line
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = Math.max(1, h * 0.003);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const xc = (pts[i].x + pts[i - 1].x) / 2;
      const yc = (pts[i].y + pts[i - 1].y) / 2;
      ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, xc, yc);
    }
    ctx.stroke();
  },
};

const orb: VizStyle = {
  id: 'orb',
  name: 'Pulsing Orb',
  desc: 'A bass-reactive glowing orb wrapped in a ring of dots that flare with the mids. Abstract and hypnotic; great for ambient tracks.',
  anchor: 'center',
  draw: (f) => {
    const { ctx, w, h, t, accent } = f;
    const cx = w / 2;
    const cy = h / 2;
    const b = bass(f.freq);
    const R = Math.min(w, h) * (0.12 + b * 0.12);
    // outer glow — additive translucent radial fill over the whole canvas;
    // does NOT clear the background (outer stop is fully transparent), so the
    // renderer's background layer underneath is preserved. Not a bg clear.
    const glow = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 2.4);
    glow.addColorStop(0, rgba(accent, 0.4 + b * 0.4));
    glow.addColorStop(1, `rgba(${WELL},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    // core
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = rgba(CREAM, 0.9);
    ctx.fill();
    // ring of mid-reactive dots
    const N = 80;
    const vals = buckets(f.freq, N);
    const ringR = R * 1.8;
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2 + t * 0.2;
      const v = vals[i];
      const rr = ringR + v * Math.min(w, h) * 0.12;
      const x = cx + Math.cos(ang) * rr;
      const y = cy + Math.sin(ang) * rr;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, v * h * 0.012 + h * 0.002), 0, Math.PI * 2);
      ctx.fillStyle = rgba(accent, 0.3 + v * 0.7);
      ctx.fill();
    }
  },
};

export const VIZ_STYLES: VizStyle[] = [bars, mirror, radial, wave, area, orb];
export const VIZ_STYLE_MAP: Record<string, VizStyle> = Object.fromEntries(
  VIZ_STYLES.map((s) => [s.id, s])
);
