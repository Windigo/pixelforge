import type { RGB, Selection, Tile } from './types';

/** Stable string id for a tile's pixel data (used for de-duplication). */
export function tileId(bytes: Uint8Array): string {
  let h = 0;
  for (let i = 0; i < bytes.length; i++) h = (h * 31 + bytes[i]) >>> 0;
  return `${bytes.length}:${h.toString(36)}`;
}

/** Extract the unique RGBA tiles from a source canvas (size×size grid). */
export function extractUniqueSourceTiles(source: HTMLCanvasElement, size: number): Tile[] {
  const ctx = source.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  const data = ctx.getImageData(0, 0, source.width, source.height).data;
  const cols = Math.ceil(source.width / size);
  const rows = Math.ceil(source.height / size);
  const tiles: Tile[] = [];
  const seen = new Set<string>();
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const rgba = new Uint8Array(size * size * 4);
      for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
          const x = tx * size + px;
          const y = ty * size + py;
          const o = (py * size + px) * 4;
          if (x < source.width && y < source.height) {
            const si = (y * source.width + x) * 4;
            rgba[o] = data[si];
            rgba[o + 1] = data[si + 1];
            rgba[o + 2] = data[si + 2];
            rgba[o + 3] = data[si + 3];
          }
        }
      }
      const id = tileId(rgba);
      if (!seen.has(id)) {
        seen.add(id);
        tiles.push({ size, id, rgba });
      }
    }
  }
  return tiles;
}

/** Read an indexed tile from the result and convert it to RGBA via the palette. */
export function readTileRgb(indexed: Uint8Array, w: number, h: number, palette: RGB[], tx: number, ty: number, size: number): Tile {
  const rgba = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = tx * size + px;
      const y = ty * size + py;
      const o = (py * size + px) * 4;
      if (x < w && y < h) {
        const idx = indexed[y * w + x];
        if (idx !== 0) {
          const c = palette[idx] ?? [0, 0, 0];
          rgba[o] = c[0];
          rgba[o + 1] = c[1];
          rgba[o + 2] = c[2];
          rgba[o + 3] = 255;
        }
      }
    }
  }
  return { size, id: tileId(rgba), rgba };
}

/** Snap a pixel coordinate down to the nearest tile boundary. */
export function snapToTile(n: number, size: number): number {
  return Math.floor(n / size) * size;
}

/** Build a tile-aligned selection from a drag (x0,y0)→(x1,y1), clamped to the image. */
export function tileSelectionFromDrag(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  size: number,
  w: number,
  h: number,
): Selection {
  const left = Math.max(0, snapToTile(Math.min(x0, x1), size));
  const top = Math.max(0, snapToTile(Math.min(y0, y1), size));
  const right = Math.min(w, snapToTile(Math.max(x0, x1), size) + size);
  const bottom = Math.min(h, snapToTile(Math.max(y0, y1), size) + size);
  return { x: left, y: top, w: Math.max(size, right - left), h: Math.max(size, bottom - top) };
}

/** Copy a tile-aligned region of the indexed image into a new buffer. */
export function copyRegion(indexed: Uint8Array, w: number, s: Selection): Uint8Array {
  const buf = new Uint8Array(s.w * s.h);
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) buf[y * s.w + x] = indexed[(s.y + y) * w + (s.x + x)];
  return buf;
}
