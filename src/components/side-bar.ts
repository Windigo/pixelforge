import { LitElement, html } from 'lit';
import { store, StoreController } from '../state/store';

export class SideBar extends LitElement {
  constructor() {
    super();
    new StoreController(this);
  }

  createRenderRoot(): this {
    return this;
  }

  render() {
    const info = store.source
      ? `Geladen: ${store.source.width} × ${store.source.height}px<br>${store.targetLabel()}: ${store.result?.width ?? 0} × ${store.result?.height ?? 0}px`
      : 'Nog geen bestand geladen.<br>Sleep een PNG in het linker paneel, of kies LADEN.';

    return html`
      <aside>
        <p class="hint">${info}</p>
        <pf-palette-controls></pf-palette-controls>
        <pf-tools-bar></pf-tools-bar>
      </aside>
    `;
  }
}

customElements.define('pf-side-bar', SideBar);
