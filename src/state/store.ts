import type { ReactiveController, ReactiveControllerHost } from 'lit';

import { rgbDist } from '../core/color';
import { convert } from '../core/convert';
import type { ConvertResult } from '../core/convert';
import type { RGB, Sampling, Selection, Target, ToolMode, ViewState } from '../core/types';
import { exportIlbm, exportPng, exportSc2, exportSc5 } from '../export/exporters';

type Listener = () => void;

export class AppStore {
  source: HTMLCanvasElement | null = null;
  result: ConvertResult | null = null;

  target: Target = 'amiga';
  msx1 = true;
  colors = 16;
  planes = 5;
  merge = 20;
  dither = false;
  resample = true;
  scale = 100;
  sampling: Sampling = 'center';
  widthInput = '';
  heightInput = '';

  pinned: RGB[] = [];
  selection: Selection | null = null;
  mode: ToolMode = 'pan';
  fg = 1;
  bg = 1;
  showGrid = false;
  undoStack: Uint8Array[] = [];
  views: { original: ViewState; output: ViewState } = {
    original: { zoom: 1, x: 0, y: 0 },
    output: { zoom: 1, x: 0, y: 0 },
  };
  status = { head: 'WAITING FOR SOURCE', text: 'Load a PNG to begin.' };

  fileInput: HTMLInputElement | null = null;

  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  setStatus(head: string, text: string): void {
    this.status = { head, text };
    this.notify();
  }

  targetLabel(): string {
    return { amiga: 'ILBM', sc5: 'SCREEN 5', sc2: 'SCREEN 2', png: 'PNG' }[this.target];
  }

  // ── settings (trigger reconversion) ───────────────────
  setTarget(t: Target): void { this.target = t; this.reconvert(); }
  setMsx1(v: boolean): void { this.msx1 = v; this.reconvert(); }
  setPlanes(n: number): void { this.planes = n; this.reconvert(); }
  setColors(n: number): void { this.colors = n; this.reconvert(); }
  setMerge(n: number): void { this.merge = n; this.reconvert(); }
  setDither(v: boolean): void { this.dither = v; this.reconvert(); }
  setResample(v: boolean): void { this.resample = v; this.reconvert(); }
  setScale(n: number): void {
    this.scale = n;
    this.resample = true;
    this.reconvert();
  }
  setSampling(s: Sampling): void { this.sampling = s; this.reconvert(); }

  setSize(axis: 'width' | 'height', value: string): void {
    if (axis === 'width') {
      this.widthInput = value;
      this.heightInput = '';
    } else {
      this.heightInput = value;
      this.widthInput = '';
    }
    this.resample = true;
    this.reconvert();
  }

  togglePin(c: RGB): void {
    const i = this.pinned.findIndex((p) => rgbDist(p, c) < 2);
    if (i < 0) this.pinned.push([...c] as RGB);
    else this.pinned.splice(i, 1);
    this.reconvert();
  }

  isPinned(c: RGB): boolean {
    return this.pinned.some((p) => rgbDist(p, c) < 2);
  }

  // ── view/interaction (no reconversion) ─────────────────
  setMode(m: ToolMode): void { this.mode = m; this.notify(); }
  setFg(i: number): void { this.fg = i; this.notify(); }
  setBg(i: number): void { this.bg = i; this.notify(); }
  setShowGrid(v: boolean): void { this.showGrid = v; this.notify(); }

  paint(x: number, y: number, index: number): void {
    if (!this.result) return;
    const r = this.result;
    if (x < 0 || y < 0 || x >= r.width || y >= r.height) return;
    r.indexed[y * r.width + x] = index;
    const ctx = r.preview.getContext('2d')!;
    const px = ctx.getImageData(x, y, 1, 1);
    if (index === 0) {
      px.data[0] = 0;
      px.data[1] = 0;
      px.data[2] = 0;
      px.data[3] = 0;
    } else {
      const c = r.palette[index] ?? [0, 0, 0];
      px.data[0] = c[0];
      px.data[1] = c[1];
      px.data[2] = c[2];
      px.data[3] = 255;
    }
    ctx.putImageData(px, x, y);
    this.notify();
  }

