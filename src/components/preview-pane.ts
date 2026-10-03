import { LitElement, html } from 'lit';
import { store, StoreController } from '../state/store';

type Drag = {
  type: 'pan' | 'select';
  id: number;
  x: number;
  y: number;
  px: number;
  py: number;
  start: { x: number; y: number };
};

export class PreviewPane extends LitElement {
  static properties = {
    kind: { type: String },
  };

  kind: 'original' | 'output' = 'original';
  private drag: Drag | null = null;

  constructor() {
    super();
    new StoreController(this);
  }

  createRenderRoot(): this {
    return this;
  }

  private canvas(): HTMLCanvasElement | null {
    return this.querySelector('canvas');
  }

  render() {
    const kind = this.kind;
    const srcCanvas = kind === 'original' ? store.source : (store.result?.preview ?? null);
    const empty = !srcCanvas;
    const title = kind === 'original' ? 'ORIGINEEL' : `${store.targetLabel()} PREVIEW`;
    const tag = kind === 'original' ? 'PNG' : store.targetLabel();
    const meta =
      kind === 'original'
        ? store.source
          ? `PNG · ${store.source.width} × ${store.source.height}`
          : '—'
        : store.result
          ? `${store.targetLabel()} · ${store.result.width} × ${store.result.height} · ${store.result.palette.length} KL`
          : '—';
    const selText = store.selection ? `SELECTIE: ${store.selection.w} × ${store.selection.h} PX` : 'SELECTIE: —';

    return html`
      <section class="window">
        <div class="window-head">▦▦▦ ${title} <small>${tag}</small></div>
        <div
          class="canvas-wrap"
          @pointerdown=${(e: PointerEvent) => this.onPointerDown(e)}
          @pointermove=${(e: PointerEvent) => this.onPointerMove(e)}
          @pointerup=${(e: PointerEvent) => this.onPointerUp(e)}
          @pointercancel=${(e: PointerEvent) => this.onPointerUp(e)}
          @click=${() => this.onClick()}
          @dragover=${(e: DragEvent) => this.onDragOver(e)}
          @dragleave=${() => this.onDragLeave()}
          @drop=${(e: DragEvent) => this.onDrop(e)}
        >
          <canvas></canvas>
          <div class="empty" ?hidden=${!empty}>
            ${kind === 'original'
              ? html`LAAD EEN PNG<small>klik of sleep hier een PNG</small>`
              : html`WACHT OP BRON<small>geïndexeerde preview</small>`}
          </div>
        </div>
        <div class="window-foot">
          <span class="foot-meta">${meta}</span>
          <span class="selection-size">${selText}</span>
          <div class="nav">
            <button title="Uitzoomen" @click=${() => this.changeZoom(-0.5)}>−</button>
            <button title="Inzoomen" @click=${() => this.changeZoom(0.5)}>+</button>
            <button title="Weergave herstellen" @click=${() => store.setView(this.kind, { zoom: 1, x: 0, y: 0 })}>↻</button>
          </div>
        </div>
        ${kind === 'output' ? html`<div class="palette-bar"><pf-palette-swatches></pf-palette-swatches></div>` : ''}
      </section>
    `;
  }

  updated(): void {
    this.draw();
  }

