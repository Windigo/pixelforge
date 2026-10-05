import { nearest, quantize, rgbDist } from './color';
import { MSX1_PALETTE } from './msx';
import { C64_PALETTE } from './c64';
import type { C64Multicolor } from './c64';
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
  c64?: C64Multicolor;
}

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

function targetMaxColors(o: ConvertOptions): number {
  if (o.target === 'amiga') return 1 << o.planes;
  if (o.target === 'png') return o.colors;
  return 16;
}

function scaledDims(
  source: HTMLCanvasElement,
  o: ConvertOptions,
): { w: number; h: number } | null {
  if (!o.resample) return null;
  const explicitW = Number(o.widthInput);
  const explicitH = Number(o.heightInput);
  // Gebruikersschaal (1 = 100%). Voor MSX-doelen wordt de afbeelding eerst
  // proportioneel verkleind tot het grootste formaat dat in het scherm past
  // (contain, alleen verkleinen — nooit vergroten). Daarna kan de SCALE-slider
  // hem nog verder verkleinen; de rest wordt in de exporter opgevuld.
  let scale = o.scale / 100;
  if (!explicitW && !explicitH) {
    if (o.target === 'sc5') scale *= Math.min(1, 256 / source.width, 212 / source.height);
    else if (o.target === 'sc2') scale *= Math.min(1, 256 / source.width, 192 / source.height);
    // C64 multicolor pixels are twice as wide as they are tall. Fit the image
    // inside the physical 320×200 display, then store half the physical width.
    else if (o.target === 'c64') scale *= Math.min(1, 320 / source.width, 200 / source.height);
  }
  const w = explicitW || Math.max(1, Math.round(source.width * scale / (o.target === 'c64' ? 2 : 1)));
  const h = explicitH || Math.max(1, Math.round(source.height * scale));
  return { w: clamp(w, 1, 8192), h: clamp(h, 1, 8192) };
}

function makeWork(
  source: HTMLCanvasElement,
  o: ConvertOptions,
): { canvas: HTMLCanvasElement; width: number; height: number } {
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
      : o.target === 'c64'
        ? C64_PALETTE.map((c) => [...c] as RGB)
        : ([
            [0, 0, 0] as RGB,
            ...quantize(src.data, targetMaxColors(o) - 1, o.merge, o.pinned),
          ] as RGB[]);

  // With the fixed MSX1 palette, merge nearby used hardware colors into the
  // most-used color in each group. This keeps output colors on the real TMS9918
  // palette while giving the merge slider a useful effect in SCREEN 2.
  let fixedColorMap: Uint8Array | null = null;
  if (o.target === 'sc2' && o.msx1 && o.merge > 0) {
    const usage = new Uint32Array(palette.length);
    for (let i = 0; i < src.data.length; i += 4) {
      if (src.data[i + 3] >= 128) usage[nearest(src.data[i], src.data[i + 1], src.data[i + 2], palette)]++;
    }
    const order = Array.from({ length: palette.length - 1 }, (_, i) => i + 1)
      .filter((index) => usage[index] > 0)
      .sort((a, b) => usage[b] - usage[a]);
    fixedColorMap = Uint8Array.from({ length: palette.length }, (_, index) => index);
    const representatives: number[] = [];
    const tolerance = o.merge * o.merge * 1.3;
    for (const index of order) {
      const representative = representatives.find((candidate) => rgbDist(palette[index], palette[candidate]) <= tolerance);
      if (representative === undefined) representatives.push(index);
      else fixedColorMap[index] = representative;
    }
  }

  const indexed = new Uint8Array(work.width * work.height);
  const dst = ctx.createImageData(work.width, work.height);
  const floats = Float32Array.from(src.data);

  for (let y = 0; y < work.height; y++) {
    for (let x = 0; x < work.width; x++) {
      const i = (y * work.width + x) * 4;
      if (src.data[i + 3] < 128) {
        dst.data[i + 3] = 0;
        continue;
      }
      const nearestIndex = nearest(floats[i], floats[i + 1], floats[i + 2], palette, o.target === 'c64' ? 0 : 1);
      const n = fixedColorMap?.[nearestIndex] ?? nearestIndex;
      const c = palette[n];
      indexed[y * work.width + x] = n;
      dst.data[i] = c[0];
      dst.data[i + 1] = c[1];
      dst.data[i + 2] = c[2];
      dst.data[i + 3] = 255;

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
