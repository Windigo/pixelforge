import type { RGB } from './types';

/**
 * Nintendo Entertainment System (NES / Famicom) ondersteuning.
 *
 * De NES toont een 256×240 beeld (NTSC "game mode"). De achtergrond is 2 bits
 * per pixel: elke 16×16-pixel regio (een "attribute area" van 2×2 tiles van
 * 8×8) kiest één van 4 paletten. Elk palet heeft 4 kleuren, waarvan kleur 0
 * de universele achtergrondkleur is die over alle paletten gedeeld wordt.
 * Effectief dus maximaal 13 unieke kleuren (1 achtergrond + 4×3).
 *
 * Het kleurenpalet is de vaste 2C02 master-palette (64 entries, 2 bits per
 * kanaal). Vele entries zijn duplicaten van zwart/wit.
 */

export const NES_W = 256;
export const NES_H = 240;

/** Vast 2C02 master-palet (64 entries). Index 0 = grijs ($656565). */
export const NES_PALETTE: RGB[] = [
  [102, 102, 102], [0, 42, 136], [20, 18, 167], [59, 0, 164],
  [92, 0, 126], [110, 0, 64], [108, 6, 0], [86, 29, 0],
  [51, 53, 0], [11, 72, 0], [0, 82, 0], [0, 79, 8],
  [0, 64, 77], [0, 0, 0], [0, 0, 0], [0, 0, 0],
  [173, 173, 173], [21, 95, 217], [66, 64, 255], [117, 39, 254],
  [160, 26, 204], [183, 30, 123], [181, 49, 32], [153, 78, 0],
  [107, 109, 0], [56, 135, 0], [12, 147, 0], [0, 143, 50],
  [0, 124, 141], [0, 0, 0], [0, 0, 0], [0, 0, 0],
  [254, 254, 254], [100, 176, 255], [146, 144, 255], [198, 118, 255],
  [243, 106, 255], [254, 110, 204], [254, 129, 112], [234, 158, 34],
  [188, 175, 0], [139, 217, 40], [55, 246, 43], [47, 245, 158],
  [41, 240, 253], [63, 63, 63], [0, 0, 0], [0, 0, 0],
  [254, 254, 254], [192, 223, 255], [211, 210, 255], [232, 200, 255],
  [251, 194, 255], [254, 196, 234], [254, 204, 197], [247, 216, 165],
  [237, 229, 165], [212, 251, 169], [176, 251, 206], [170, 251, 246],
  [184, 184, 184], [0, 0, 0], [0, 0, 0], [0, 0, 0],
];

/** Universele achtergrondkleur: zwart ($0F). Index 0 is gereserveerd voor transparant. */
const NES_BG = 0x0f;

export interface NesResult {
  /** 4 paletten × 4 kleuren (NES kleurindices 0–63); kolom 0 = universele achtergrond. */
  palettes: number[][];
  /** Universele achtergrondkleur (NES kleurindex). */
  bg: number;
  /** CHR pattern table 0: 256 tiles × 16 bytes (2bpp). */
  patterns: Uint8Array;
  /** Nametable: 32×30 tiles (960 bytes, pattern indices). */
  nameTable: Uint8Array;
  /** Attribute table (64 bytes). */
  attributeTable: Uint8Array;
  /** 256×240 gedecodeerde NES-kleurindices (voor preview). */
  indexed: Uint8Array;
}

/** Kwadratische RGB-afstand tussen twee NES-kleuren. */
function distSq(a: number, b: number): number {
  const ca = NES_PALETTE[a];
  const cb = NES_PALETTE[b];
  const dr = ca[0] - cb[0];
  const dg = ca[1] - cb[1];
  const db = ca[2] - cb[2];
  return dr * dr + dg * dg + db * db;
}

function popcount(v: number): number {
  let n = v;
  n -= (n >> 1) & 0x55;
  n = (n & 0x33) + ((n >> 2) & 0x33);
  return (n + (n >> 4)) & 0x0f;
}

