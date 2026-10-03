import { LitElement, html } from 'lit';
import { store } from '../state/store';

export class AppShell extends LitElement {
  createRenderRoot(): this {
    return this;
  }

  firstUpdated(): void {
    store.fileInput = this.querySelector('#file') as HTMLInputElement | null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKeyDown);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      store.undo();
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'p') store.setMode('pencil');
    else if (k === 'e') store.setMode('eraser');
    else if (k === 'i') store.setMode('picker');
    else if (k === 'h') store.setMode('pan');
  };

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
          <pf-resolution-controls></pf-resolution-controls>
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
