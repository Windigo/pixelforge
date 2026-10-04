import type { ReactiveController, ReactiveControllerHost } from 'lit';

import { rgbDist } from '../core/color';
import { convert } from '../core/convert';
import type { DitherPattern } from '../core/dither';
import type { ConvertResult } from '../core/convert';
import type { RGB, Sampling, Selection, Target, ToolMode, ViewState } from '../core/types';
import { buildIlbm, buildPng, buildSc2, buildSc5, downloadFiles, type FileOutput } from '../export/exporters';
import { buildDisk, sanitize83, type DiskFile } from '../export/disk';
import { decodeImage, detectFormat, FORMAT_LABELS, indexedToCanvas, parsePal, type DecodedImage, type SourceFormat } from '../import/importers';
import { createSubdir, hasFsAccess, loadDirHandle, pickDirectory, writeFiles, type SaveFile } from './fs';

type Listener = () => void;

export class AppStore {
  source: HTMLCanvasElement | null = null;
  result: ConvertResult | null = null;
  sourceType: SourceFormat = 'png';
  sourceDecoded: DecodedImage | null = null;

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
  aspectRatioLocked = true;

  pinned: RGB[] = [];
  selection: Selection | null = null;
  mode: ToolMode = 'pan';
  fg = 1;
  bg = 1;
  showGrid = false;
  brushSize = 1;
  brushShape: 'round' | 'square' = 'round';
  ditherPattern: DitherPattern = 'checkerboard';
  ditherLevel = 8;
  ditherManual = false;
  undoStack: Uint8Array[] = [];
  views: { original: ViewState; output: ViewState } = {
    original: { zoom: 1, x: 0, y: 0 },
    output: { zoom: 1, x: 0, y: 0 },
  };
  status = { head: 'WAITING FOR SOURCE', text: 'Load an image to begin.' };

  fileInput: HTMLInputElement | null = null;

  saveDialogOpen = false;
  saveFiles: FileOutput[] = [];
  saveDir: FileSystemDirectoryHandle | null = null;
  saveDirName = '';
  saveName = '';
  saveIncludePal = false;
  saveMakeDisk = false;

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

  sourceLabel(): string {
    return FORMAT_LABELS[this.sourceType];
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
    this.widthInput = '';
    this.heightInput = '';
    this.resample = true;
    this.reconvert();
  }
  setSampling(s: Sampling): void { this.sampling = s; this.reconvert(); }

  setSize(axis: 'width' | 'height', value: string): void {
    const trimmed = value.trim();
    const size = Number(trimmed);
    if (!trimmed || !Number.isFinite(size) || size <= 0) {
      this.widthInput = '';
      this.heightInput = '';
    } else {
      const requested = Math.max(1, Math.min(8192, Math.round(size)));
      const source = this.source;
      if (axis === 'width') {
        this.widthInput = String(requested);
        this.heightInput = this.aspectRatioLocked && source
          ? String(Math.max(1, Math.round((requested * source.height) / source.width)))
          : '';
      } else {
        this.heightInput = String(requested);
        this.widthInput = this.aspectRatioLocked && source
          ? String(Math.max(1, Math.round((requested * source.width) / source.height)))
          : '';
      }
    }
    this.resample = true;
    this.reconvert();
  }

