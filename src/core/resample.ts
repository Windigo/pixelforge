import { rgbKey } from './color';
import type { Sampling } from './types';

type Acc = [number, number, number, number];

export function resampleTo(
  source: HTMLCanvasElement,
  w: number,
  h: number,
  sampling: Sampling,
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;

  if (sampling === 'center') {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, w, h);
    return c;
  }

  const src = source
    .getContext('2d', { willReadFrequently: true })!
    .getImageData(0, 0, source.width, source.height).data;
  const dst = ctx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * source.width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * source.width) / w));
      const y0 = Math.floor((y * source.height) / h);
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * source.height) / h));
      const m = new Map<number, Acc>();

      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * source.width + sx) * 4;
          const k = rgbKey(src[i], src[i + 1], src[i + 2]);
          const q = m.get(k) ?? ([0, 0, 0, 0] as Acc);
          q[0] += src[i];
          q[1] += src[i + 1];
          q[2] += src[i + 2];
          q[3]++;
          m.set(k, q);
        }
      }

      let winner: Acc = [0, 0, 0, 0];
      for (const q of m.values()) if (q[3] > winner[3]) winner = q;

      const i = (y * w + x) * 4;
      dst.data[i] = winner[3] ? winner[0] / winner[3] : 0;
      dst.data[i + 1] = winner[3] ? winner[1] / winner[3] : 0;
      dst.data[i + 2] = winner[3] ? winner[2] / winner[3] : 0;
      dst.data[i + 3] = winner[3] ? 255 : 0;
    }
  }

  ctx.putImageData(dst, 0, 0);
  return c;
}
