export type Target = 'amiga' | 'sc5' | 'sc2' | 'png';
export type ToolMode = 'pencil' | 'eraser' | 'picker' | 'pan';
export type Sampling = 'center' | 'dominant';
export type RGB = [number, number, number];

export interface Selection {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ViewState {
  zoom: number;
  x: number;
  y: number;
}
