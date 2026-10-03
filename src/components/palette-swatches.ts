import { LitElement, html } from 'lit';
import { store, StoreController } from '../state/store';

export class PaletteSwatches extends LitElement {
  constructor() {
    super();
    new StoreController(this);
  }

  createRenderRoot(): this {
    return this;
  }

  render() {
    const palette = store.result?.palette ?? [];
    return html`
      <div class="section">
        <h2>PALET</h2>
        <div class="palette">
          ${palette.map(
            (c) => html`
              <button
                class=${store.isPinned(c) ? 'swatch pinned' : 'swatch'}
                style="background:rgb(${c[0]},${c[1]},${c[2]})"
                title="rgb(${c.join(', ')}) — klik om ${store.isPinned(c) ? 'los te maken' : 'vast te zetten'}"
                @click=${() => store.togglePin(c)}
              ></button>
            `,
          )}
        </div>
      </div>
    `;
  }
}

customElements.define('pf-palette-swatches', PaletteSwatches);
