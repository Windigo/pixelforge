import type { ConvertResult } from '../core/convert';
import { rgbDist } from '../core/color';
import { msxPaletteBytes } from '../core/msx';
import type { Selection } from '../core/types';

function downloadBlob(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

function downloadBytes(data: Uint8Array, name: string): void {
  downloadBlob(new Blob([data as unknown as BlobPart], { type: 'application/octet-stream' }), name);
}

function bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function u32(v: number): Uint8Array {
  return new Uint8Array([v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]);
}

function chunk(id: string, data: Uint8Array): Uint8Array[] {
  const pad = data.length & 1 ? new Uint8Array(1) : new Uint8Array();
  return [bytes(id), u32(data.length), data, pad];
}

/** BSAVE header (0xFE) for MSX binary files. */
function bsave(data: Uint8Array, start: number, run: number): Uint8Array {
  const end = start + data.length - 1;
  const out = new Uint8Array(7 + data.length);
  out[0] = 0xfe;
  out[1] = start & 255;
  out[2] = (start >> 8) & 255;
  out[3] = end & 255;
  out[4] = (end >> 8) & 255;
  out[5] = run & 255;
  out[6] = (run >> 8) & 255;
  out.set(data, 7);
  return out;
}

export function exportIlbm(r: ConvertResult, selection: Selection | null, planes: number): void {
  const s = selection ?? { x: 0, y: 0, w: r.width, h: r.height };
  const w = s.w || r.width;
  const h = s.h || r.height;
  const rowBytes = Math.ceil(w / 16) * 2;

  const bmhd = new Uint8Array(20);
  const dv = new DataView(bmhd.buffer);
  dv.setUint16(0, w);
  dv.setUint16(2, h);
  dv.setInt16(4, 0);
  dv.setInt16(6, 0);
  bmhd[8] = planes;
  bmhd[9] = 0;
  bmhd[10] = 0;
  dv.setUint16(14, 1);
  dv.setUint16(16, 1);
  dv.setUint16(18, w);

  const cmap = new Uint8Array(r.palette.length * 3);
  r.palette.forEach((c, i) => cmap.set(c, i * 3));

  const body = new Uint8Array(rowBytes * h * planes);
  let p = 0;
  for (let y = 0; y < h; y++) {
    for (let plane = 0; plane < planes; plane++) {
      for (let bx = 0; bx < rowBytes; bx++) {
        let val = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = bx * 8 + bit;
          if (x < w) {
            const idx = r.indexed[(s.y + y) * r.width + s.x + x];
            if (idx & (1 << plane)) val |= 1 << (7 - bit);
          }
        }
        body[p++] = val;
      }
    }
  }

  const bodyChunks = chunk('BODY', body);
  const all = [...chunk('BMHD', bmhd), ...chunk('CMAP', cmap), ...bodyChunks];
  const size = 4 + all.reduce((n, a) => n + a.length, 0);
  const file = new Blob(
    [bytes('FORM'), u32(size), bytes('ILBM'), ...all] as unknown as BlobPart[],
    { type: 'application/octet-stream' },
  );
  downloadBlob(file, 'pixelforge.ilbm');
}

export function exportPng(r: ConvertResult, selection: Selection | null): void {
  const s = selection ?? { x: 0, y: 0, w: r.width, h: r.height };
  const w = s.w || r.width;
  const h = s.h || r.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(r.preview, s.x, s.y, w, h, 0, 0, w, h);
  c.toBlob((b) => {
    if (b) downloadBlob(b, 'pixelforge.png');
  }, 'image/png');
}

export function exportSc5(r: ConvertResult): void {
  const W = 256;
  const H = 212;
  const bitmap = new Uint8Array((W * H) / 2);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x += 2) {
      const i1 = y < r.height && x < r.width ? r.indexed[y * r.width + x] : 0;
      const i2 = y < r.height && x + 1 < r.width ? r.indexed[y * r.width + x + 1] : 0;
      bitmap[(y * W + x) / 2] = (i1 << 4) | i2;
    }
  }
  downloadBytes(bsave(bitmap, 0x0000, 0x0000), 'pixelforge.sc5');
  downloadBytes(msxPaletteBytes(r.palette), 'pixelforge.pal');
}

export function exportSc2(r: ConvertResult, msx1: boolean): void {
  const at = (y: number, x: number): number =>
    y < r.height && x < r.width ? r.indexed[y * r.width + x] : 0;

  const nameTable = new Uint8Array(768);
  const colorTable = new Uint8Array(768 * 8);
  const patterns: Uint8Array[] = [];
  const pIndex = new Map<string, number>();
  let overflow = false;

  for (let by = 0; by < 24; by++) {
    for (let bx = 0; bx < 32; bx++) {
      const block = new Uint8Array(8);
      for (let row = 0; row < 8; row++) {
        const counts = new Map<number, number>();
        for (let px = 0; px < 8; px++) {
          const pi = at(by * 8 + row, bx * 8 + px);
          counts.set(pi, (counts.get(pi) ?? 0) + 1);
        }
        const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        const fg = entries[0][0];
        let bg = entries.length > 1 ? entries[1][0] : fg;
        if (bg === fg) bg = (fg + 1) & 15;

        let byte = 0;
        for (let px = 0; px < 8; px++) {
          const pi = at(by * 8 + row, bx * 8 + px);
          const dFG = rgbDist(r.palette[pi], r.palette[fg]);
          const dBG = rgbDist(r.palette[pi], r.palette[bg]);
          if (dFG <= dBG) byte |= 0x80 >> px;
        }
        block[row] = byte;
        colorTable[by * 256 + bx * 8 + row] = (fg << 4) | bg;
      }

      const key = block.join(',');
      let pi = pIndex.get(key);
      if (pi === undefined) {
        if (patterns.length >= 256) {
          overflow = true;
          pi = patterns.length - 1;
        } else {
          pi = patterns.length;
          pIndex.set(key, pi);
          patterns.push(block);
        }
      }
      nameTable[by * 32 + bx] = pi;
    }
  }

  const patGen = new Uint8Array(2048);
  patterns.forEach((p, i) => patGen.set(p, i * 8));

  const vram = new Uint8Array(0x3800);
  vram.set(patGen, 0x0000);
  vram.set(nameTable, 0x1800);
  vram.set(colorTable, 0x2000);

  downloadBytes(bsave(vram, 0x0000, 0x0000), 'pixelforge.sc2');
  if (!msx1) downloadBytes(msxPaletteBytes(r.palette), 'pixelforge.pal');
  if (overflow) console.warn('SCREEN 2: meer dan 256 unieke patronen');
}
