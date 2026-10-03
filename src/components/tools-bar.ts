import { LitElement, html } from 'lit';
import { store, StoreController } from '../state/store';
import type { ToolMode } from '../core/types';

const MODES: { id: ToolMode; icon: string; label: string }[] = [
  { id: 'pencil', icon: '🖌️', label: 'Brush (B)' },
  { id: 'eraser', icon: '⌫', label: 'Eraser (E)' },
  { id: 'picker', icon: '💧', label: 'Eyedropper (I)' },
  { id: 'pan', icon: '✋', label: 'Hand (H)' },
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
                <span class="tool-icon">${m.icon}</span>
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
