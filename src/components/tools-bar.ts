import { LitElement, html } from 'lit';
import { store, StoreController } from '../state/store';
import type { ToolMode } from '../core/types';

const MODES: { id: ToolMode; label: string }[] = [
  { id: 'pencil', label: '✎ Potlood' },
  { id: 'eraser', label: '⌫ Gum' },
  { id: 'zoom', label: '⌕ Zoom' },
  { id: 'pan', label: '✥ Verslepen' },
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
        <p class="hint">Potlood: links = voorgrond, rechts = achtergrond · Gum: transparant · Zoom: klik · Verslepen: sleep.</p>
      </div>
    `;
  }
}

customElements.define('pf-tools-bar', ToolsBar);
