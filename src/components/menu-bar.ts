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
        <div class="top-actions">
          <button class="mbtn help-btn" @click=${() => store.openHelp()}>? HELP</button>
          <div class="ready"><i></i>v0.1</div>
        </div>
      </header>
    `;
  }
}

customElements.define('pf-menu-bar', MenuBar);

