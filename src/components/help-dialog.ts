import { LitElement, html } from 'lit';
import { store, StoreController } from '../state/store';
import { MODES, toolIcon } from './tools-bar';
import type { ToolMode } from '../core/types';

const TOOL_DESC: Record<ToolMode, string> = {
  pencil: 'Draw. Left-click = foreground, right-click = background',
  eraser: 'Make pixels transparent',
  dither: 'Blend two colours',
  picker: 'Pick a colour',
  select: 'Select and move',
  pan: 'Pan the image',
};

const TOOL_HELP = MODES.map((m) => ({ ...m, desc: TOOL_DESC[m.id] }));

export class HelpDialog extends LitElement {
  constructor() {
    super();
    new StoreController(this);
  }

  createRenderRoot(): this {
    return this;
  }

  render() {
    if (!store.helpOpen) return html``;
    return html`
      <div class="dialog-backdrop" @click=${() => store.closeHelp()}>
        <div class="dialog help-dialog" @click=${(e: Event) => e.stopPropagation()}>
          <div class="help-head">
            <h3>❓ PIXELFORGE HELP</h3>
            <button class="mbtn" @click=${() => store.closeHelp()}>✕ Close</button>
          </div>

          <div class="help-body">
            <section>
              <h4>TOOLS</h4>
              ${TOOL_HELP.map(
                (t) => html`
                  <div class="help-row">
                    <span class="kbd-row help-key">
                      <span class="help-icon">${toolIcon(t.paths)}</span>
                      <span>${t.label}</span>
                    </span>
                    <span class="help-desc">${t.desc}</span>
                  </div>
                `,
              )}
            </section>

            <section>
              <h4>SELECTION</h4>
              <div class="help-row"><span class="kbd-row">DRAG</span><span>On empty area (left-click) — draw a selection</span></div>
              <div class="help-row"><span class="kbd-row">DRAG</span><span>Inside selection (left-click) — cut + move</span></div>
              <div class="help-row"><span class="kbd-row">DRAG</span><span>Inside selection (right-click) — copy + move</span></div>
              <div class="help-row"><kbd>CTRL/CMD+C</kbd><span>Copy</span></div>
              <div class="help-row"><kbd>CTRL/CMD+X</kbd><span>Cut</span></div>
              <div class="help-row"><kbd>CTRL/CMD+V</kbd><span>Paste</span></div>
              <div class="help-row"><kbd>DEL</kbd><span>Clear selection</span></div>
              <div class="help-row"><kbd>ESC</kbd><span>Deselect</span></div>
            </section>

            <section>
              <h4>NAVIGATION / IMAGE</h4>
              <div class="help-row"><kbd>CTRL/CMD+Z</kbd><span>Undo</span></div>
              <div class="help-row"><kbd>SCROLL</kbd><span>Zoom in / out</span></div>
              <div class="help-row"><kbd>CTRL+SCROLL</kbd><span>Zoom</span></div>
              <div class="help-row"><span class="kbd-row">MMB</span><span>Middle mouse button or CTRL+drag — pan</span></div>
            </section>

            <section>
              <h4>LOAD / SAVE</h4>
              <div class="help-row"><span class="kbd-row">LOAD</span><span>PNG · IFF/ILBM · SCREEN 5 · SCREEN 2 · PAL (click or drop in the ORIGINAL pane)</span></div>
              <div class="help-row"><span class="kbd-row">EXPORT</span><span>AMIGA IFF · MSX SCREEN 5 · MSX SCREEN 2 · Pixel-art PNG</span></div>
            </section>

            <section>
              <h4>MSX SCALE</h4>
              <div class="help-row"><span class="kbd-row">FIT</span><span>Image is scaled proportionally to the largest size that fits on screen</span></div>
              <div class="help-row"><span class="kbd-row">SCALE</span><span>Shrink further with the SCALE slider; the rest is padded</span></div>
            </section>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('pf-help-dialog', HelpDialog);
