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

/** Deterministic pseudo-random value in [0,1) from two integer-ish seeds. Pure —
 *  the particle styles below use it for fixed per-index spawn params (angle,
 *  phase, speed) so a given frame replays byte-identically. NEVER Math.random,
 *  which would desync export/seeking. Same `Math.sin`-hash the glitch style uses. */
function hash01(i: number, salt: number): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
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

const smoke: VizStyle = {
  id: 'smoke',
  name: 'Smoke',
  desc: 'A rising column of soft, glowing smoke puffs that bloom and drift on the bass — a deterministic take on the classic particle plume. Moody and atmospheric; built for street / grunge looks.',
  anchor: 'bottom',
  draw: (f) => {
    const { ctx, w, h, t, accent } = f;
    const b = bass(f.freq);
    // Coarse spectral modulation so individual puffs flare on different bands.
    const vals = buckets(f.freq, 8);
    const N = 84; // fixed particle pool — no per-frame allocation/state
    const life = 3.4; // seconds a puff lives before recycling
    const emitX = w / 2;
    const emitY = h * 0.94; // bottom-floor emitter (style is bottom-anchored)
    const rise = h * 1.05; // travel over a full life at unit rise speed
    // Deterministic per-particle hash in [0,1) from (index, salt) — pure, so an
    // export of a given frame is byte-identical (no Math.random, which would
    // break frame replay / seeking). Same trick the glitch style uses.
    const hash = (i: number, salt: number) => {
      const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    ctx.save();
    // Additive blend so overlapping puffs bloom into brighter haze over the dark
    // surface (state is pushed/popped, so it never leaks to later layers).
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < N; i++) {
      // Stagger each particle's birth across the life cycle so the plume reads as
      // a continuous stream rather than synchronized pulses.
      const phase = hash(i, 1);
      const age = (t / life + phase) % 1; // 0 (just born) .. 1 (about to die)
      // Horizontal: a seeded sideways drift (widening with age) plus a slow,
      // bass-driven sway. Quadratic sway term => puffs curl as they rise.
      const drift = (hash(i, 2) - 0.5) * w * 0.22;
      const sway = Math.sin(t * 0.5 + i * 1.7) * w * (0.025 + b * 0.06);
      const x = emitX + drift * age + sway * age * age;
      // Vertical: rises faster on bass; eased so it slows and thins near the top.
      const y = emitY - age * rise * (0.7 + b * 0.5);
      // Size blooms as the puff ages and cools; seeded base radius for variety.
      const r = Math.min(w, h) * (0.04 + hash(i, 3) * 0.05) * (0.5 + age * 2.4);
      // Alpha: quick fade-in, long fade-out toward death, lifted by bass and by
      // this puff's assigned spectral band so the column breathes with the mix.
      const band = vals[i % vals.length];
      const a = Math.min(1, age * 6) * (1 - age) * (0.16 + b * 0.5 + band * 0.3);
      if (a <= 0.01) continue; // skip invisible puffs (born/dead tails)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(accent, a));
      g.addColorStop(0.5, rgba(accent, a * 0.35));
      g.addColorStop(1, rgba(accent, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
};

const rain: VizStyle = {
  id: 'rain',
  name: 'Rain',
  desc: 'Translucent streaks falling on a diagonal wind, thickening and speeding up with the bass. Moody and kinetic — built for street / grunge looks.',
  anchor: 'center',
  draw: (f) => {
    const { ctx, w, h, t, accent } = f;
    const b = bass(f.freq);
    const N = 130;
    const speed = 0.5 + b * 0.7; // fall cycles/sec, lifts on bass
    const wind = w * (0.06 + b * 0.05); // horizontal travel over a full fall
    const len = h * (0.06 + b * 0.05); // streak length
    const dxLen = (wind * len) / (h + len * 2); // horizontal run over one streak
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.0025);
    for (let i = 0; i < N; i++) {
      const phase = hash01(i, 1);
      const sp = 0.6 + hash01(i, 4) * 0.8; // per-drop speed variance
      const fall = (t * speed * sp + phase) % 1; // 0 (top) .. 1 (bottom)
      const baseX = hash01(i, 2) * (w + wind) - wind; // start left of frame so wind fills it
      const hx = baseX + wind * fall; // head drifts right as it descends
      const hy = -len + fall * (h + len * 2);
      const a = 0.15 + hash01(i, 3) * 0.25 + b * 0.2;
      const grad = ctx.createLinearGradient(hx - dxLen, hy - len, hx, hy);
      grad.addColorStop(0, rgba(accent, 0)); // faded tail (up-wind)
      grad.addColorStop(1, rgba(accent, a)); // bright head
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(hx - dxLen, hy - len);
      ctx.lineTo(hx, hy);
      ctx.stroke();
    }
    ctx.restore();
  },
};

const snow: VizStyle = {
  id: 'snow',
  name: 'Snow',
  desc: 'Soft flakes drifting down with a gentle sway, flurrying and swelling on the bass. Calm and atmospheric.',
  anchor: 'center',
  draw: (f) => {
    const { ctx, w, h, t, accent } = f;
    const b = bass(f.freq);
    const N = 120;
    const speed = 0.06 + b * 0.06; // slow descent
    for (let i = 0; i < N; i++) {
      const phase = hash01(i, 1);
      const sp = 0.5 + hash01(i, 4); // per-flake speed
      const fall = (t * speed * sp + phase) % 1;
      const baseX = hash01(i, 2) * w;
      const swayAmp = w * (0.01 + hash01(i, 5) * 0.03);
      const x = baseX + Math.sin(t * (0.5 + sp) + i * 1.3) * swayAmp;
      const y = -10 + fall * (h + 20);
      const r = Math.min(w, h) * (0.004 + hash01(i, 3) * 0.008) * (1 + b * 0.5);
      const a = 0.3 + hash01(i, 6) * 0.5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(accent, a));
      g.addColorStop(0.6, rgba(accent, a * 0.4));
      g.addColorStop(1, rgba(accent, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

const starfield: VizStyle = {
  id: 'starfield',
  name: 'Starfield',
  desc: 'Stars streaming out of the centre in a hyperspace warp, accelerating and trailing on the bass. Dynamic and immersive.',
  anchor: 'center',
  draw: (f) => {
    const { ctx, w, h, t, accent } = f;
    const b = bass(f.freq);
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.hypot(w, h) / 2;
    const N = 150;
    const speed = 0.1 + b * 0.18; // warp speed lifts on bass
    const trail = 0.03 + b * 0.1; // streak length (in depth) lifts on bass
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < N; i++) {
      const ang = hash01(i, 1) * Math.PI * 2;
      const phase = hash01(i, 2);
      const sp = 0.6 + hash01(i, 4) * 0.8;
      const z = (t * speed * sp + phase) % 1; // 0 (centre) .. 1 (edge)
      const zt = Math.max(0, z - trail);
      const rHead = z * z * maxR; // accelerate outward
      const rTail = zt * zt * maxR;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const hx = cx + cos * rHead;
      const hy = cy + sin * rHead;
      const tx = cx + cos * rTail;
      const ty = cy + sin * rTail;
      const a = Math.min(1, z * 1.6);
      const lw = Math.max(1, Math.min(w, h) * 0.001 * (0.5 + z * 3));
      const grad = ctx.createLinearGradient(tx, ty, hx, hy);
      grad.addColorStop(0, rgba(accent, 0));
      grad.addColorStop(1, rgba(accent, a));
      ctx.strokeStyle = grad;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      // bright specular head
      ctx.fillStyle = rgba(CREAM, a * 0.85);
      ctx.beginPath();
      ctx.arc(hx, hy, lw * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
};

const fog: VizStyle = {
  id: 'fog',
  name: 'Fog',
  desc: 'Slow banks of haze drifting across the frame, swelling and brightening with the bass. Ambient and cinematic.',
  anchor: 'center',
  draw: (f) => {
    const { ctx, w, h, t, accent } = f;
    const b = bass(f.freq);
    const N = 22; // soft puffs that overlap into drifting banks
    ctx.save();
    // Additive so overlapping puffs build into brighter haze (state is restored).
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < N; i++) {
      const phase = hash01(i, 1);
      const sp = 0.4 + hash01(i, 4) * 0.6;
      const dir = hash01(i, 5) > 0.5 ? 1 : -1; // some banks drift left, some right
      const off = (t * 0.02 * sp + phase) % 1; // 0..1, slow horizontal crawl
      const x = dir > 0 ? -0.3 * w + off * 1.6 * w : 1.3 * w - off * 1.6 * w;
      const y = h * (0.12 + hash01(i, 2) * 0.76) + Math.sin(t * 0.3 + i) * h * 0.03;
      const r = Math.min(w, h) * (0.18 + hash01(i, 3) * 0.22) * (1 + b * 0.3);
      const a = 0.05 + hash01(i, 6) * 0.06 + b * 0.05;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(accent, a));
      g.addColorStop(1, rgba(accent, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
};

const flower: VizStyle = {
  id: 'flower',
  name: 'Flower',
  desc: 'A layered bloom of petals that opens on the bass, each petal flaring to its own frequency band while the rings slowly counter-rotate around a pulsing pistil. A procedural, audio-reactive take on the FlowerJS look.',
  anchor: 'center',
  draw: (f) => {
    const { ctx, w, h, t, accent } = f;
    const cx = w / 2;
    const cy = h / 2;
    const b = bass(f.freq);
    const PETALS = 12;
    const PILES = 3; // concentric rings, outer -> inner
    const vals = buckets(f.freq, PETALS);
    const unit = Math.min(w, h);
    const baseR = unit * 0.05; // inner radius the petals spring from

    // Soft bloom glow behind the flower. Outer stop is fully transparent, so this
    // is an additive wash over the existing background, NOT a background clear.
    const bloom = ctx.createRadialGradient(cx, cy, baseR, cx, cy, unit * 0.34 * (1 + b * 0.2));
    bloom.addColorStop(0, rgba(accent, 0.18 + b * 0.15));
    bloom.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, w, h);

    // Rings: layer 0 = outermost & largest (drawn first / behind), inner rings
    // are smaller, brighter and drawn on top. Alternate rings counter-rotate.
    for (let layer = 0; layer < PILES; layer++) {
      const scale = 1 - layer * 0.26;
      const layerAlpha = 0.45 + (layer / PILES) * 0.45;
      const dir = layer % 2 === 0 ? 1 : -1;
      const spin = t * 0.15 * dir + layer * (Math.PI / PETALS); // counter-rotate + interleave
      for (let i = 0; i < PETALS; i++) {
        const v = vals[(i + layer) % PETALS];
        const ang = (i / PETALS) * Math.PI * 2 + spin;
        const L = unit * 0.2 * scale * (0.5 + b * 0.5 + v * 0.7); // bloom + per-band flare
        const W = L * 0.42;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        // Petal: a teardrop closed by two quadratics bulging out to +/-W, base at
        // baseR, tip at baseR+L. Gradient runs translucent base -> bright tip.
        const grad = ctx.createLinearGradient(0, baseR, 0, baseR + L);
        grad.addColorStop(0, rgba(accent, 0.2 * layerAlpha));
        grad.addColorStop(1, rgba(accent, 0.9 * layerAlpha));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, baseR);
        ctx.quadraticCurveTo(W, baseR + L * 0.5, 0, baseR + L);
        ctx.quadraticCurveTo(-W, baseR + L * 0.5, 0, baseR);
        ctx.closePath();
        ctx.fill();
        // faint cream edge so overlapping petals stay legible
        ctx.strokeStyle = rgba(CREAM, 0.12 * layerAlpha);
        ctx.lineWidth = Math.max(1, unit * 0.0015);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Pistil — a seed disc that pulses with the bass.
    const pr = baseR * (1.5 + b * 0.6);
    const pistil = ctx.createRadialGradient(cx, cy, 0, cx, cy, pr);
    pistil.addColorStop(0, rgba(CREAM, 0.95));
    pistil.addColorStop(0.6, rgba(accent, 0.9));
    pistil.addColorStop(1, rgba(accent, 0.2));
    ctx.fillStyle = pistil;
    ctx.beginPath();
    ctx.arc(cx, cy, pr, 0, Math.PI * 2);
    ctx.fill();
  },
};

const garden: VizStyle = {
  id: 'garden',
  name: 'Garden',
  desc: 'A row of flowers growing from the floor on swaying stems, each rising to its own frequency band and blooming on the bass. A side-view, botanical counterpart to the radial Flower.',
  anchor: 'bottom',
  draw: (f) => {
    const { ctx, w, h, t, accent } = f;
    const b = bass(f.freq);
    const N = 7; // stems across the frame
    const vals = buckets(f.freq, N);
    const unit = Math.min(w, h);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < N; i++) {
      const band = vals[i];
      const baseX = ((i + 0.5) / N) * w + (hash01(i, 1) - 0.5) * (w / N) * 0.4;
      const stemH = h * (0.28 + b * 0.18 + band * 0.4); // grows with bass + its band
      const topY = h - stemH;
      const swayPhase = hash01(i, 2) * Math.PI * 2;
      const sway = Math.sin(t * 0.8 + swayPhase) * unit * (0.02 + b * 0.03);
      const lean = (hash01(i, 3) - 0.5) * unit * 0.05;
      const topX = baseX + sway + lean;
      const ctrlX = baseX + (topX - baseX) * 0.5; // a gentle bow up the stem
      const ctrlY = h - stemH * 0.55;
      // stem
      ctx.strokeStyle = rgba(accent, 0.5);
      ctx.lineWidth = Math.max(1.5, unit * 0.005 * (0.6 + band * 0.5));
      ctx.beginPath();
      ctx.moveTo(baseX, h);
      ctx.quadraticCurveTo(ctrlX, ctrlY, topX, topY);
      ctx.stroke();
      // two leaves part-way up the stem, angled out opposite ways
      for (const lf of [0.4, 0.65]) {
        const lx = baseX + (topX - baseX) * lf;
        const ly = h - stemH * lf;
        const dir = lf === 0.4 ? -1 : 1;
        const ls = unit * 0.05 * (0.7 + band * 0.5);
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(dir * 0.9 + sway * 0.02);
        ctx.fillStyle = rgba(accent, 0.35);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(ls * 0.5, -ls * 0.4, ls, 0);
        ctx.quadraticCurveTo(ls * 0.5, ls * 0.4, 0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // flower head: a small petal ring that opens with the bass
      const headR = unit * (0.03 + b * 0.02 + band * 0.03);
      const PETALS = 8;
      ctx.save();
      ctx.translate(topX, topY);
      ctx.rotate(t * 0.2 + i);
      for (let p = 0; p < PETALS; p++) {
        const pl = headR * (1.4 + b * 0.8);
        const pw = pl * 0.5;
        ctx.save();
        ctx.rotate((p / PETALS) * Math.PI * 2);
        const g = ctx.createLinearGradient(0, headR * 0.3, 0, headR * 0.3 + pl);
        g.addColorStop(0, rgba(accent, 0.3));
        g.addColorStop(1, rgba(accent, 0.9));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, headR * 0.3);
        ctx.quadraticCurveTo(pw, headR * 0.3 + pl * 0.5, 0, headR * 0.3 + pl);
        ctx.quadraticCurveTo(-pw, headR * 0.3 + pl * 0.5, 0, headR * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // pistil
      ctx.fillStyle = rgba(CREAM, 0.9);
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1, headR * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
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
  smoke,
  rain,
  snow,
  starfield,
  fog,
  flower,
  garden,
];
export const VIZ_STYLE_MAP: Record<string, VizStyle> = Object.fromEntries(
  VIZ_STYLES.map((s) => [s.id, s])
);
