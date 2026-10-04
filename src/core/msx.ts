import type { RGB } from './types';

/**
 * Fixed TMS9918 palette (MSX1 SCREEN 2). Index 0 = transparent/black.
 */
export const MSX1_PALETTE: RGB[] = [
  [0, 0, 0],
  [0, 0, 0],
  [33, 200, 66],
  [94, 220, 120],
  [84, 85, 237],
  [125, 118, 252],
  [212, 82, 77],
  [66, 235, 245],
  [252, 85, 84],
  [255, 121, 120],
  [212, 193, 84],
  [230, 206, 128],
  [33, 176, 59],
  [201, 91, 186],
  [204, 204, 204],
  [255, 255, 255],
];

/**
 * MSX2 VDP palette format: 16 × 2 bytes (3-bit RGB).
 */
export function msxPaletteBytes(palette: RGB[]): Uint8Array {
  const out = new Uint8Array(32);
  for (let i = 0; i < 16; i++) {
    const c = palette[i] ?? [0, 0, 0];
    const r = c[0] >> 5;
    const g = c[1] >> 5;
    const b = c[2] >> 5;
    // VDP palette bytes are (R * 16 + B, G): red occupies the high nibble,
    // blue the low nibble.
    out[i * 2] = ((r & 7) << 4) | (b & 7);
    out[i * 2 + 1] = g & 7;
  }
  return out;
}
