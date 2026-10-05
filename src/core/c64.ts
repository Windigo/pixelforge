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
 * opgevuld met index 0, grotere worden linksboven afgesneden.
 */
export function quantizeC64Multicolor(indexed: Uint8Array, width: number, height: number): C64Multicolor {
  const W = C64_W;
  const H = C64_H;
  const at = (y: number, x: number): number => (y < height && x < width ? indexed[y * width + x] : 0);

  // 1. Gebruik per kleur over het hele beeld.
  const usage = new Uint32Array(16);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) usage[at(y, x)]++;

  // 2. De 3 globale kleuren = de 3 meest gebruikte.
  const order = Array.from({ length: 16 }, (_, i) => i).sort((a, b) => usage[b] - usage[a]);
  const background = order[0];
  const shared1 = order[1];
  const shared2 = order[2];

  const dist = (a: number, b: number): number => {
    const ca = C64_PALETTE[a];
    const cb = C64_PALETTE[b];
    const dr = ca[0] - cb[0];
    const dg = ca[1] - cb[1];
    const db = ca[2] - cb[2];
    return dr * dr + dg * dg + db * db;
  };

  const bitmap = new Uint8Array(8000);
  const screenRam = new Uint8Array(1000);
  const colorRam = new Uint8Array(1000);
  const out = new Uint8Array(W * H);

  // 3. Per 8×8-cel (4×8 multicolor-pixels).
  for (let cy = 0; cy < 25; cy++) {
    for (let cx = 0; cx < 40; cx++) {
      const cellUsage = new Uint32Array(16);
      for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 4; xx++) cellUsage[at(cy * 8 + yy, cx * 4 + xx)]++;

      // Lokale 4e kleur = meest gebruikte in de cel (exclusief de 3 globale).
      let cellColor = background;
      let best = -1;
      for (let c = 0; c < 16; c++) {
        if (c === background || c === shared1 || c === shared2) continue;
        if (cellUsage[c] > best) {
          best = cellUsage[c];
          cellColor = c;
        }
      }
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
        bitmap[cy * 320 + yy * 40 + cx] = byte;
      }

      screenRam[cy * 40 + cx] = shared1 << 4;
      colorRam[cy * 40 + cx] = (shared2 << 4) | cellColor;
    }
  }

  return { bitmap, screenRam, colorRam, background, indexed: out };
}
