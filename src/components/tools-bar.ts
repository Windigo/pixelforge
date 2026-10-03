import { LitElement, html } from 'lit';
import { store, StoreController } from '../state/store';
import type { ToolMode } from '../core/types';

const MODES: { id: ToolMode; label: string }[] = [
  { id: 'pencil', label: '✎ Potlood (B)' },
  { id: 'eraser', label: '⌫ Gum (E)' },
  { id: 'picker', label: '💧 Pipet (I)' },
  { id: 'pan', label: '✥ Verslepen (H)' },
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
                ${m.label}
              </button>
            `,
          )}
        </div>
        <button class="undo-btn" ?disabled=${store.undoStack.length === 0} @click=${() => store.undo()}>↶ Ongedaan (Ctrl+Z)</button>
        <label class="check">
          <input type="checkbox" .checked=${store.showGrid} @change=${(e: Event) => store.setShowGrid((e.target as HTMLInputElement).checked)} />
          GRID
        </label>
        <p class="hint">Potlood: links = voorgrond, rechts = achtergrond · Gum: transparant · Pipet: kleur pakken · Verslepen: sleep.</p>
      </div>
    `;
  }
}

customElements.define('pf-tools-bar', ToolsBar);
