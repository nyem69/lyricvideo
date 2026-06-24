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

const ringwave: VizStyle = {
  id: 'ringwave',
  name: 'Ring Waveform',
  desc: 'The raw oscilloscope wrapped into a slowly rotating ring. Minimal and very legible behind dense lyrics.',
  anchor: 'center',
  draw: (f) => {
    const { ctx, w, h, t, accent } = f;
    const cx = w / 2;
    const cy = h / 2;
    const b = bass(f.freq);
    const baseR = Math.min(w, h) * (0.22 + b * 0.03);
    const amp = Math.min(w, h) * 0.1;
    const N = f.wave.length;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.08);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = accent;
    ctx.shadowColor = rgba(accent, 0.7);
    ctx.shadowBlur = Math.min(w, h) * 0.02;
    ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.005);
    ctx.beginPath();
    // i<=N with idx=i%N wraps the last point back to the first, closing the ring
    // smoothly with no seam.
    for (let i = 0; i <= N; i++) {
      const ang = (i / N) * Math.PI * 2;
      const r = baseR + ((f.wave[i % N] - 128) / 128) * amp;
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // faint thicker echo for body
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.012);
    ctx.stroke();
    ctx.restore();
  },
};

const blob: VizStyle = {
  id: 'blob',
  name: 'Spectrum Blob',
  desc: 'The spectrum wrapped into a smooth closed shape, filled with the accent and pumping on the bass. The most organic, music-app look.',
  anchor: 'center',
  draw: (f) => {
    const { ctx, w, h, t, accent } = f;
    const cx = w / 2;
    const cy = h / 2;
    const b = bass(f.freq);
    // Mirror the buckets into a palindrome so the closed curve meets itself with
    // no seam (the last sample equals the first going the other way round).
    const half = buckets(f.freq, 48);
    const vals = half.concat([...half].reverse());
    const N = vals.length;
    const baseR = Math.min(w, h) * (0.16 + b * 0.06);
    const span = Math.min(w, h) * 0.16;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2 + t * 0.1;
      const r = baseR + vals[i] * span;
      pts.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
    }
    const grad = ctx.createRadialGradient(cx, cy, baseR * 0.3, cx, cy, baseR + span);
    grad.addColorStop(0, rgba(accent, 0.55));
    grad.addColorStop(1, rgba(accent, 0.12));
    ctx.fillStyle = grad;
    // Smooth closed curve: a quadratic through each point's midpoint with the
    // point itself as the control handle (a cheap Catmull-Rom-ish loop).
    ctx.beginPath();
    ctx.moveTo((pts[N - 1].x + pts[0].x) / 2, (pts[N - 1].y + pts[0].y) / 2);
    for (let i = 0; i < N; i++) {
      const cur = pts[i];
      const next = pts[(i + 1) % N];
      ctx.quadraticCurveTo(cur.x, cur.y, (cur.x + next.x) / 2, (cur.y + next.y) / 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.004);
    ctx.shadowColor = rgba(accent, 0.6);
    ctx.shadowBlur = Math.min(w, h) * 0.015;
    ctx.stroke();
  },
};

const matrix: VizStyle = {
  id: 'matrix',
  name: 'LED Matrix',
  desc: 'A grid of cells lit by the spectrum, like a hardware equalizer with peak-hold caps. Punchy and retro; bottom-anchored.',
  anchor: 'bottom',
  draw: (f) => {
    const { ctx, w, h, accent } = f;
    const COLS = 32;
    const ROWS = 16;
    const vals = buckets(f.freq, COLS);
    const gap = Math.min(w, h) * 0.004;
    const cellW = (w - gap * (COLS + 1)) / COLS;
    const rowPitch = (h * 0.82) / ROWS;
    const cellH = rowPitch - gap;
    for (let c = 0; c < COLS; c++) {
      const x = gap + c * (cellW + gap);
      const lit = Math.round(vals[c] * ROWS);
      for (let r = 0; r < ROWS; r++) {
        const y = h - (r + 1) * rowPitch; // r=0 is the bottom row
        if (r < lit) {
          ctx.fillStyle = rgba(accent, 0.45 + (r / ROWS) * 0.55); // brighter up the stack
        } else {
          ctx.fillStyle = rgba(accent, 0.06); // unlit cell ghost
        }
        ctx.fillRect(x, y, cellW, cellH);
      }
      // peak-hold cap
      if (lit > 0) {
        const y = h - lit * rowPitch;
        ctx.fillStyle = rgba(CREAM, 0.9);
        ctx.fillRect(x, y, cellW, Math.max(1, cellH * 0.5));
      }
    }
  },
};

const glitch: VizStyle = {
  id: 'glitch',
  name: 'Glitch',
  desc: 'Spectrum torn into displaced horizontal bands with a chromatic split. Gritty and kinetic — built for raw street / grunge looks.',
  anchor: 'center',
  draw: (f) => {
    const { ctx, w, h, t, accent } = f;
    const BANDS = 24;
    const vals = buckets(f.freq, BANDS);
    const b = bass(f.freq);
    const midY = h / 2;
    const fieldH = h * 0.6;
    const bandH = fieldH / BANDS;
    // Deterministic hash in [0,1) from (band, time) — pure, so an export of the
    // same frame is identical (no Math.random, which would break frame replay).
    const hash = (i: number) => {
      const s = Math.sin(i * 12.9898 + t * 6) * 43758.5453;
      return s - Math.floor(s);
    };
    for (let i = 0; i < BANDS; i++) {
      const v = vals[i];
      const y = midY - fieldH / 2 + i * bandH;
      const len = (0.12 + v * 0.85) * w;
      const tear = hash(i);
      const dx = (tear - 0.5) * w * (0.04 + b * 0.12) * (tear > 0.7 ? 3 : 1);
      const x = (w - len) / 2 + dx;
      const hh = Math.max(1, bandH * 0.7);
      const split = (2 + b * 10) * (Math.min(w, h) / 1000 + 0.6);
      // chromatic ghosts on either side, then the solid accent band on top
      ctx.fillStyle = rgba(accent, 0.25);
      ctx.fillRect(x - split, y, len, hh);
      ctx.fillStyle = rgba(CREAM, 0.18);
      ctx.fillRect(x + split, y, len, hh);
      ctx.fillStyle = rgba(accent, 0.85);
      ctx.fillRect(x, y, len, hh);
    }
    // occasional full-width scan-tear line
    const scan = hash(99);
    if (scan > 0.85) {
      const y = midY - fieldH / 2 + scan * fieldH;
      ctx.fillStyle = rgba(CREAM, 0.5);
      ctx.fillRect(0, y, w, Math.max(1, h * 0.004));
    }
  },
};

export const VIZ_STYLES: VizStyle[] = [
  bars,
  mirror,
  radial,
  wave,
  area,
  orb,
  ringwave,
  blob,
  matrix,
  glitch,
];
export const VIZ_STYLE_MAP: Record<string, VizStyle> = Object.fromEntries(
  VIZ_STYLES.map((s) => [s.id, s])
);
