import { LitElement, html } from 'lit';
import { store, StoreController } from '../state/store';

export class ResolutionControls extends LitElement {
  constructor() {
    super();
    new StoreController(this);
  }

  createRenderRoot(): this {
    return this;
  }

  render() {
    return html`
      <div class="res-bar">
        <span class="check">
          <label>
            <input type="checkbox" .checked=${store.resample} @change=${(e: Event) => store.setResample((e.target as HTMLInputElement).checked)} />
            RESAMPLE
          </label>
          <pf-tooltip text="Aan: maakt er echte pixelart van — zet de afbeelding om naar een zelfgekozen aantal pixels (via SCHAAL of breedte/hoogte). Uit: de originele grootte blijft."></pf-tooltip>
        </span>
        <span class="res-label">SCHAAL</span>
        <b>${store.scale}%</b>
        <input type="range" min="1" max="100" .value=${String(store.scale)} @input=${(e: Event) => store.setScale(Number((e.target as HTMLInputElement).value))} />
        <input inputmode="numeric" placeholder="breedte" .value=${store.widthInput} @change=${(e: Event) => store.setSize('width', (e.target as HTMLInputElement).value)} />
        <input inputmode="numeric" placeholder="hoogte" .value=${store.heightInput} @change=${(e: Event) => store.setSize('height', (e.target as HTMLInputElement).value)} />
        <span class="res-label">SAMPLING</span>
        <select .value=${store.sampling} @change=${(e: Event) => store.setSampling((e.target as HTMLSelectElement).value as 'center' | 'dominant')}>
          <option value="center">Pixelcentrum</option>
          <option value="dominant">Dominante kleur</option>
        </select>
      </div>
    `;
  }
}

customElements.define('pf-resolution-controls', ResolutionControls);
