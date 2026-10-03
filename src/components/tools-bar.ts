import { LitElement, html } from 'lit';
import { store, StoreController } from '../state/store';
import type { ToolMode } from '../core/types';

const MODES: { id: ToolMode; label: string; paths: string[] }[] = [
  {
    id: 'pencil',
    label: 'Brush (B)',
    paths: [
      'M9.06 11.9 17.13 3.83a2.85 2.85 0 1 1 4.03 4.03l-8.07 8.07',
      'M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z',
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
    id: 'picker',
    label: 'Eyedropper (I)',
    paths: [
      'm2 22 1-1h3l9-9',
      'M3 21v-3l9-9',
      'm15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z',
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
                <span class="tool-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    ${m.paths.map((p) => html`<path d=${p} />`)}
                  </svg>
                </span>
                <span class="tool-label">${m.label}</span>
              </button>
            `,
          )}
        </div>
        <button class="undo-btn" ?disabled=${store.undoStack.length === 0} @click=${() => store.undo()}>↶ Undo (Ctrl+Z)</button>
        <label class="check">
          <input type="checkbox" .checked=${store.showGrid} @change=${(e: Event) => store.setShowGrid((e.target as HTMLInputElement).checked)} />
          GRID
        </label>
        <p class="hint">Brush: left = foreground, right = background · Eraser: transparent · Eyedropper: pick colour · Hand: pan.</p>
      </div>
    `;
  }
}

customElements.define('pf-tools-bar', ToolsBar);