/**
 * Quantiseert een geïndexeerd beeld (indices 0–63 in het NES-palet) naar de
 * echte NES-achtergrondweergave: 4 paletten van 4 kleuren (gedeelde kleur 0),
 * 2 bits per pixel en één palet per 16×16-attributeregio. Index 0 wordt als
 * transparant beschouwd en wordt de universele achtergrondkleur; kleinere
 * beelden worden linksboven opgevuld, grotere linksboven afgesneden.
 */
export function quantizeNes(indexed: Uint8Array, width: number, height: number): NesResult {
  const W = NES_W;
  const H = NES_H;
  const bg = NES_BG;

  const at = (y: number, x: number): number => {
    if (y < 0 || y >= height || x < 0 || x >= width) return bg;
    const i = indexed[y * width + x];
    return i === 0 ? bg : i;
  };

  // 16×16 attributeregio's: 16 breed × 15 hoog (240 zichtbaar).
  const AW = 16;
  const AH = 15;

  // Histogrammen per regio + globaal gebruik.
  const areaUsage = new Uint16Array(AW * AH * 64);
  const globalUsage = new Uint32Array(64);
  for (let ay = 0; ay < AH; ay++) {
    for (let ax = 0; ax < AW; ax++) {
      const base = (ay * AW + ax) * 64;
      for (let yy = 0; yy < 16; yy++) {
        for (let xx = 0; xx < 16; xx++) {
          const c = at(ay * 16 + yy, ax * 16 + xx);
          areaUsage[base + c]++;
          globalUsage[c]++;
        }
      }
    }
  }

  // Afstandsmatrix tussen NES-kleuren.
  const distances = Array.from({ length: 64 }, (_, a) =>
    Uint32Array.from({ length: 64 }, (_, b) => distSq(a, b)),
  );

  // Beginkleuren: meest gebruikte kleuren, ontdaan van duplicaten, zwart en
  // transparant (index 0) zodat die rol eenduidig blijft.
  const uniqueOrder: number[] = [];
  const seen = new Set<string>();
  const candidates = Array.from({ length: 64 }, (_, i) => i)
    .filter((i) => i !== bg && i !== 0 && globalUsage[i] > 0)
    .sort((a, b) => globalUsage[b] - globalUsage[a]);
  for (const i of candidates) {
    if (distances[i][bg] === 0) continue; // duplicaat van de achtergrond
    const c = NES_PALETTE[i];
    const key = `${c[0]},${c[1]},${c[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueOrder.push(i);
  }

  // 12 kleuren-slots: 4 paletten × 3 kleuren.
  const palettes: number[][] = [[], [], [], []];
  for (let i = 0; i < 12; i++) {
    palettes[Math.floor(i / 3)].push(uniqueOrder[i] ?? bg);
  }

  const bestForArea = (areaIdx: number, pals: number[][]): { p: number; error: number } => {
    let bestP = 0;
    let bestE = Infinity;
    for (let p = 0; p < 4; p++) {
      const colors = [bg, pals[p][0], pals[p][1], pals[p][2]];
      let e = 0;
      const base = areaIdx * 64;
      for (let c = 0; c < 64; c++) {
        const cnt = areaUsage[base + c];
        if (!cnt) continue;
        const d = distances[c];
        e += cnt * Math.min(d[colors[0]], d[colors[1]], d[colors[2]], d[colors[3]]);
      }
      if (e < bestE) {
        bestE = e;
        bestP = p;
      }
    }
    return { p: bestP, error: bestE };
  };

  const globalError = (pals: number[][]): number => {
    let e = 0;
    for (let a = 0; a < AW * AH; a++) e += bestForArea(a, pals).error;
    return e;
  };

  // Verbeter de 12 kleuren via coordinate descent (2 passes).
  for (let pass = 0; pass < 2; pass++) {
    let changed = false;
    for (let slot = 0; slot < 12; slot++) {
      const p = Math.floor(slot / 3);
      const k = slot % 3;
      let bestColor = palettes[p][k];
      let bestError = globalError(palettes);
      for (let c = 0; c < 64; c++) {
        if (c === 0) continue;
        if (distances[c][bg] === 0) continue;
        let dup = false;
        for (let pi = 0; pi < 4 && !dup; pi++) {
          for (let ki = 0; ki < 3 && !dup; ki++) {
            if (pi === p && ki === k) continue;
            if (distances[c][palettes[pi][ki]] === 0) dup = true;
          }
        }
        if (dup) continue;
        const prev = palettes[p][k];
        palettes[p][k] = c;
        const e = globalError(palettes);
        palettes[p][k] = prev;
        if (e < bestError) {
          bestError = e;
          bestColor = c;
        }
      }
      if (palettes[p][k] !== bestColor) {
        palettes[p][k] = bestColor;
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Bepaal per regio het beste palet.
  const areaPalette = new Uint8Array(AW * AH);
  for (let a = 0; a < AW * AH; a++) areaPalette[a] = bestForArea(a, palettes).p;

  // Bouw tiles (8×8), dedupe naar de pattern table (max 256).
  const patterns: Uint8Array[] = [new Uint8Array(16)]; // tile 0 = leeg
  const patternIndex = new Map<string, number>();
  const nameTable = new Uint8Array(960);
  const out = new Uint8Array(W * H);
  let overflow = false;

  for (let ty = 0; ty < 30; ty++) {
    for (let tx = 0; tx < 32; tx++) {
      const ax = tx >> 1;
      const ay = ty >> 1;
      const p = areaPalette[ay * AW + ax];
      const colors = [bg, palettes[p][0], palettes[p][1], palettes[p][2]];
      const tile = new Uint8Array(16);
      for (let yy = 0; yy < 8; yy++) {
        let p0 = 0;
        let p1 = 0;
        for (let xx = 0; xx < 8; xx++) {
          const x = tx * 8 + xx;
          const y = ty * 8 + yy;
          const c = at(y, x);
          let b = 0;
          let bd = Infinity;
          const d = distances[c];
          for (let k = 0; k < 4; k++) {
            const dist = d[colors[k]];
            if (dist < bd) {
              bd = dist;
              b = k;
            }
          }
          out[y * W + x] = colors[b];
          if (b & 1) p0 |= 0x80 >> xx;
          if (b & 2) p1 |= 0x80 >> xx;
        }
        tile[yy * 2] = p0;
        tile[yy * 2 + 1] = p1;
      }

      const key = String.fromCharCode(...tile);
      let pi = patternIndex.get(key);
      if (pi === undefined) {
        if (patterns.length >= 256) {
          overflow = true;
          let nearest = 1;
          let nearestErr = Infinity;
          for (let cand = 1; cand < patterns.length; cand++) {
            const cp = patterns[cand];
            let err = 0;
            for (let i = 0; i < 16; i++) err += popcount(tile[i] ^ cp[i]);
            if (err < nearestErr) {
              nearestErr = err;
              nearest = cand;
            }
          }
          pi = nearest;
        } else {
          pi = patterns.length;
          patterns.push(tile);
          patternIndex.set(key, pi);
        }
      }
      nameTable[ty * 32 + tx] = pi;
    }
  }

  // Vul de pattern table tot 256 tiles.
  const chrPatterns = new Uint8Array(4096);
  for (let i = 0; i < patterns.length; i++) chrPatterns.set(patterns[i], i * 16);

  // Attribute table: 2 bits per 16×16-regio.
  const attributeTable = new Uint8Array(64);
  for (let ay = 0; ay < AH; ay++) {
    for (let ax = 0; ax < AW; ax++) {
      const p = areaPalette[ay * AW + ax];
      const byteCol = ax >> 1;
      const byteRow = ay >> 1;
      const quadrant = (ay & 1) * 2 + (ax & 1);
      attributeTable[byteRow * 8 + byteCol] |= p << (quadrant * 2);
    }
  }

  if (overflow) console.warn('NES: meer dan 256 unieke tiles');

  const fullPalettes: number[][] = palettes.map((p) => [bg, p[0], p[1], p[2]]);
  return {
    palettes: fullPalettes,
    bg,
    patterns: chrPatterns,
    nameTable,
    attributeTable,
    indexed: out,
  };
}