  private draw(): void {
    const canvas = this.canvas();
    if (!canvas) return;
    const srcCanvas = this.kind === 'original' ? store.source : (store.result?.preview ?? null);
    if (!srcCanvas) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }
    if (canvas.width !== srcCanvas.width) canvas.width = srcCanvas.width;
    if (canvas.height !== srcCanvas.height) canvas.height = srcCanvas.height;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(srcCanvas, 0, 0);
    this.drawSelection(ctx, canvas.width, canvas.height);
    this.applyView(canvas, canvas.width, canvas.height);
  }

  private drawSelection(ctx: CanvasRenderingContext2D, srcW: number, srcH: number): void {
    const s = store.selection;
    const r = store.result;
    if (!s || !r) return;
    const scaleX = this.kind === 'original' ? srcW / r.width : 1;
    const scaleY = this.kind === 'original' ? srcH / r.height : 1;
    const v = store.views[this.kind];
    ctx.save();
    ctx.strokeStyle = '#ffc83d';
    ctx.lineWidth = Math.max(1, 1 / v.zoom);
    ctx.setLineDash([4 / v.zoom, 3 / v.zoom]);
    ctx.strokeRect(s.x * scaleX, s.y * scaleY, s.w * scaleX, s.h * scaleY);
    ctx.restore();
  }

  private applyView(canvas: HTMLCanvasElement, w: number, h: number): void {
    const v = store.views[this.kind];
    canvas.style.width = `${w * v.zoom}px`;
    canvas.style.height = `${h * v.zoom}px`;
    canvas.style.transform = `translate(calc(-50% + ${v.x}px), ${v.y}px)`;
  }

  private changeZoom(delta: number): void {
    const v = store.views[this.kind];
    const zoom = Math.max(0.25, Math.min(32, v.zoom + delta));
    store.setView(this.kind, { ...v, zoom });
  }

  private point(e: PointerEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvas.width, Math.floor(((e.clientX - r.left) * canvas.width) / r.width))),
      y: Math.max(0, Math.min(canvas.height, Math.floor(((e.clientY - r.top) * canvas.height) / r.height))),
    };
  }

  private toIff(p: { x: number; y: number }): { x: number; y: number } {
    if (this.kind === 'output') return p;
    const r = store.result;
    const s = store.source;
    if (!r || !s) return p;
    return {
      x: Math.round((p.x * r.width) / s.width),
      y: Math.round((p.y * r.height) / s.height),
    };
  }

  private onPointerDown(e: PointerEvent): void {
    if (!store.source) return;
    const canvas = this.canvas();
    if (!canvas || !canvas.width) return;
    const pan = e.button === 1 || e.metaKey || e.ctrlKey || store.mode === 'pan';
    if (store.mode === 'zoom' && e.button === 0) {
      this.changeZoom(0.5);
      return;
    }
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    if (pan) {
      const v = store.views[this.kind];
      this.drag = { type: 'pan', id: e.pointerId, x: e.clientX, y: e.clientY, px: v.x, py: v.y, start: { x: 0, y: 0 } };
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (e.button !== 0) return;
    const p = this.toIff(this.point(e, canvas));
    this.drag = { type: 'select', id: e.pointerId, x: e.clientX, y: e.clientY, px: 0, py: 0, start: p };
    store.setSelection({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  private onPointerMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    const canvas = this.canvas();
    if (!canvas) return;
    if (d.type === 'pan') {
      const v = store.views[this.kind];
      store.setView(this.kind, { zoom: v.zoom, x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y });
    } else {
      const p = this.toIff(this.point(e, canvas));
      const a = d.start;
      store.setSelection({
        x: Math.min(a.x, p.x),
        y: Math.min(a.y, p.y),
        w: Math.abs(a.x - p.x),
        h: Math.abs(a.y - p.y),
      });
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.drag || this.drag.id !== e.pointerId) return;
    this.drag = null;
    const canvas = this.canvas();
    if (canvas) {
      canvas.style.cursor = store.mode === 'zoom' ? 'zoom-in' : store.mode === 'pan' ? 'grab' : 'crosshair';
    }
    if (store.selection && (store.selection.w < 1 || store.selection.h < 1)) store.setSelection(null);
  }

  private onClick(): void {
    if (this.kind === 'original' && !store.source) store.fileInput?.click();
  }

  private onDragOver(e: DragEvent): void {
    if (this.kind !== 'original') return;
    e.preventDefault();
    this.querySelector('.canvas-wrap')?.classList.add('dropping');
  }

  private onDragLeave(): void {
    this.querySelector('.canvas-wrap')?.classList.remove('dropping');
  }

  private onDrop(e: DragEvent): void {
    if (this.kind !== 'original') return;
    e.preventDefault();
    this.querySelector('.canvas-wrap')?.classList.remove('dropping');
    const f = e.dataTransfer?.files?.[0];
    if (f) store.loadFile(f);
  }
}

customElements.define('pf-preview-pane', PreviewPane);

