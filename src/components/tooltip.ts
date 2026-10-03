import { LitElement, html } from 'lit';

/**
 * Herbruikbare tooltip met een "?"-teken. Toont tekst bij hover/focus.
 * Gebruik: <pf-tooltip text="…"></pf-tooltip>
 */
export class Tooltip extends LitElement {
  static properties = {
    text: { type: String },
  };

  text = '';
  private open = false;

  createRenderRoot(): this {
    return this;
  }

  render() {
    return html`
      <span class="tip">
        <button
          type="button"
          class="tip-mark"
          aria-label="Meer informatie"
          @mouseenter=${() => this.setOpen(true)}
          @mouseleave=${() => this.setOpen(false)}
          @focus=${() => this.setOpen(true)}
          @blur=${() => this.setOpen(false)}
        >?</button>
        <span class="tip-bubble" role="tooltip" ?hidden=${!this.open}>${this.text}</span>
      </span>
    `;
  }

  private setOpen(v: boolean): void {
    if (this.open !== v) {
      this.open = v;
      this.requestUpdate();
    }
  }
}

customElements.define('pf-tooltip', Tooltip);
