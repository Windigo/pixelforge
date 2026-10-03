import { nearest, quantize } from './color';
import { MSX1_PALETTE } from './msx';
import { resampleTo } from './resample';
import type { RGB, Sampling, Target } from './types';

export interface ConvertOptions {
  target: Target;
  msx1: boolean;
  planes: number;
  colors: number;
  merge: number;
  dither: boolean;
  resample: boolean;
  scale: number;
  sampling: Sampling;
  pinned: RGB[];
  widthInput?: string;
  heightInput?: string;
}

export interface ConvertResult {
  preview: HTMLCanvasElement;
  indexed: Uint8Array;
  palette: RGB[];
  width: number;
  height: number;
}

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

function targetMaxColors(o: ConvertOptions): number {
  if (o.target === 'amiga') return 1 << o.planes;
  if (o.target === 'png') return o.colors;
  return 16;
}

function targetDims(o: ConvertOptions): { w: number; h: number } | null {
  if (o.target === 'sc5') return { w: 256, h: 212 };
  if (o.target === 'sc2') return { w: 256, h: 192 };
  return null;
}

function scaledDims(
  source: HTMLCanvasElement,
  o: ConvertOptions,
): { w: number; h: number } | null {
  if (!o.resample) return null;
  const w = Number(o.widthInput) || Math.max(1, Math.round((source.width * o.scale) / 100));
  const h = Number(o.heightInput) || Math.max(1, Math.round((source.height * o.scale) / 100));
  return { w: clamp(w, 1, 8192), h: clamp(h, 1, 8192) };
}

function makeWork(
  source: HTMLCanvasElement,
  o: ConvertOptions,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const td = targetDims(o);
  if (td) {
    // Vaste MSX-resolutie: schaal de bron eerst (optioneel), daarna naar de vaste maat.
    const pre = scaledDims(source, o);
    const src = pre ? resampleTo(source, pre.w, pre.h, o.sampling) : source;
    return { canvas: resampleTo(src, td.w, td.h, o.sampling), width: td.w, height: td.h };
  }
  const pre = scaledDims(source, o);
  if (!pre) return { canvas: source, width: source.width, height: source.height };
  return { canvas: resampleTo(source, pre.w, pre.h, o.sampling), width: pre.w, height: pre.h };
}

export function convert(source: HTMLCanvasElement, o: ConvertOptions): ConvertResult {
  const work = makeWork(source, o);
  const ctx = work.canvas.getContext('2d', { willReadFrequently: true })!;
  const src = ctx.getImageData(0, 0, work.width, work.height);

  const palette =
    o.target === 'sc2' && o.msx1
      ? MSX1_PALETTE.map((c) => [...c] as RGB)
      : quantize(src.data, targetMaxColors(o), o.merge, o.pinned);

  const indexed = new Uint8Array(work.width * work.height);
  const dst = ctx.createImageData(work.width, work.height);
  const floats = Float32Array.from(src.data);

  for (let y = 0; y < work.height; y++) {
    for (let x = 0; x < work.width; x++) {
      const i = (y * work.width + x) * 4;
      if (src.data[i + 3] < 8) {
        dst.data[i + 3] = 0;
        continue;
      }
      const n = nearest(floats[i], floats[i + 1], floats[i + 2], palette);
      const c = palette[n];
      indexed[y * work.width + x] = n;
      dst.data[i] = c[0];
      dst.data[i + 1] = c[1];
      dst.data[i + 2] = c[2];
      dst.data[i + 3] = src.data[i + 3];

      if (o.dither) {
        const er = floats[i] - c[0];
        const eg = floats[i + 1] - c[1];
        const eb = floats[i + 2] - c[2];
        for (const [dx, dy, k] of [
          [1, 0, 7 / 16],
          [-1, 1, 3 / 16],
          [0, 1, 5 / 16],
          [1, 1, 1 / 16],
        ] as const) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && xx < work.width && yy < work.height) {
            const j = (yy * work.width + xx) * 4;
            floats[j] += er * k;
            floats[j + 1] += eg * k;
            floats[j + 2] += eb * k;
          }
        }
      }
    }
  }

  const preview = document.createElement('canvas');
  preview.width = work.width;
  preview.height = work.height;
  preview.getContext('2d')!.putImageData(dst, 0, 0);

  return { preview, indexed, palette, width: work.width, height: work.height };
}
