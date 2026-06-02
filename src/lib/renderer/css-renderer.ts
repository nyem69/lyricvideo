import type { Renderer } from './types';
import type { Line, Section, StylePreset, CssPresetConfig } from '$lib/model/types';

export class CssRenderer implements Renderer {
  readonly type = 'css' as const;

  private container: HTMLElement | null = null;
  private display: HTMLElement | null = null;
  private bgLayer: HTMLElement | null = null;
  private vignette: HTMLElement | null = null;
  private config: CssPresetConfig | null = null;
  private shownLines = new Set<string>();
  private currentSectionId: string | null = null;
  private isTransitioning = false;

  mount(container: HTMLElement) {
    this.container = container;
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.style.width = '100%';
    container.style.height = '100%';

    this.bgLayer = document.createElement('div');
    this.bgLayer.style.cssText = 'position:absolute;inset:0;transition:background 2s ease;';
    container.appendChild(this.bgLayer);

    this.vignette = document.createElement('div');
    this.vignette.style.cssText = 'position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,0.6) 100%);pointer-events:none;z-index:1;';
    container.appendChild(this.vignette);

    this.display = document.createElement('div');
    this.display.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;z-index:10;';
    container.appendChild(this.display);
  }

  setPreset(preset: StylePreset) {
    this.config = preset.config;
    if (this.bgLayer) {
      this.bgLayer.style.background = preset.config.background;
    }
  }

  showLine(line: Line) {
    if (!this.display || !this.config) return;
    const display = this.display;
    const config = this.config;
    const dur = config.transitionDuration;
    const ease = 'cubic-bezier(0.25,0.46,0.45,0.94)';

    // FLIP step 1 — record where every on-screen line currently sits (First).
    // Lines are centred in a flex column, so adding/removing one would normally
    // snap the survivors to new positions. We capture the "before" rects so we
    // can animate that shift instead of letting the browser jump it.
    const existing = Array.from(display.querySelectorAll<HTMLElement>('[data-line-id]'));
    const dispRect = display.getBoundingClientRect();
    const first = new Map<HTMLElement, DOMRect>();
    for (const node of existing) first.set(node, node.getBoundingClientRect());

    // Build the incoming line, hidden and offset by its enter animation. Only
    // opacity + transform transition (compositor-friendly) — never `all`.
    const el = document.createElement('div');
    el.dataset.lineId = line.id;
    el.textContent = line.text;
    el.style.cssText = `
      opacity:0;
      text-align:center;
      max-width:85%;
      line-height:1.5;
      font-family:${config.fontFamily};
      font-size:${config.fontSize};
      font-weight:${config.fontWeight};
      font-style:${config.fontStyle};
      color:${config.color};
      letter-spacing:${config.letterSpacing};
      text-transform:${config.textTransform};
      text-shadow:${config.textShadow};
      transition:opacity ${dur}ms ${ease}, transform ${dur}ms ${ease};
      will-change:opacity, transform;
    `;

    switch (config.enterAnimation) {
      case 'fade-up': el.style.transform = 'translateY(40px)'; break;
      case 'fade-in': break;
      case 'slide-left': el.style.transform = 'translateX(-60px)'; break;
      case 'scale-in': el.style.transform = 'scale(0.8)'; break;
      case 'slam':
        el.style.transform = 'scale(3)';
        el.style.transition = 'opacity 300ms cubic-bezier(0,0,0.2,1), transform 300ms cubic-bezier(0,0,0.2,1)';
        break;
    }

    display.appendChild(el);

    // Over the cap? Retire the oldest line. Pin it to its current spot as an
    // out-of-flow element so neither its fade-out nor its later removal can
    // reflow (and re-jerk) the lines that stay.
    let retiring: HTMLElement | null = null;
    const all = Array.from(display.querySelectorAll<HTMLElement>('[data-line-id]'));
    if (all.length > config.maxVisibleLines) {
      retiring = all[0];
      const r = first.get(retiring)!;
      retiring.style.position = 'absolute';
      retiring.style.margin = '0';
      retiring.style.top = `${r.top - dispRect.top}px`;
      retiring.style.left = `${r.left - dispRect.left}px`;
      retiring.style.width = `${r.width}px`;
    }

    // FLIP step 2 — read the survivors' final positions (Last) and invert: jump
    // them back to where they were, with transitions off, so nothing has painted yet.
    const survivors = existing.filter((node) => node !== retiring);
    for (const node of survivors) {
      const dy = first.get(node)!.top - node.getBoundingClientRect().top;
      if (dy) {
        node.style.transition = 'none';
        node.style.transform = `translateY(${dy}px)`;
      }
    }

    // Commit the inverted state before we play it back.
    void display.getBoundingClientRect();

    // FLIP step 3 — play: survivors glide to their new slots, the new line
    // enters, and the retiree fades up and out, all on the same frame.
    requestAnimationFrame(() => {
      for (const node of survivors) {
        node.style.transition = `transform ${dur}ms ${ease}`;
        node.style.transform = '';
      }
      el.style.opacity = '1';
      el.style.transform = 'translateY(0) scale(1)';
      if (retiring) {
        retiring.style.opacity = '0';
        retiring.style.transform = 'translateY(-30px) scale(0.97)';
      }
    });

    if (retiring) {
      const toRemove = retiring;
      setTimeout(() => toRemove.remove(), dur);
    }
  }

  clearLines(animated = true) {
    if (!this.display) return;
    if (!animated) {
      this.display.textContent = '';
      this.shownLines.clear();
      return;
    }

    this.isTransitioning = true;
    const lines = this.display.querySelectorAll('[data-line-id]');
    lines.forEach(l => {
      (l as HTMLElement).style.opacity = '0';
      (l as HTMLElement).style.transform = 'translateY(-30px) scale(0.97)';
    });
    setTimeout(() => {
      if (this.display) this.display.textContent = '';
      this.shownLines.clear();
      this.isTransitioning = false;
    }, 800);
  }

  update(currentTime: number, section: Section | null) {
    if (!section || this.isTransitioning) return;

    if (section.id !== this.currentSectionId) {
      this.currentSectionId = section.id;
      this.clearLines(true);
      return;
    }

    for (const line of section.lines) {
      if (currentTime >= line.startTime && !this.shownLines.has(line.id)) {
        this.shownLines.add(line.id);
        this.showLine(line);
      }
    }
  }

  resize(_width: number, _height: number) {}

  destroy() {
    if (this.container) this.container.textContent = '';
    this.shownLines.clear();
  }
}
