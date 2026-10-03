import type { RGB } from './types';

type Weighted = [number, number, number, number];

export function rgbKey(r: number, g: number, b: number): number {
  return ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
}

export function rgbDist(a: RGB, b: RGB): number {
  const r = a[0] - b[0];
  const g = a[1] - b[1];
  const q = a[2] - b[2];
  return r * r + g * g + q * q;
}

export function nearest(r: number, g: number, b: number, palette: RGB[]): number {
  let best = 1;
  let score = Infinity;
  for (let i = 1; i < palette.length; i++) {
    const c = palette[i];
    const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
    if (d < score) {
      score = d;
      best = i;
    }
  }
  return best;
}

export function quantize(
  data: Uint8ClampedArray,
  max: number,
  merge: number,
  pinned: RGB[],
): RGB[] {
  const counts = new Map<number, Weighted>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    const k = rgbKey(data[i], data[i + 1], data[i + 2]);
    const e = counts.get(k) ?? [0, 0, 0, 0];
    e[0] += data[i];
    e[1] += data[i + 1];
    e[2] += data[i + 2];
    e[3]++;
    counts.set(k, e);
  }

  let groups: Weighted[] = [...counts.values()]
    .map((e) => [Math.round(e[0] / e[3]), Math.round(e[1] / e[3]), Math.round(e[2] / e[3]), e[3]] as Weighted)
    .sort((a, b) => b[3] - a[3]);

  const tolerance = merge * merge * 1.3;
  if (tolerance) {
    const merged: Weighted[] = [];
    for (const g of groups) {
      const m = merged.find((x) => rgbDist([x[0], x[1], x[2]], [g[0], g[1], g[2]]) <= tolerance);
      if (m) {
        const n = m[3] + g[3];
        m[0] = (m[0] * m[3] + g[0] * g[3]) / n;
        m[1] = (m[1] * m[3] + g[1] * g[3]) / n;
        m[2] = (m[2] * m[3] + g[2] * g[3]) / n;
        m[3] = n;
      } else {
        merged.push(g);
      }
    }
    groups = merged.sort((a, b) => b[3] - a[3]);
  }

  const result: RGB[] = [];
  for (const p of pinned) {
    if (!result.some((c) => rgbDist(c, p) < 2)) result.push([...p] as RGB);
  }
  for (const g of groups) {
    if (result.length >= max) break;
    if (!result.some((c) => rgbDist(c, [g[0], g[1], g[2]]) < 2)) result.push([g[0], g[1], g[2]]);
  }
  if (!result.length) result.push([0, 0, 0]);
  return result.slice(0, max);
}
