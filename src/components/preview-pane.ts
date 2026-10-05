import { LitElement, html } from 'lit';
import { ditherValue } from '../core/dither';
import { store, StoreController } from '../state/store';
import type { Target } from '../core/types';

const TARGETS: { id: Target; label: string }[] = [
  { id: 'amiga', label: 'AMIGA IFF' },
  { id: 'sc5', label: 'MSX SCREEN 5' },
  { id: 'sc2', label: 'MSX SCREEN 2' },
  { id: 'c64', label: 'C64 MULTICOLOR' },
  { id: 'png', label: 'PIXELART PNG' },
];

type Drag = {
  type: 'pan' | 'draw' | 'marquee' | 'move';
  id: number;
  x: number;
  y: number;
  px: number;
  py: number;
  sx: number;
  sy: number;
  button: number;
  last: { x: number; y: number };
};

export class PreviewPane extends LitElement {
  static properties = {
    kind: { type: String },
  };

  kind: 'original' | 'output' = 'original';
  private drag: Drag | null = null;
  private lastPointer: PointerEvent | null = null;

  constructor() {
    super();
    new StoreController(this);
  }

  createRenderRoot(): this {
    return this;
  }

  firstUpdated(): void {
    const wrap = this.querySelector('.canvas-wrap') as HTMLElement | null;
    wrap?.addEventListener('wheel', (e: WheelEvent) => this.onWheel(e), { passive: false });
  }

  private canvas(): HTMLCanvasElement | null {
    return this.querySelector('canvas');
  }

  render() {
    const kind = this.kind;
    const srcCanvas = kind === 'original' ? store.source : (store.result?.preview ?? null);
    const empty = !srcCanvas;
    const title = kind === 'original' ? 'ORIGINAL' : `${store.targetLabel()} PREVIEW`;
    const tag = kind === 'original' ? store.sourceLabel() : store.targetLabel();
    const meta =
      kind === 'original'
        ? store.source
          ? `${store.sourceLabel()} · ${store.source.width} × ${store.source.height}`
          : '—'
        : store.result
          ? `${store.targetLabel()} · ${store.result.width} × ${store.result.height} · ${store.target === 'sc2' ? new Set(Array.from(store.result.indexed, (index) => index === 0 ? 1 : index)).size : store.result.palette.length} CL`
          : '—';
    const selText = store.selection ? `SELECTION: ${store.selection.w} × ${store.selection.h} PX` : 'SELECTION: —';

    return html`
      <section class="window">
        <div class="window-head">
          <span class="head-title">▦▦▦ ${title}</span>
          ${kind === 'original'
            ? html`<div class="head-actions">${store.source ? html`<small>${tag}</small>` : ''}<button class="fmt save" @click=${() => store.fileInput?.click()}>📂 LOAD AN IMAGE</button></div>`
            : html`
                <div class="head-actions">
                  ${TARGETS.map(
                    (t) => html`
                      <button class=${store.target === t.id ? 'fmt active' : 'fmt'} @click=${() => store.setTarget(t.id)}>${t.label}</button>
                    `,
                  )}
                  <button class="fmt save" ?disabled=${!store.result} @click=${() => store.openSaveDialog()}>💾 SAVE</button>
                </div>
              `}
        </div>
        <div
          class=${kind === 'original' ? 'canvas-wrap droppable' : 'canvas-wrap'}
          @pointerdown=${(e: PointerEvent) => this.onPointerDown(e)}
          @pointermove=${(e: PointerEvent) => this.onPointerMove(e)}
          @pointerup=${(e: PointerEvent) => this.onPointerUp(e)}
          @pointercancel=${(e: PointerEvent) => this.onPointerUp(e)}
          @contextmenu=${(e: Event) => e.preventDefault()}
          @pointerleave=${() => this.hideCursor()}
          @dragover=${(e: DragEvent) => this.onDragOver(e)}
          @dragleave=${() => this.onDragLeave()}
          @drop=${(e: DragEvent) => this.onDrop(e)}
        >
          <canvas></canvas>
          <div class="grid-overlay" hidden></div>
          <canvas class="brush-cursor" hidden></canvas>
          <div class="empty" ?hidden=${!empty}>
            ${kind === 'original'
              ? html`<small>or drag & drop an image here</small>`
              : html`WAITING FOR SOURCE<small>indexed preview</small>`}
          </div>
        </div>
        <div class="window-foot">
          <span class="foot-meta">${meta}</span>
          <span class="selection-size">${selText}</span>
          <div class="nav">
            <button title="Zoom out" @click=${() => this.changeZoom(-0.5)}>−</button>
            <button title="Zoom in" @click=${() => this.changeZoom(0.5)}>+</button>
            <button title="Reset view" @click=${() => store.setView(this.kind, { zoom: 1, x: 0, y: 0 })}>↻</button>
          </div>
        </div>
        <div class="palette-bar">
          ${kind === 'output' ? html`<pf-palette-swatches></pf-palette-swatches>` : ''}
        </div>
      </section>
    `;
  }

