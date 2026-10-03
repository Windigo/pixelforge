import { LitElement, html } from 'lit';

/**
 * Herbruikbare tooltip met een "?"-teken. Toont tekst bij hover/focus.
 * De bubbel wordt via JavaScript gepositioneerd en blijft altijd binnen het scherm.
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
          @mouseenter=${() => this.show()}
          @mouseleave=${() => this.hide()}
          @focus=${() => this.show()}
          @blur=${() => this.hide()}
        >?</button>
        <span class="tip-bubble" role="tooltip" ?hidden=${!this.open}>${this.text}</span>
      </span>
    `;
  }

  private show(): void {
    if (this.open) return;
    this.open = true;
    this.requestUpdate();
    requestAnimationFrame(() => this.position());
  }

  private hide(): void {
    this.open = false;
    this.requestUpdate();
  }

  private position(): void {
    const mark = this.querySelector('.tip-mark') as HTMLElement | null;
    const bubble = this.querySelector('.tip-bubble') as HTMLElement | null;
    if (!mark || !bubble) return;

    const mr = mark.getBoundingClientRect();
    const br = bubble.getBoundingClientRect();
    const gap = 8;
    const pad = 8;

    // horizontaal gecentreerd op het '?', daarna clamped binnen het scherm
    let left = mr.left + mr.width / 2 - br.width / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - br.width - pad));

    // verticaal: erboven, anders eronder
    let top = mr.top - br.height - gap;
    if (top < pad) top = mr.bottom + gap;

    bubble.style.position = 'fixed';
    bubble.style.left = `${Math.round(left)}px`;
    bubble.style.top = `${Math.round(top)}px`;
    bubble.style.right = 'auto';
    bubble.style.bottom = 'auto';
  }
}

customElements.define('pf-tooltip', Tooltip);
