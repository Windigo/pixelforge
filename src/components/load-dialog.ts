import { LitElement, html } from 'lit';
import { store, StoreController } from '../state/store';

export class LoadDialog extends LitElement {
  constructor() {
    super();
    new StoreController(this);
  }

  createRenderRoot(): this {
    return this;
  }

  render() {
    if (!store.loadDialogOpen) return html``;
    return html`
      <div class="dialog-backdrop">
        <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
          <h3>🖼️ IMAGE LOADED</h3>
          <p class="hint">
            Should the preview be pre-filled with the converted image, or would you like to start with an
            empty canvas and drag tiles in yourself?
          </p>
          <div class="dialog-actions">
            <button class="mbtn" @click=${() => store.chooseEmptyResult()}>Start empty</button>
            <button class="mbtn primary" @click=${() => store.chooseFillResult()}>Fill preview</button>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('pf-load-dialog', LoadDialog);
