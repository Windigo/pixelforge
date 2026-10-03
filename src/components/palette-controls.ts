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
        <h2>${t === 'amiga' ? 'AMIGA PALET' : 'PALET'}</h2>

        ${t === 'amiga'
          ? html`
              <div class="row"><label>BITPLANES</label><b>${store.planes} BITPLANES · ${1 << store.planes} KLEUREN</b></div>
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
                <div class="row"><label>AANTAL KLEUREN</label><b>${store.colors} KLEUREN</b></div>
                <input type="range" min="2" max="256" .value=${String(store.colors)} @input=${(e: Event) => store.setColors(Number((e.target as HTMLInputElement).value))} />
              `
            : html`
                <div class="row"><label>KLEUREN</label><b>16 KLEUREN</b></div>
                ${t === 'sc2'
                  ? html`
                      <label class="check">
                        <input type="checkbox" .checked=${store.msx1} @change=${(e: Event) => store.setMsx1((e.target as HTMLInputElement).checked)} />
                        VAST MSX1-PALET (TMS9918)
                        <pf-tooltip text="Standaard aan: de 16 vaste MSX1-kleuren (TMS9918). Zet dit uit als je voor MSX2 maakt — dan worden de 16 kleuren automatisch op jouw afbeelding afgestemd (betere kleurnauwkeurigheid)."></pf-tooltip>
                      </label>
                    `
                  : ''}
                <p class="hint">${t === 'sc5' ? 'SCREEN 5 · 256×212 · 16 kleuren (4 bits/pixel)' : 'SCREEN 2 · 256×192 · 16 kleuren · max 2 kleuren per 8×1 regel'}</p>
              `}

        <div class="row">
          <label>KLEUREN SAMENVOEGEN${fixedPalette ? html` <pf-tooltip text="Uitgeschakeld: bij een vast MSX1-palet liggen de 16 kleuren vast, dus er valt niets samen te voegen. Zet 'VAST MSX1-PALET' uit om dit te activeren."></pf-tooltip>` : ''}</label>
          <b>${store.merge}</b>
        </div>
        <input type="range" min="0" max="80" .value=${String(store.merge)} ?disabled=${fixedPalette} @input=${(e: Event) => store.setMerge(Number((e.target as HTMLInputElement).value))} />

        <label class="check">
          <input type="checkbox" .checked=${store.dither} @change=${(e: Event) => store.setDither((e.target as HTMLInputElement).checked)} />
          FLOYD–STEINBERG DITHER
        </label>

        <p class="hint">Klik een paletvak om die kleur vast te zetten.</p>
      </div>
    `;
  }
}

customElements.define('pf-palette-controls', PaletteControls);
