import { LitElement, html } from 'lit';
import { store, StoreController } from '../state/store';
import type { RGB } from '../core/types';

function swatchBg(i: number, palette: RGB[]): string {
  if (i === 0) {
    return 'conic-gradient(var(--check1) 25%, var(--check2) 0 50%, var(--check1) 0 75%, var(--check2) 0) 0 0 / 12px 12px';
  }
  const c = palette[i] ?? [0, 0, 0];
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export class PaletteSwatches extends LitElement {
  constructor() {
    super();
    new StoreController(this);
  }

  createRenderRoot(): this {
    return this;
  }

  render() {
    const palette = store.result?.palette ?? [];
    return html`
      <div class="palette">
        <div class="fg-bg" title="Voorgrond (boven) / achtergrond (onder)">
          <span class="swatch-block fg" style="background:${swatchBg(store.fg, palette)}"></span>
          <span class="swatch-block bg" style="background:${swatchBg(store.bg, palette)}"></span>
        </div>
        ${palette.map(
          (c, i) => html`
            <button
              class=${'swatch' + (i === store.fg ? ' sel-fg' : '') + (i === store.bg ? ' sel-bg' : '')}
              style="background:${swatchBg(i, palette)}"
              title="${i === 0 ? 'Transparant' : `rgb(${c.join(', ')})`} — klik = voorgrond, rechtsklik = achtergrond"
              @click=${(e: MouseEvent) => this.pick(i, e)}
              @contextmenu=${(e: MouseEvent) => this.pick(i, e)}
            ></button>
          `,
        )}
      </div>
    `;
  }

  private pick(i: number, e: MouseEvent): void {
    e.preventDefault();
    if (e.type === 'contextmenu' || e.button === 2) store.setBg(i);
    else store.setFg(i);
  }
}

customElements.define('pf-palette-swatches', PaletteSwatches);
