import { MSX1_PALETTE } from '../core/msx';
import type { RGB } from '../core/types';

export type SourceFormat = 'png' | 'iff' | 'sc5' | 'sc2';

export const FORMAT_LABELS: Record<SourceFormat, string> = {
  png: 'PNG',
  iff: 'IFF',
  sc5: 'SCREEN 5',
  sc2: 'SCREEN 2',
};

export async function detectFormat(file: File): Promise<SourceFormat> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.ilbm') || name.endsWith('.iff') || name.endsWith('.lbm')) return 'iff';
  if (name.endsWith('.sc5')) return 'sc5';
  if (name.endsWith('.sc2')) return 'sc2';
  if (name.endsWith('.png')) return 'png';
  const buf = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf[0] === 0x46 && buf[1] === 0x4f && buf[2] === 0x52 && buf[3] === 0x4d) return 'iff'; // FORM
  if (buf[0] === 0xfe) return file.size > 20000 ? 'sc5' : 'sc2'; // BSAVE header
  return 'png';
}

function canvasFromIndexed(
  indexed: Uint8Array,
  palette: RGB[],
  w: number,
  h: number,
  transparentZero: boolean,
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < indexed.length; i++) {
    const idx = indexed[i];
    const col = palette[idx] ?? [0, 0, 0];
    const o = i * 4;
    if (transparentZero && idx === 0) {
      img.data[o + 3] = 0;
    } else {
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Decode een niet-PNG bron (IFF/SC5/SC2) naar een canvas. */
export function decodeImage(bytes: Uint8Array, format: SourceFormat): HTMLCanvasElement {
  if (format === 'iff') return decodeIlbm(bytes);
  if (format === 'sc5') return decodeSc5(bytes);
  return decodeSc2(bytes);
}

function decodeIlbm(bytes: Uint8Array): HTMLCanvasElement {
  let w = 0;
  let h = 0;
  let planes = 1;
  let masking = 0;
  let compression = 0;
  let palette: RGB[] = [];
  let body: Uint8Array | null = null;
  let p = 12; // skip FORM + size + ILBM
  while (p + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]);
    const size = (bytes[p + 4] << 24) | (bytes[p + 5] << 16) | (bytes[p + 6] << 8) | bytes[p + 7];
    const d = p + 8;
    if (id === 'BMHD') {
      w = (bytes[d] << 8) | bytes[d + 1];
      h = (bytes[d + 2] << 8) | bytes[d + 3];
      planes = bytes[d + 8];
      masking = bytes[d + 9];
      compression = bytes[d + 10];
    } else if (id === 'CMAP') {
      palette = [];
      for (let i = 0; i < size / 3; i++) palette.push([bytes[d + i * 3], bytes[d + i * 3 + 1], bytes[d + i * 3 + 2]]);
    } else if (id === 'BODY') {
      body = bytes.slice(d, d + size);
    }
    p = d + size + (size & 1); // chunk padding
  }
  if (!body || w <= 0 || h <= 0 || palette.length === 0) throw new Error('Unsupported or invalid ILBM.');

  const rowBytes = Math.ceil(w / 16) * 2;
  const indexed = new Uint8Array(w * h);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    for (let plane = 0; plane < planes; plane++) {
      const row = new Uint8Array(rowBytes);
      if (compression === 1) {
        let i = 0;
        while (i < rowBytes) {
          const c = body[pos++];
          if (c === 128) continue;
          if (c > 128) {
            const n = 257 - c;
            const v = body[pos++];
            for (let k = 0; k < n && i < rowBytes; k++) row[i++] = v;
          } else {
            const n = c + 1;
            for (let k = 0; k < n && i < rowBytes; k++) row[i++] = body[pos++];
          }
        }
      } else {
        row.set(body.subarray(pos, pos + rowBytes));
        pos += rowBytes;
      }
      for (let bx = 0; bx < rowBytes; bx++) {
        const val = row[bx];
        for (let bit = 0; bit < 8; bit++) {
          const x = bx * 8 + bit;
          if (x >= w) continue;
          if (val & (1 << (7 - bit))) indexed[y * w + x] |= 1 << plane;
        }
      }
    }
    if (masking === 1) {
      // sla de mask-plane over
      if (compression === 1) {
        let i = 0;
        while (i < rowBytes) {
          const c = body[pos++];
          if (c === 128) continue;
          if (c > 128) { pos++; i += 257 - c; }
          else { pos += c + 1; i += c + 1; }
        }
      } else {
        pos += rowBytes;
      }
    }
  }
  return canvasFromIndexed(indexed, palette, w, h, masking === 1);
}

function decodeSc5(bytes: Uint8Array): HTMLCanvasElement {
  const W = 256;
  const H = 212;
  const data = bytes[0] === 0xfe ? bytes.slice(7) : bytes;
  const indexed = new Uint8Array(W * H);
  for (let i = 0; i < (W * H) / 2 && i < data.length; i++) {
    indexed[i * 2] = data[i] >> 4;
    indexed[i * 2 + 1] = data[i] & 15;
  }
  return canvasFromIndexed(indexed, MSX1_PALETTE, W, H, true);
}

function decodeSc2(bytes: Uint8Array): HTMLCanvasElement {
  const W = 256;
  const H = 192;
  const data = bytes[0] === 0xfe ? bytes.slice(7) : bytes;
  const indexed = new Uint8Array(W * H);
  for (let by = 0; by < 24; by++) {
    for (let bx = 0; bx < 32; bx++) {
      const name = data[0x1800 + by * 32 + bx];
      for (let row = 0; row < 8; row++) {
        const pattern = data[name * 8 + row];
        const ce = data[0x2000 + by * 256 + bx * 8 + row];
        const fg = ce >> 4;
        const bg = ce & 15;
        for (let px = 0; px < 8; px++) {
          indexed[(by * 8 + row) * W + bx * 8 + px] = pattern & (0x80 >> px) ? fg : bg;
        }
      }
    }
  }
  return canvasFromIndexed(indexed, MSX1_PALETTE, W, H, true);
}
