import { LitElement, html } from 'lit';
import { store, StoreController } from '../state/store';
import type { Target } from '../core/types';

const TARGETS: { id: Target; label: string }[] = [
  { id: 'amiga', label: 'AMIGA IFF' },
  { id: 'sc5', label: 'MSX SCREEN 5' },
  { id: 'sc2', label: 'MSX SCREEN 2' },
  { id: 'png', label: 'PIXELART PNG' },
];

export class MenuBar extends LitElement {
  constructor() {
    super();
    new StoreController(this);
  }

  createRenderRoot(): this {
    return this;
  }

  render() {
    return html`
      <header class="top">
        <div class="brand">PIXEL<b>FORGE</b></div>
        <button class="mbtn" title="Load PNG" @click=${() => store.fileInput?.click()}>📂 LOAD</button>
        <button class="mbtn primary" ?disabled=${!store.result} title="Export to current target" @click=${() => store.export()}>
          💾 SAVE (${store.targetLabel()})
        </button>
        <div class="formats">
          ${TARGETS.map(
            (t) => html`
              <button
                class=${store.target === t.id ? 'fmt active' : 'fmt'}
                @click=${() => store.setTarget(t.id)}
              >
                ${t.label}
              </button>
            `,
          )}
        </div>
        <div class="ready"><i></i>v2.0</div>
      </header>
    `;
  }
}

customElements.define('pf-menu-bar', MenuBar);

