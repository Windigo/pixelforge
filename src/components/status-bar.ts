import { LitElement, html } from 'lit';
import { store, StoreController } from '../state/store';

export class StatusBar extends LitElement {
  constructor() {
    super();
    new StoreController(this);
  }

  createRenderRoot(): this {
    return this;
  }

  render() {
    return html`<div class="status"><b>${store.status.head}</b> &nbsp; ${store.status.text}</div>`;
  }
}

customElements.define('pf-status-bar', StatusBar);
