import { LitElement, html } from 'lit';
import { store } from '../state/store';

export class AppShell extends LitElement {
  createRenderRoot(): this {
    return this;
  }

  firstUpdated(): void {
    store.fileInput = this.querySelector('#file') as HTMLInputElement | null;
  }

  render() {
    return html`
      <pf-menu-bar></pf-menu-bar>
      <input id="file" type="file" accept="image/png,image/*" @change=${this.onFileChange} />
      <div class="app">
        <pf-side-bar></pf-side-bar>
        <main class="main">
          <pf-status-bar></pf-status-bar>
          <div class="previews">
            <pf-preview-pane kind="original"></pf-preview-pane>
            <pf-preview-pane kind="output"></pf-preview-pane>
          </div>
        </main>
      </div>
    `;
  }

  private onFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) store.loadFile(f);
    input.value = '';
  }
}

customElements.define('pf-app', AppShell);