  toggleAspectRatio(): void {
    this.aspectRatioLocked = !this.aspectRatioLocked;
    this.notify();
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
  setSaveName(v: string): void { this.saveName = v; this.notify(); }
  setSaveIncludePal(v: boolean): void { this.saveIncludePal = v; this.notify(); }
  setSaveMakeDisk(v: boolean): void { this.saveMakeDisk = v; this.notify(); }
  setFg(i: number): void { this.fg = i; this.notify(); }
  setBg(i: number): void { this.bg = i; this.notify(); }
  setShowGrid(v: boolean): void { this.showGrid = v; this.notify(); }
  setBrushSize(n: number): void { this.brushSize = n; this.notify(); }
  setBrushShape(s: 'round' | 'square'): void { this.brushShape = s; this.notify(); }
  setDitherPattern(p: DitherPattern): void { this.ditherPattern = p; this.notify(); }
  setDitherLevel(n: number): void { this.ditherLevel = n; this.notify(); }
  setDitherManual(v: boolean): void { this.ditherManual = v; this.notify(); }

  private writePixel(x: number, y: number, index: number): void {
    const r = this.result;
    if (!r) return;
    r.indexed[y * r.width + x] = index;
    const ctx = r.preview.getContext('2d')!;
    const p = ctx.getImageData(x, y, 1, 1);
    if (index === 0) {
      p.data[3] = 0;
    } else {
      const c = r.palette[index] ?? [0, 0, 0];
      p.data[0] = c[0];
      p.data[1] = c[1];
      p.data[2] = c[2];
      p.data[3] = 255;
    }
    ctx.putImageData(p, x, y);
  }

  paint(x: number, y: number, index: number): void {
    if (!this.result) return;
    if (x < 0 || y < 0 || x >= this.result.width || y >= this.result.height) return;
    this.writePixel(x, y, index);
    this.notify();
  }

  stamp(cx: number, cy: number, radius: number, getColor: (x: number, y: number) => number): void {
    if (!this.result) return;
    const R = this.result;
    const square = this.brushShape === 'square';
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (!square && dx * dx + dy * dy > radius * radius) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= R.width || y >= R.height) continue;
        this.writePixel(x, y, getColor(x, y));
      }
    }
    this.notify();
  }

  sampleColors(cx: number, cy: number, radius: number): [number, number] {
    if (!this.result) return [this.fg, this.bg];
    const R = this.result;
    const counts = new Map<number, number>();
    for (let dy = -radius - 2; dy <= radius + 2; dy++) {
      for (let dx = -radius - 2; dx <= radius + 2; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= R.width || y >= R.height) continue;
        const idx = R.indexed[y * R.width + x];
        if (idx === 0) continue;
        counts.set(idx, (counts.get(idx) ?? 0) + 1);
      }
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length >= 2) {
      const a = sorted[0][0];
      const b = sorted[1][0];
      return a < b ? [a, b] : [b, a];
    }
    if (sorted.length === 1) return [sorted[0][0], this.bg];
    return [this.fg, this.bg];
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
    try {
      const format = await detectFormat(file);
      if (format === 'pal') {
        const bytes = new Uint8Array(await file.arrayBuffer());
        this.applyPalette(parsePal(bytes));
        return;
      }
      if (format === 'png') {
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
          this.sourceDecoded = null;
        } finally {
          URL.revokeObjectURL(url);
        }
      } else {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const decoded = decodeImage(bytes, format);
        this.sourceDecoded = decoded;
        this.source = indexedToCanvas(decoded.indexed, decoded.palette, decoded.width, decoded.height, decoded.transparentZero);
      }
      this.sourceType = format;
      this.views = { original: { zoom: 1, x: 0, y: 0 }, output: { zoom: 1, x: 0, y: 0 } };
      this.selection = null;
      this.reconvert();
    } catch (e) {
      this.setStatus('LOAD ERROR', e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  private applyPalette(palette: RGB[]): void {
    const d = this.sourceDecoded;
    if (!d) {
      this.setStatus('PALETTE ERROR', 'Load a SCREEN 5 / SCREEN 2 / IFF image first, then the .pal.');
      return;
    }
    d.palette = palette;
    this.source = indexedToCanvas(d.indexed, palette, d.width, d.height, d.transparentZero);
    this.setStatus('PALETTE LOADED', 'Palette toegepast op het beeld.');
    this.reconvert();
  }

  private buildSaveFiles(): Promise<FileOutput[]> {
    const r = this.result!;
    if (this.target === 'amiga') return Promise.resolve(buildIlbm(r, this.selection, this.planes));
    if (this.target === 'sc5') return Promise.resolve(buildSc5(r));
    if (this.target === 'sc2') return Promise.resolve(buildSc2(r));
    return buildPng(r, this.selection);
  }

  async openSaveDialog(): Promise<void> {
    if (!this.result) return;
    const files = await this.buildSaveFiles();
    this.saveFiles = files;
    if (!hasFsAccess()) {
      downloadFiles(files.map((f) => ({ name: `pixelforge${f.ext}`, data: f.data })));
      this.setStatus('EXPORTED', 'Gedownload (deze browser ondersteunt geen map-keuze).');
      return;
    }
    this.saveDialogOpen = true;
    this.saveName = '';
    this.saveIncludePal = this.target === 'sc5' || (this.target === 'sc2' && !this.msx1);
    this.saveMakeDisk = false;
    this.notify();
    const h = await loadDirHandle();
    if (h) {
      this.saveDir = h;
      this.saveDirName = h.name;
      this.notify();
    }
  }

  closeSaveDialog(): void {
    this.saveDialogOpen = false;
    this.notify();
  }

  async chooseSaveDir(): Promise<void> {
    const h = await pickDirectory();
    if (h) {
      this.saveDir = h;
      this.saveDirName = h.name;
      this.notify();
    }
  }

  private basicLoader(baseName: string, ext: string): string {
    const screen = this.target === 'sc2' ? 2 : 5;
    const fname = sanitize83(`${baseName}.${ext}`);
    const lines: string[] = [`10 SCREEN ${screen}`];
    if (screen === 5) {
      lines.push(`20 BLOAD "${fname}",S`);
      // The top-left pixel is palette index 0. BASIC treats palette 0 as
      // transparent by default, so enable its normal solid-color behavior.
      lines.push('30 VDP(9)=VDP(9) OR &H20');
      lines.push('40 COLOR=RESTORE');
      lines.push('50 IF INKEY$="" THEN 50');
      lines.push('60 END');
    } else {
      // Select the standard SCREEN 2 color table and all three pattern/color
      // thirds explicitly before loading the VRAM dump.
      lines.push('20 VDP(3)=255');
      lines.push('30 VDP(4)=3');
      // Color 0 is transparent; use palette color 1 (black) as the backdrop.
      lines.push('40 COLOR 15,1');
      lines.push(`50 BLOAD "${fname}",S`);
      lines.push('60 REM VDP(7) bepaalt de achtergrondkleur; 1 is zwart.');
      lines.push('70 VDP(7)=1');
      lines.push('80 IF INKEY$="" THEN 80');
      lines.push('90 END');
    }
    return lines.join('\r\n') + '\r\n';
  }

  async doSave(): Promise<void> {
    const baseName = this.saveName.trim();
    if (!baseName) {
      this.setStatus('SAVE ERROR', 'Geef een naam op.');
      return;
    }
    const dir = this.saveDir;
    if (!dir) {
      this.setStatus('SAVE ERROR', 'Kies eerst een map.');
      return;
    }
    const includePal = this.saveIncludePal;
    const makeDisk = this.saveMakeDisk;
    try {
      const sub = await createSubdir(dir, baseName);
      const files = this.saveFiles.filter((f) => f.ext !== '.pal' || includePal);
      const writes: SaveFile[] = files.map((f) => ({ name: `${baseName}${f.ext}`, data: f.data }));

      if (makeDisk && (this.target === 'sc5' || this.target === 'sc2')) {
        const diskFiles: DiskFile[] = [];
        for (const f of files) diskFiles.push({ name: sanitize83(`${baseName}${f.ext}`), data: f.data });
        const imageExt = this.target === 'sc2' ? 'sc2' : 'sc5';
        const bas = this.basicLoader(baseName, imageExt);
        diskFiles.push({ name: sanitize83(`${baseName}.bas`), data: new TextEncoder().encode(bas) });
        writes.push({ name: `${baseName}.dsk`, data: buildDisk(diskFiles) });
      }

      await writeFiles(sub, writes);
      this.setStatus('SAVED', `Opgeslagen in ${dir.name}/${baseName} (${writes.length} bestand${writes.length === 1 ? '' : 'en'}).`);
      this.closeSaveDialog();
    } catch (e) {
      this.setStatus('SAVE ERROR', e instanceof Error ? e.message : 'Opslaan mislukt.');
    }
  }

  private reconvert(): void {
    if (!this.source) {
      this.notify();
      return;
    }
    try {
      const converted = convert(this.source, {
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
      if (this.target === 'sc2') {
        // Show the actual two-colors-per-8-pixel-row SCREEN 2 result instead
        // of the unconstrained indexed source preview. Color 0 is transparent
        // on hardware; this loader uses color 1 as its backdrop.
        const sc2 = buildSc2(converted)[0];
        const decoded = decodeImage(sc2.data, 'sc2');
        converted.indexed = decoded.indexed;
        converted.preview = indexedToCanvas(decoded.indexed, converted.palette, decoded.width, decoded.height, true);
      }
      this.result = converted;
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
