import { LitElement, html } from 'lit';

export class SideBar extends LitElement {
  createRenderRoot(): this {
    return this;
  }

  render() {
    return html`
      <aside>
        <pf-palette-controls></pf-palette-controls>
        <pf-tools-bar></pf-tools-bar>
      </aside>
    `;
  }
}

customElements.define('pf-side-bar', SideBar);
