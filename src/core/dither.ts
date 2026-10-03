export type DitherPattern = 'checkerboard' | 'bayer' | 'horizontal' | 'diagonal';

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const CHECKERBOARD = [
  [0, 8],
  [12, 4],
];

/**
 * Geeft een dither-waarde (0–15) voor een pixel terug, afhankelijk van het patroon.
 * Bij een 'level' (0–16) wordt de pixel kleur A als `value < level`, anders kleur B.
 */
export function ditherValue(pattern: DitherPattern, px: number, py: number): number {
  switch (pattern) {
    case 'checkerboard':
      return CHECKERBOARD[py & 1][px & 1];
    case 'bayer':
      return BAYER[py & 3][px & 3];
    case 'horizontal':
      return (py & 1) * 8;
    case 'diagonal':
      return ((px + py) & 1) * 8;
  }
}
