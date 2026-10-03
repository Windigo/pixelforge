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
          <pf-tooltip text="On: turns it into real pixel art — resizes the image to a chosen number of pixels (via SCALE or width/height). Off: the original size is kept."></pf-tooltip>
        </span>
        <span class="res-label">SCALE</span>
        <b>${store.scale}%</b>
        <input type="range" min="1" max="100" .value=${String(store.scale)} @input=${(e: Event) => store.setScale(Number((e.target as HTMLInputElement).value))} />
        <input inputmode="numeric" placeholder="width" .value=${store.widthInput} @change=${(e: Event) => store.setSize('width', (e.target as HTMLInputElement).value)} />
        <input inputmode="numeric" placeholder="height" .value=${store.heightInput} @change=${(e: Event) => store.setSize('height', (e.target as HTMLInputElement).value)} />
        <span class="res-label">SAMPLING</span>
        <select .value=${store.sampling} @change=${(e: Event) => store.setSampling((e.target as HTMLSelectElement).value as 'center' | 'dominant')}>
          <option value="center">Pixel centre</option>
          <option value="dominant">Dominant colour</option>
        </select>
      </div>
    `;
  }
}

customElements.define('pf-resolution-controls', ResolutionControls);
