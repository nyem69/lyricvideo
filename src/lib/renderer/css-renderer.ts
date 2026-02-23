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

    const el = document.createElement('div');
    el.dataset.lineId = line.id;
    el.textContent = line.text;
    el.style.cssText = `
      opacity:0;
      text-align:center;
      max-width:85%;
      line-height:1.5;
      font-family:${this.config.fontFamily};
      font-size:${this.config.fontSize};
      font-weight:${this.config.fontWeight};
      font-style:${this.config.fontStyle};
      color:${this.config.color};
      letter-spacing:${this.config.letterSpacing};
      text-transform:${this.config.textTransform};
      text-shadow:${this.config.textShadow};
      transition:all ${this.config.transitionDuration}ms cubic-bezier(0.25,0.46,0.45,0.94);
    `;

    switch (this.config.enterAnimation) {
      case 'fade-up': el.style.transform = 'translateY(40px)'; break;
      case 'fade-in': break;
      case 'slide-left': el.style.transform = 'translateX(-60px)'; break;
      case 'scale-in': el.style.transform = 'scale(0.8)'; break;
      case 'slam': el.style.transform = 'scale(3)'; el.style.transition = 'all 300ms cubic-bezier(0,0,0.2,1)'; break;
    }

    this.display.appendChild(el);

    const allLines = this.display.querySelectorAll('[data-line-id]');
    if (allLines.length > this.config.maxVisibleLines) {
      const old = allLines[0] as HTMLElement;
      old.style.opacity = '0';
      old.style.transform = 'translateY(-30px) scale(0.97)';
      setTimeout(() => old.remove(), this.config!.transitionDuration);
    }

    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0) scale(1)';
    });
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