  updated(): void {
    this.draw();
    this.applyToolCursor();
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
    this.drawFloating(ctx);
    this.drawBox(ctx, canvas.width, canvas.height);
    this.applyView(canvas, canvas.width, canvas.height);
  }

  private drawSelection(ctx: CanvasRenderingContext2D, srcW: number, srcH: number): void {
    const r = store.result;
    if (!r) return;
    // Tijdens verslepen volgt het selectiekader de zwevende positie.
    const s = store.moveState ?? store.selection;
    if (!s) return;
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

  private drawFloating(ctx: CanvasRenderingContext2D): void {
    if (this.kind !== 'output') return;
    const m = store.moveState;
    const r = store.result;
    if (!m || !r) return;
    // Teken via een tijdelijk canvas + drawImage (source-over), zodat
    // transparante pixels het onderliggende beeld NIET overschrijven.
    const temp = document.createElement('canvas');
    temp.width = m.w;
    temp.height = m.h;
    const tctx = temp.getContext('2d')!;
    const img = tctx.createImageData(m.w, m.h);
    const palette = r.palette;
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        const idx = m.buf[y * m.w + x];
        const o = (y * m.w + x) * 4;
        if (idx === 0) continue; // transparant → blijft alpha 0
        const c = palette[idx] ?? [0, 0, 0];
        img.data[o] = c[0];
        img.data[o + 1] = c[1];
        img.data[o + 2] = c[2];
        img.data[o + 3] = 255;
      }
    }
    tctx.putImageData(img, 0, 0);
    ctx.drawImage(temp, m.x, m.y);
  }

  private applyView(canvas: HTMLCanvasElement, w: number, h: number): void {
    const v = store.views[this.kind];
    const wpx = `${w * v.zoom}px`;
    const hpx = `${h * v.zoom}px`;
    const transform = `translate(calc(-50% + ${v.x}px), ${v.y}px)`;
    canvas.style.width = wpx;
    canvas.style.height = hpx;
    canvas.style.transform = transform;

    const overlay = this.querySelector('.grid-overlay') as HTMLElement | null;
    if (overlay) {
      overlay.style.width = wpx;
      overlay.style.height = hpx;
      overlay.style.transform = transform;
      const step = Math.max(1, Math.round(8 / v.zoom));
      const size = v.zoom * step;
      overlay.style.backgroundSize = `${size}px ${size}px`;
      overlay.hidden = !store.showGrid;
    }
  }

  private drawBox(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const zoom = store.views[this.kind].zoom;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 200, 61, 0.9)';
    ctx.lineWidth = 1 / zoom;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx.restore();
  }

  private updateCursor(e: PointerEvent): void {
    const cursor = this.querySelector('.brush-cursor') as HTMLCanvasElement | null;
    if (!cursor) return;
    const canvas = this.canvas();
    const show =
      this.kind === 'output' &&
      (store.mode === 'pencil' || store.mode === 'eraser' || store.mode === 'dither') &&
      !!store.result &&
      !!canvas &&
      !!canvas.width;
    if (!show) {
      cursor.hidden = true;
      return;
    }
    const p = this.point(e, canvas!);
    const zoom = store.views[this.kind].zoom;
    const r = store.brushSize;
    const size = r * 2 + 1;
    const wrap = this.querySelector('.canvas-wrap') as HTMLElement;
    const cr = canvas!.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    cursor.hidden = false;
    cursor.style.left = `${cr.left - wr.left + (p.x - r) * zoom}px`;
    cursor.style.top = `${cr.top - wr.top + (p.y - r) * zoom}px`;
    cursor.style.width = `${size * zoom}px`;
    cursor.style.height = `${size * zoom}px`;
    this.drawBrushPreview(cursor, p.x, p.y);
  }

  private drawBrushPreview(cvs: HTMLCanvasElement, cx: number, cy: number): void {
    const r = store.brushSize;
    const size = r * 2 + 1;
    cvs.width = size;
    cvs.height = size;
    const ctx = cvs.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const palette = store.result?.palette ?? [];
    const fg = palette[store.fg] ?? [0, 0, 0];
    const bg = palette[store.bg] ?? [0, 0, 0];
    const [a, b] = store.mode === 'dither' && !store.ditherManual ? store.sampleColors(cx, cy, r) : [store.fg, store.bg];
    const ca = palette[a] ?? fg;
    const cb = palette[b] ?? bg;
    const inside = (x: number, y: number): boolean => x * x + y * y <= r * r;
    const square = store.brushShape === 'square';
    for (let dy = 0; dy < size; dy++) {
      const ly = dy - r;
      for (let dx = 0; dx < size; dx++) {
        const lx = dx - r;
        const o = (dy * size + dx) * 4;
        if (!square && !inside(lx, ly)) {
          img.data[o + 3] = 0;
          continue;
        }
        let col: number[];
        if (store.mode === 'pencil') {
          col = fg;
        } else if (store.mode === 'eraser') {
          col = ((lx + ly) & 1) === 0 ? [204, 204, 204] : [153, 153, 153];
        } else {
          const useA = ditherValue(store.ditherPattern, cx + lx, cy + ly) < store.ditherLevel;
          col = useA ? ca : cb;
        }
        img.data[o] = col[0];
        img.data[o + 1] = col[1];
        img.data[o + 2] = col[2];
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  private hideCursor(): void {
    const cursor = this.querySelector('.brush-cursor') as HTMLElement | null;
    if (cursor) cursor.hidden = true;
    this.lastPointer = null;
  }

  private isOverSelection(p: { x: number; y: number }): boolean {
    const s = store.selection;
    return !!s && s.w > 0 && s.h > 0 && p.x >= s.x && p.x < s.x + s.w && p.y >= s.y && p.y < s.y + s.h;
  }

  private setCanvasCursor(e: PointerEvent | null): void {
    const canvas = this.canvas();
    if (!canvas) return;
    if (store.mode === 'select' && this.kind === 'output' && e) {
      const p = this.point(e, canvas);
      canvas.style.cursor = this.isOverSelection(p) ? 'grab' : 'crosshair';
      return;
    }
    canvas.style.cursor = store.mode === 'pan' ? 'grab' : store.mode === 'picker' ? 'copy' : 'crosshair';
  }

  private applyToolCursor(): void {
    this.setCanvasCursor(this.lastPointer);
    if (this.lastPointer) this.updateCursor(this.lastPointer);
    else this.hideCursor();
  }

  private changeZoom(delta: number): void {
    const v = store.views[this.kind];
    const zoom = Math.max(0.25, Math.min(32, v.zoom + delta));
    store.setView(this.kind, { ...v, zoom });
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
    if (e.ctrlKey || e.metaKey) {
      this.changeZoom(e.deltaY < 0 ? 0.5 : -0.5);
      return;
    }
    const v = store.views[this.kind];
    store.setView(this.kind, { zoom: v.zoom, x: v.x - e.deltaX * scale, y: v.y - e.deltaY * scale });
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
    const canvas = this.canvas();
    if (!canvas || !canvas.width) return;
    const pan = e.button === 1 || e.metaKey || e.ctrlKey || store.mode === 'pan';
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    if (pan) {
      const v = store.views[this.kind];
      this.drag = { type: 'pan', id: e.pointerId, x: e.clientX, y: e.clientY, px: v.x, py: v.y, sx: 0, sy: 0, button: 0, last: { x: 0, y: 0 } };
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (store.mode === 'picker') {
      if (this.kind !== 'output') return;
      if (e.button !== 0 && e.button !== 2) return;
      const p = this.toIff(this.point(e, canvas));
      const r = store.result;
      if (!r) return;
      const index = r.indexed[p.y * r.width + p.x];
      if (e.button === 2) store.setBg(index);
      else store.setFg(index);
      return;
    }
    if (store.mode === 'select') {
      if (this.kind !== 'output') return;
      if (e.button !== 0 && e.button !== 2) return;
      const p = this.point(e, canvas);
      const s = store.selection;
      if (s && s.w > 0 && s.h > 0 && p.x >= s.x && p.x < s.x + s.w && p.y >= s.y && p.y < s.y + s.h) {
        // Binnen de selectie: links = knippen (origineel wordt leeg), rechts = kopiëren (origineel blijft).
        if (store.beginMoveSelection(e.button === 2)) {
          this.drag = { type: 'move', id: e.pointerId, x: e.clientX, y: e.clientY, px: s.x, py: s.y, sx: p.x, sy: p.y, button: e.button, last: p };
          canvas.style.cursor = 'grabbing';
        }
      } else if (e.button === 0) {
        // Lege plek → alleen met links een nieuwe selectie tekenen.
        store.setSelection({ x: p.x, y: p.y, w: 1, h: 1 });
        this.drag = { type: 'marquee', id: e.pointerId, x: e.clientX, y: e.clientY, px: p.x, py: p.y, sx: p.x, sy: p.y, button: 0, last: p };
      }
      return;
    }
    if (this.kind !== 'output') return;
    if (e.button !== 0 && e.button !== 2) return;
    const p = this.toIff(this.point(e, canvas));
    this.drag = { type: 'draw', id: e.pointerId, x: e.clientX, y: e.clientY, px: 0, py: 0, sx: p.x, sy: p.y, button: e.button, last: p };
    store.beginUndo();
    this.paintAt(p.x, p.y, e.button);
  }

  private onPointerMove(e: PointerEvent): void {
    this.lastPointer = e;
    this.setCanvasCursor(e);
    this.updateCursor(e);
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    const canvas = this.canvas();
    if (!canvas) return;
    if (d.type === 'pan') {
      const v = store.views[this.kind];
      store.setView(this.kind, { zoom: v.zoom, x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y });
    } else if (d.type === 'move') {
      const p = this.point(e, canvas);
      store.moveSelectionTo(d.px + (p.x - d.sx), d.py + (p.y - d.sy));
    } else if (d.type === 'marquee') {
      const p = this.point(e, canvas);
      const x0 = Math.min(d.sx, p.x);
      const y0 = Math.min(d.sy, p.y);
      store.setSelection({ x: x0, y: y0, w: Math.max(d.sx, p.x) - x0 + 1, h: Math.max(d.sy, p.y) - y0 + 1 });
    } else {
      const p = this.toIff(this.point(e, canvas));
      this.drawLine(d.last.x, d.last.y, p.x, p.y, d.button);
      d.last = p;
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.drag || this.drag.id !== e.pointerId) return;
    const wasMove = this.drag.type === 'move';
    this.drag = null;
    if (wasMove) store.endMoveSelection();
    this.setCanvasCursor(e);
  }

  private paintAt(x: number, y: number, button: number): void {
    const r = store.brushSize;
    if (store.mode === 'eraser') {
      store.stamp(x, y, r, () => 0);
    } else if (store.mode === 'dither') {
      const [a, b] = store.ditherManual ? [store.fg, store.bg] : store.sampleColors(x, y, r);
      store.stamp(x, y, r, (px, py) => (ditherValue(store.ditherPattern, px, py) < store.ditherLevel ? a : b));
    } else {
      const idx = button === 2 ? store.bg : store.fg;
      store.stamp(x, y, r, () => idx);
    }
  }

  private drawLine(x0: number, y0: number, x1: number, y1: number, button: number): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.paintAt(x, y, button);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
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