  beginUndo(): void {
    if (!this.result) return;
    this.undoStack.push(this.result.indexed.slice());
    if (this.undoStack.length > 100) this.undoStack.shift();
  }

  undo(): void {
    if (!this.result || this.undoStack.length === 0) return;
    const snapshot = this.undoStack.pop()!;
    this.result.indexed.set(snapshot);
    this.redrawPreview();
    this.notify();
  }

  private redrawPreview(): void {
    const r = this.result;
    if (!r) return;
    const ctx = r.preview.getContext('2d')!;
    const img = ctx.createImageData(r.width, r.height);
    for (let i = 0; i < r.indexed.length; i++) {
      const index = r.indexed[i];
      const o = i * 4;
      if (index === 0) {
        img.data[o + 3] = 0;
      } else {
        const c = r.palette[index] ?? [0, 0, 0];
        img.data[o] = c[0];
        img.data[o + 1] = c[1];
        img.data[o + 2] = c[2];
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  setSelection(s: Selection | null): void { this.selection = s; this.notify(); }
  setView(kind: 'original' | 'output', v: ViewState): void {
    this.views[kind] = v;
    this.notify();
  }

  // ── load & export ─────────────────────────────────────
  async loadFile(file: File): Promise<void> {
    this.setStatus('LOADING', `${file.name} is being read…`);
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error('The image could not be decoded.'));
        im.src = url;
      });
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')!.drawImage(img, 0, 0);
      this.source = c;
      this.views = { original: { zoom: 1, x: 0, y: 0 }, output: { zoom: 1, x: 0, y: 0 } };
      this.selection = null;
      this.reconvert();
    } catch (e) {
      this.setStatus('LOAD ERROR', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  export(): void {
    if (!this.result) return;
    const r = this.result;
    if (this.target === 'amiga') {
      const s = this.selection ?? { x: 0, y: 0, w: r.width, h: r.height };
      exportIlbm(r, this.selection, this.planes);
      this.setStatus('EXPORTED', `${s.w || r.width}×${s.h || r.height}px ILBM downloaded.`);
    } else if (this.target === 'sc5') {
      exportSc5(r);
      this.setStatus('EXPORTED', `SCREEN 5 · ${r.width}×${r.height}px · .sc5 (256×212) + .pal downloaded.`);
    } else if (this.target === 'sc2') {
      exportSc2(r);
      this.setStatus('EXPORTED', `SCREEN 2 · ${r.width}×${r.height}px · .sc2 (256×192) + .pal downloaded.`);
    } else {
      const s = this.selection ?? { x: 0, y: 0, w: r.width, h: r.height };
      exportPng(r, this.selection);
      this.setStatus('EXPORTED', `${s.w || r.width}×${s.h || r.height}px pixelart-PNG downloaded.`);
    }
  }

  private reconvert(): void {
    if (!this.source) {
      this.notify();
      return;
    }
    try {
      this.result = convert(this.source, {
        target: this.target,
        msx1: this.msx1,
        planes: this.planes,
        colors: this.colors,
        merge: this.merge,
        dither: this.dither,
        resample: this.resample,
        scale: this.scale,
        sampling: this.sampling,
        pinned: this.pinned,
        widthInput: this.widthInput,
        heightInput: this.heightInput,
      });
      this.selection = null;
      this.setStatus(
        'CONVERTED',
        `${this.result.width}×${this.result.height}px · ${this.result.palette.length} colours · ready for ${this.targetLabel()} export.`,
      );
    } catch (e) {
      console.error(e);
      this.setStatus('CONVERSION ERROR', e instanceof Error ? e.message : 'Something went wrong during conversion.');
    }
  }
}

export const store = new AppStore();

/** ReactiveController that re-renders a Lit component on every store change. */
export class StoreController implements ReactiveController {
  host: ReactiveControllerHost;
  private unsub: (() => void) | null = null;

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  hostConnected(): void {
    this.unsub = store.subscribe(() => this.host.requestUpdate());
  }

  hostDisconnected(): void {
    this.unsub?.();
    this.unsub = null;
  }
}
