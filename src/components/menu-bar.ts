import { LitElement, html } from 'lit';
import { store, StoreController } from '../state/store';

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
        <button class="mbtn" title="Load image (PNG / IFF / SCREEN 5 / SCREEN 2)" @click=${() => store.fileInput?.click()}>📂 LOAD AN IMAGE</button>
        <div class="ready"><i></i>v2.0</div>
      </header>
    `;
  }
}

customElements.define('pf-menu-bar', MenuBar);

