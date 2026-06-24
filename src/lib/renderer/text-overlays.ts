// src/lib/renderer/text-overlays.ts
import type { LyricBand, TextStyle } from '$lib/montage/model';
import { getFontFamily } from '$lib/montage/fonts';

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const tentative = current ? `${current} ${word}` : word;
    if (ctx.measureText(tentative).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = tentative;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * One line of lyric text drawn as an animated glitch: a dark outline for
 * legibility, additive cyan/magenta chromatic-split ghosts, and a crisp fill on
 * top — all jittered by a deterministic hash of (seed, t) so the same frame
 * re-renders identically on export (no Math.random).
 */
function drawGlitchLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontPx: number,
  color: string,
  t: number,
  seed: number
): void {
  const hash = (n: number) => {
    const s = Math.sin(n * 12.9898 + t * 8) * 43758.5453;
    return s - Math.floor(s);
  };
  const unit = fontPx * 0.05;
  let jx = (hash(seed) - 0.5) * unit * 2;
  if (hash(seed + 7) > 0.82) jx *= 3.5; // occasional hard tear
  const split = unit * (0.7 + hash(seed + 3) * 1.1);

  // outline carries the soft shadow (legibility over busy backgrounds)
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = fontPx * 0.5;
  ctx.shadowOffsetY = fontPx * 0.04;
  ctx.strokeText(text, x + jx, y);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // chromatic ghosts, additive so the overlaps read like split RGB channels
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(0, 200, 255, 0.55)';
  ctx.fillText(text, x + jx - split, y + (hash(seed + 1) - 0.5) * unit);
  ctx.fillStyle = 'rgba(255, 40, 90, 0.55)';
  ctx.fillText(text, x + jx + split, y + (hash(seed + 2) - 0.5) * unit);
  ctx.globalCompositeOperation = prevOp;

  // crisp main fill on top
  ctx.fillStyle = color;
  ctx.fillText(text, x + jx, y);
}

export function drawLyricBand(
  ctx: CanvasRenderingContext2D,
  band: LyricBand,
  W: number,
  H: number,
  bandStyle: TextStyle,
  // Optional vertical CENTRE of the lyric block as a fraction of H. When omitted
  // the legacy bottom-edge placement (block bottom at 0.86·H) is used unchanged,
  // so the montage renderer — which doesn't pass this — keeps its exact look.
  anchorY?: number,
  // Playback time (seconds) — only used to animate the glitch effect. Defaults
  // to 0 so callers that don't animate (montage) are unaffected.
  t = 0
): void {
  // save() first so font/align/baseline (set below, needed for measureText) are
  // restored too — this is a shared helper, it must not leak ctx state to callers.
  ctx.save();
  const fontPx = Math.round(H * bandStyle.sizePct);
  ctx.font = `${bandStyle.fontWeight} ${fontPx}px ${getFontFamily(bandStyle.fontFamilyId).stack}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = wrapText(ctx, band.primary, W * 0.82);
  const lineH = fontPx * 1.25;
  const blockH = lines.length * lineH;
  const half = blockH / 2;
  // Legacy (anchorY undefined): block BOTTOM sits at 0.86·H. Preset placement:
  // centre the block on the anchor line, clamped with a 4% margin so a tall/
  // multi-line block near an edge never spills off-canvas.
  const topY =
    anchorY === undefined
      ? H * 0.86 - blockH
      : Math.min(H - half - H * 0.04, Math.max(half + H * 0.04, H * anchorY)) - half;

  // No scrim bar — legibility comes from a soft drop shadow plus a thin dark
  // glyph outline, so the text reads over bright/busy photo areas (e.g. sky).
  ctx.lineJoin = 'round';
  ctx.lineWidth = fontPx * 0.07;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.fillStyle = bandStyle.color;
  lines.forEach((ln, i) => {
    const y = topY + i * lineH + lineH / 2;
    if (bandStyle.glitch) {
      drawGlitchLine(ctx, ln, W / 2, y, fontPx, bandStyle.color, t, i + 1);
      return;
    }
    // Pass 1: outline carries the shadow (densest halo around the glyph edge).
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = fontPx * 0.5;
    ctx.shadowOffsetY = fontPx * 0.04;
    ctx.strokeText(ln, W / 2, y);
    // Pass 2: crisp light fill on top, no shadow (avoids a muddy double halo).
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillText(ln, W / 2, y);
  });
  ctx.restore();
}

export function drawTitleCard(
  ctx: CanvasRenderingContext2D,
  title: string,
  W: number,
  H: number,
  titleStyle: TextStyle,
  colors: { background: string; accent: string }
): void {
  ctx.save();
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, W, H);
  const fontPx = Math.round(H * titleStyle.sizePct);
  ctx.font = `${titleStyle.fontWeight} ${fontPx}px ${getFontFamily(titleStyle.fontFamilyId).stack}`;
  ctx.fillStyle = titleStyle.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, W / 2, H / 2 - fontPx * 0.3);
  // gold divider
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = Math.max(1, H * 0.003);
  ctx.beginPath();
  ctx.moveTo(W / 2 - W * 0.08, H / 2 + fontPx * 0.5);
  ctx.lineTo(W / 2 + W * 0.08, H / 2 + fontPx * 0.5);
  ctx.stroke();
  ctx.restore();
}
