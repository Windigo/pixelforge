import { LitElement, html } from 'lit';
import { store, StoreController } from '../state/store';

export class PaletteControls extends LitElement {
  constructor() {
    super();
    new StoreController(this);
  }

  createRenderRoot(): this {
    return this;
  }

  render() {
    const t = store.target;
    const fixedPalette = t === 'sc2' && store.msx1;
    return html`
      <div class="section">
        <h2>${t === 'amiga' ? 'AMIGA PALETTE' : 'PALETTE'}</h2>

        ${t === 'amiga'
          ? html`
              <div class="row"><b>${store.planes} BITPLANES · ${(1 << store.planes) - 1} COLOURS + TRANSPARENT</b></div>
              <input type="range" min="1" max="8" .value=${String(store.planes)} @input=${(e: Event) => store.setPlanes(Number((e.target as HTMLInputElement).value))} />
              <div class="bits">
                ${[1, 2, 3, 4, 5, 6, 7, 8].map(
                  (n) => html`
                    <button class=${n === store.planes ? 'active' : ''} @click=${() => store.setPlanes(n)}>${n}</button>
                  `,
                )}
              </div>
            `
          : t === 'png'
            ? html`
                <div class="row"><b>${store.colors - 1} COLOURS + TRANSPARENT</b></div>
                <input type="range" min="2" max="256" .value=${String(store.colors)} @input=${(e: Event) => store.setColors(Number((e.target as HTMLInputElement).value))} />
              `
            : html`
                <div class="row"><b>15 COLOURS + TRANSPARENT</b></div>
                ${t === 'sc2'
                  ? html`
                      <span class="check">
                        <label>
                          <input type="checkbox" .checked=${store.msx1} @change=${(e: Event) => store.setMsx1((e.target as HTMLInputElement).checked)} />
                          FIXED MSX1 PALETTE (TMS9918)
                        </label>
                        <pf-tooltip text="Default on: the 16 fixed MSX1 colours (TMS9918). Turn this off for MSX2 — then the 16 colours are automatically matched to your image (better colour accuracy)."></pf-tooltip>
                      </span>
                    `
                  : ''}
                <p class="hint">${t === 'sc5' ? 'SCREEN 5 · 256×212 · 16 colours (4 bits/pixel)' : 'SCREEN 2 · 256×192 · 16 colours · max 2 colours per 8×1 row'}</p>
              `}

        <div class="row">
          <label>MERGE COLOURS <pf-tooltip text=${fixedPalette
            ? 'Voegt vergelijkbare brontinten samen tot de meest gebruikte nabije MSX1-kleur. Het hardwarepalet blijft vast; hogere waarden voegen meer tinten samen.'
            : 'Voegt vergelijkbare bronkleuren samen voordat het uitvoerpalet wordt opgebouwd. Hogere waarden voegen meer tinten samen.'}></pf-tooltip></label>
          <b>${store.merge}</b>
        </div>
        <input type="range" min="0" max="80" .value=${String(store.merge)} @input=${(e: Event) => store.setMerge(Number((e.target as HTMLInputElement).value))} />

        <label class="check">
          <input type="checkbox" .checked=${store.dither} @change=${(e: Event) => store.setDither((e.target as HTMLInputElement).checked)} />
          FLOYD–STEINBERG DITHER
        </label>

        <p class="hint">Click a palette swatch to pin that colour.</p>
      </div>
    `;
  }
}

customElements.define('pf-palette-controls', PaletteControls);
