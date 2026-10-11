export type Target = 'amiga' | 'sc5' | 'sc2' | 'png' | 'c64' | 'nes';
export type ToolMode = 'pencil' | 'eraser' | 'dither' | 'picker' | 'pan' | 'select' | 'tile';
export type Sampling = 'center' | 'dominant';
export type RGB = [number, number, number];

export interface Selection {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A single tile: a square block of RGBA pixels (stamped via colour-mapping). */
export interface Tile {
  size: number;
  id: string;
  rgba: Uint8Array;
}

export interface ViewState {
  zoom: number;
  x: number;
  y: number;
}
