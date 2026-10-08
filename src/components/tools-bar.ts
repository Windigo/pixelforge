import { LitElement, html, svg } from 'lit';
import type { DitherPattern } from '../core/dither';
import { store, StoreController } from '../state/store';
import type { ToolMode } from '../core/types';

export const MODES: { id: ToolMode; label: string; paths: string[] }[] = [
  {
    id: 'pencil',
    label: 'Pencil (P)',
    paths: [
      'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
      'm15 5 4 4',
    ],
  },
  {
    id: 'eraser',
    label: 'Eraser (E)',
    paths: [
      'm7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21',
      'M22 21H7',
      'm5 11 9 9',
    ],
  },
  {
    id: 'dither',
    label: 'Dither (D)',
    paths: [
      'M3 3h18v18H3z',
      'M3 9h18M3 15h18M9 3v18M15 3v18',
    ],
  },
  {
    id: 'picker',
    label: 'Eyedropper (I)',
    paths: [
      'm2 22 1-1h3l9-9',
      'M3 21v-3l9-9',
      'm15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z',
    ],
  },
  {
    id: 'select',
    label: 'Select (S)',
    paths: [
      'M3 3h18v18H3z',
      'M9 9l12 12',
      'M9 9h7v7',
    ],
  },
  {
    id: 'pan',
    label: 'Hand (H)',
    paths: [
      'M12 2v20',
      'm15 19-3 3-3-3',
      'm19 9 3 3-3 3',
      'M2 12h20',
      'm3 5 3-3 3 3',
      'm9 3 3 3-3 3',
    ],
  },
];

export const toolIcon = (paths: string[]) => svg`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${paths.map((p) => svg`<path d=${p} />`)}
  </svg>
`;

const DITHER_PATTERNS: { id: DitherPattern; label: string }[] = [
  { id: 'checkerboard', label: 'Checkerboard' },
  { id: 'bayer', label: 'Bayer' },
  { id: 'horizontal', label: 'Horizontal' },
  { id: 'diagonal', label: 'Diagonal' },
];

export class ToolsBar extends LitElement {
  constructor() {
    super();
    new StoreController(this);
  }

  createRenderRoot(): this {
    return this;
  }

  render() {
    return html`
      <div class="section">
        <h2>TOOLS</h2>
        <div class="tools">
          ${MODES.map(
            (m) => html`
              <button class=${store.mode === m.id ? 'tool active' : 'tool'} @click=${() => store.setMode(m.id)}>
                <span class="tool-icon">${toolIcon(m.paths)}</span>
                <span class="tool-label">${m.label}</span>
              </button>
            `,
          )}
        </div>
        <div class="row">
          <label>SIZE</label>
          <b>${store.brushSize * 2 + 1}px</b>
        </div>
        <input type="range" min="0" max="8" .value=${String(store.brushSize)} @input=${(e: Event) => store.setBrushSize(Number((e.target as HTMLInputElement).value))} />
        <div class="row">
          <label>SHAPE</label>
          <select .value=${store.brushShape} @change=${(e: Event) => store.setBrushShape((e.target as HTMLSelectElement).value as 'round' | 'square')}>
            <option value="round">Round</option>
            <option value="square">Square</option>
          </select>
        </div>
        ${store.mode === 'dither'
          ? html`
              <div class="section-inner">
                <h3>DITHER</h3>
                <div class="row">
                  <label>PATTERN</label>
                  <select .value=${store.ditherPattern} @change=${(e: Event) => store.setDitherPattern((e.target as HTMLSelectElement).value as DitherPattern)}>
                    ${DITHER_PATTERNS.map((p) => html`<option value=${p.id}>${p.label}</option>`)}
                  </select>
                </div>
                <div class="row">
                  <label>AMOUNT</label>
                  <b>${Math.round((store.ditherLevel / 16) * 100)}%</b>
                </div>
                <input type="range" min="0" max="16" .value=${String(store.ditherLevel)} @input=${(e: Event) => store.setDitherLevel(Number((e.target as HTMLInputElement).value))} />
                <label class="check">
                  <input type="checkbox" .checked=${store.ditherManual} @change=${(e: Event) => store.setDitherManual((e.target as HTMLInputElement).checked)} />
                  MANUAL COLOURS (FG + BG)
                </label>
                <p class="hint">Auto: dithers the two colours under the cursor. Manual: blends foreground + background — paint a shadow/light side without an existing edge.</p>
              </div>
            `
          : ''}
        <button class="undo-btn" ?disabled=${store.undoStack.length === 0} @click=${() => store.undo()}>↶ Undo (Ctrl+Z)</button>
        <label class="check">
          <input type="checkbox" .checked=${store.showGrid} @change=${(e: Event) => store.setShowGrid((e.target as HTMLInputElement).checked)} />
          GRID
        </label>
        <div class="row">
          <label>CELL SIZE</label>
          <select .value=${String(store.gridSize)} @change=${(e: Event) => store.setGridSize(Number((e.target as HTMLSelectElement).value) as 8 | 16)}>
            <option value="8">8 × 8 px</option>
            <option value="16">16 × 16 px</option>
          </select>
        </div>
        <div class="row">
          <label>OFFSET</label>
          <span class="sizes">
            <input inputmode="numeric" type="number" step="1" placeholder="X" .value=${String(store.gridOffsetX)} @change=${(e: Event) => store.setGridOffsetX(Number((e.target as HTMLInputElement).value) || 0)} />
            <input inputmode="numeric" type="number" step="1" placeholder="Y" .value=${String(store.gridOffsetY)} @change=${(e: Event) => store.setGridOffsetY(Number((e.target as HTMLInputElement).value) || 0)} />
          </span>
        </div>
        <p class="hint">Pencil: left-click = foreground, right-click = background · Eraser: transparent · Eyedropper: pick colour · Select: drag to select, drag inside to move (Ctrl+C/X/V = copy/cut/paste) · Hand: pan.</p>
      </div>
    `;
  }
}

customElements.define('pf-tools-bar', ToolsBar);
