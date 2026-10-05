import type { RGB } from './types';

/**
 * Vast 16-kleurenpalet van de C64 (VIC-II). Index 0 = zwart.
 * Waarden zijn een redelijke benadering (VICE-palet).
 */
export const C64_PALETTE: RGB[] = [
  [0, 0, 0], // 0  Black
  [255, 255, 255], // 1  White
  [136, 0, 0], // 2  Red
  [170, 255, 238], // 3  Cyan
  [204, 68, 204], // 4  Purple
  [0, 204, 85], // 5  Green
  [0, 0, 170], // 6  Blue
  [238, 238, 119], // 7  Yellow
  [221, 136, 85], // 8  Orange
  [102, 68, 0], // 9  Brown
  [255, 119, 119], // 10 Light Red
  [51, 51, 51], // 11 Dark Grey
  [119, 119, 119], // 12 Grey
  [170, 255, 102], // 13 Light Green
  [0, 136, 255], // 14 Light Blue
  [187, 187, 187], // 15 Light Grey
];

export const C64_W = 160;
export const C64_H = 200;

export interface C64Multicolor {
  bitmap: Uint8Array; // 8000 bytes (2 bpp, 4 px/byte)
  screenRam: Uint8Array; // 1000 bytes (gedeelde kleur 1 in high-nibble)
  colorRam: Uint8Array; // 1000 bytes (gedeelde kleur 2 high-nibble, celkleur low-nibble)
  background: number; // 0-15
  indexed: Uint8Array; // 160×200 gedecodeerd (voor preview)
}

/**
 * Quantiseert een geïndexeerd beeld (indices 0–15 in het C64-palet) naar de
 * multicolor-bitmap-mode: 3 globale kleuren (achtergrond + 2 gedeelde) + 1
 * lokale kleur per 8×8-cel (= 4×8 multicolor-pixels). Kleinere beelden worden
 * gecentreerd opgevuld met index 0; grotere beelden worden gecentreerd afgesneden.
 */
export function quantizeC64Multicolor(indexed: Uint8Array, width: number, height: number): C64Multicolor {
  const W = C64_W;
  const H = C64_H;
  const offsetX = Math.floor((W - width) / 2);
  const offsetY = Math.floor((H - height) / 2);
  const at = (y: number, x: number): number => {
    const sx = x - offsetX;
    const sy = y - offsetY;
    return sx >= 0 && sx < width && sy >= 0 && sy < height ? indexed[sy * width + sx] : 0;
  };

  // 1. Count image colors and build a histogram for each 8x8 character cell.
  const usage = new Uint32Array(16);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) usage[at(y, x)]++;

  const cellUsages = new Uint8Array(40 * 25 * 16);
  for (let cy = 0; cy < 25; cy++) {
    for (let cx = 0; cx < 40; cx++) {
      const base = (cy * 40 + cx) * 16;
      for (let yy = 0; yy < 8; yy++) {
        for (let xx = 0; xx < 4; xx++) cellUsages[base + at(cy * 8 + yy, cx * 4 + xx)]++;
      }
    }
  }

  const dist = (a: number, b: number): number => {
    const ca = C64_PALETTE[a];
    const cb = C64_PALETTE[b];
    const dr = ca[0] - cb[0];
    const dg = ca[1] - cb[1];
    const db = ca[2] - cb[2];
    return dr * dr + dg * dg + db * db;
  };

  const distances = Array.from({ length: 16 }, (_, a) =>
    Uint32Array.from({ length: 16 }, (_, b) => dist(a, b)),
  );
  const initial = Array.from({ length: 16 }, (_, i) => i).sort((a, b) => usage[b] - usage[a]);
  // Keep the most frequent source color as VIC background. The optimizer may
  // improve the two shared colors, but must not turn transparent/black canvas
  // pixels into a different background color.
  const globals = initial.slice(0, 3);

  const bestLocal = (histogramOffset: number, shared: number[]): { color: number; error: number } => {
    let chosen = -1;
    let bestError = Infinity;
    for (let local = 0; local < 16; local++) {
      if (shared.includes(local)) continue;
      let error = 0;
      for (let color = 0; color < 16; color++) {
        const count = cellUsages[histogramOffset + color];
        if (!count) continue;
        const d = distances[color];
        error += count * Math.min(d[shared[0]], d[shared[1]], d[shared[2]], d[local]);
      }
      if (error < bestError) {
        bestError = error;
        chosen = local;
      }
    }
    return { color: chosen, error: bestError };
  };

  const globalError = (shared: number[]): number => {
    let error = 0;
    for (let cell = 0; cell < 40 * 25; cell++) {
      error += bestLocal(cell * 16, shared).error;
    }
    return error;
  };

  // Improve the three shared colors against total per-cell RGB error instead
  // of selecting them only by frequency. Keep each role distinct.
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let slot = 1; slot < 3; slot++) {
      let bestColor = globals[slot];
      let bestError = globalError(globals);
      for (let candidate = 0; candidate < 16; candidate++) {
        if (globals.some((color, i) => i !== slot && color === candidate)) continue;
        const previous = globals[slot];
        globals[slot] = candidate;
        const error = globalError(globals);
        globals[slot] = previous;
        if (error < bestError) {
          bestError = error;
          bestColor = candidate;
        }
      }
      if (globals[slot] !== bestColor) {
        globals[slot] = bestColor;
        changed = true;
      }
    }
    if (!changed) break;
  }

  const [background, shared1, shared2] = globals;

  const bitmap = new Uint8Array(8000);
  const screenRam = new Uint8Array(1000);
  const colorRam = new Uint8Array(1000);
  const out = new Uint8Array(W * H);

  // 3. Per 8×8-cel (4×8 multicolor-pixels).
  for (let cy = 0; cy < 25; cy++) {
    for (let cx = 0; cx < 40; cx++) {
      const cellColor = bestLocal((cy * 40 + cx) * 16, globals).color;
      const colors = [background, shared1, shared2, cellColor];

      for (let yy = 0; yy < 8; yy++) {
        const y = cy * 8 + yy;
        let byte = 0;
        for (let xx = 0; xx < 4; xx++) {
          const x = cx * 4 + xx;
          const px = at(y, x);
          let b = 0;
          let bd = Infinity;
          for (let k = 0; k < 4; k++) {
            const d = dist(px, colors[k]);
            if (d < bd) {
              bd = d;
              b = k;
            }
          }
          out[y * W + x] = colors[b];
          byte |= b << (6 - xx * 2);
        }
        // VIC-II stores each 8x8 character cell as eight consecutive bytes.
        // Each character row is 40 cells (320 bytes); yy selects the scanline
        // inside the cell and cx selects its horizontal cell position.
        bitmap[cy * 320 + cx * 8 + yy] = byte;
      }

      // In bitmap multicolor mode, screen RAM holds both shared colors;
      // color RAM contributes the cell's fourth color in its low nibble.
      screenRam[cy * 40 + cx] = (shared1 << 4) | shared2;
      colorRam[cy * 40 + cx] = cellColor;
    }
  }

  return { bitmap, screenRam, colorRam, background, indexed: out };
}
