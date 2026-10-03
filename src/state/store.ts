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
  mode: ToolMode = 'select';
  views: { original: ViewState; output: ViewState } = {
    original: { zoom: 1, x: 0, y: 0 },
    output: { zoom: 1, x: 0, y: 0 },
  };
  status = { head: 'WACHT OP BRON', text: 'Laad een PNG om te beginnen.' };

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

  // ── instellingen (triggeren reconversie) ──────────────
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

  // ── view/interactie (geen reconversie) ─────────────────
  setMode(m: ToolMode): void { this.mode = m; this.notify(); }
  setSelection(s: Selection | null): void { this.selection = s; this.notify(); }
  setView(kind: 'original' | 'output', v: ViewState): void {
    this.views[kind] = v;
    this.notify();
  }

  // ── laden & exporteren ─────────────────────────────────
  async loadFile(file: File): Promise<void> {
    this.setStatus('LADEN', `${file.name} wordt ingelezen…`);
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error('De afbeelding kon niet worden gedecodeerd.'));
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
      this.setStatus('LAADFOUT', e instanceof Error ? e.message : 'Er ging iets mis.');
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
      this.setStatus('EXPORTED', `${s.w || r.width}×${s.h || r.height}px ILBM gedownload.`);
    } else if (this.target === 'sc5') {
      exportSc5(r);
      this.setStatus('EXPORTED', `SCREEN 5 · ${r.width}×${r.height}px · .sc5 (256×212) + .pal gedownload.`);
    } else if (this.target === 'sc2') {
      exportSc2(r);
      this.setStatus('EXPORTED', `SCREEN 2 · ${r.width}×${r.height}px · .sc2 (256×192) + .pal gedownload.`);
    } else {
      const s = this.selection ?? { x: 0, y: 0, w: r.width, h: r.height };
      exportPng(r, this.selection);
      this.setStatus('EXPORTED', `${s.w || r.width}×${s.h || r.height}px pixelart-PNG gedownload.`);
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
        `${this.result.width}×${this.result.height}px · ${this.result.palette.length} kleuren · klaar voor ${this.targetLabel()}-export.`,
      );
    } catch (e) {
      console.error(e);
      this.setStatus('CONVERSIEFOUT', e instanceof Error ? e.message : 'Er ging iets mis tijdens het omzetten.');
    }
  }
}

export const store = new AppStore();

/** ReactiveController die een Lit-component opnieuw rendert bij elke store-wijziging. */
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
