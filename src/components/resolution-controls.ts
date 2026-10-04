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
        <span class="ratio-tip">
          <button
            type="button"
            class=${store.aspectRatioLocked ? 'ratio-lock active' : 'ratio-lock'}
            aria-pressed=${store.aspectRatioLocked}
            aria-label=${store.aspectRatioLocked ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
            aria-describedby="ratio-lock-tooltip"
            @click=${() => store.toggleAspectRatio()}
          ><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><path d="m8 15 3-3m2 0 3-3M7.5 9h2v2m5 4h2v-2"/></svg></button>
          <span class="tip-bubble ratio-bubble" id="ratio-lock-tooltip" role="tooltip">Aspect ratio vergrendelen. Aan: de andere maat wordt automatisch berekend om de oorspronkelijke verhoudingen te behouden. Uit: breedte en hoogte zijn onafhankelijk aan te passen.</span>
        </span>
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
