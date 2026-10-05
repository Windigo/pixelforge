import { LitElement, html } from 'lit';
import { store, StoreController } from '../state/store';

export class SaveDialog extends LitElement {
  constructor() {
    super();
    new StoreController(this);
  }

  createRenderRoot(): this {
    return this;
  }

  private get isMsx(): boolean {
    return store.target === 'sc5' || store.target === 'sc2';
  }

  private get isC64(): boolean {
    return store.target === 'c64';
  }

  render() {
    if (!store.saveDialogOpen) return html``;
    const files = store.saveFiles;
    return html`
      <div class="dialog-backdrop" @click=${() => store.closeSaveDialog()}>
        <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
          <h3>💾 SAVE</h3>

          <div class="row">
            <label>FOLDER</label>
            <button class="mbtn" @click=${() => store.chooseSaveDir()}>📁 ${store.saveDirName || 'Choose folder…'}</button>
          </div>

          <div class="row">
            <label>NAME</label>
            <input
              type="text"
              .value=${store.saveName}
              placeholder="name"
              @input=${(e: Event) => store.setSaveName((e.target as HTMLInputElement).value)}
            />
          </div>

          ${this.isMsx
            ? html`
                <label class="check">
                  <input type="checkbox" .checked=${store.saveIncludePal} @change=${(e: Event) => store.setSaveIncludePal((e.target as HTMLInputElement).checked)} />
                  Include palette (.pal)
                </label>
                <label class="check">
                  <input type="checkbox" .checked=${store.saveMakeDisk} @change=${(e: Event) => store.setSaveMakeDisk((e.target as HTMLInputElement).checked)} />
                  Make a disk (.dsk) with a BASIC loader
                </label>
              `
            : ''}

          ${this.isC64
            ? html`
                <label class="check">
                  <input type="checkbox" .checked=${store.saveAsm} @change=${(e: Event) => store.setSaveAsm((e.target as HTMLInputElement).checked)} />
                  Kick Assembler source (.asm + .prg)
                </label>
              `
            : ''}

          <p class="hint">Files: ${files.map((f) => (f.ext === '.pal' && !store.saveIncludePal ? '' : f.ext)).filter(Boolean).join(' · ') || '—'}</p>

          ${store.saveError ? html`<p class="save-error">⚠️ ${store.saveError}</p>` : ''}

          <div class="dialog-actions">
            <button class="mbtn" @click=${() => store.closeSaveDialog()}>Cancel</button>
            <button class="mbtn primary" @click=${() => store.doSave()}>Save</button>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('pf-save-dialog', SaveDialog);
