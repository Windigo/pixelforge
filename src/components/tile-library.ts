import { LitElement, html } from 'lit';
import { store, StoreController } from '../state/store';
import type { Tile } from '../core/types';

/** MIME type used for dragging a tile onto the preview to stamp it. */
export const TILE_DRAG_TYPE = 'application/x-pixelforge-tile';
/** MIME type used for dragging a tile selection (to move it or save it). */
export const TILE_SELECTION_DRAG_TYPE = 'application/x-pixelforge-selection';
/** MIME type used for dragging a source (left-pane) tile selection to copy it right. */
export const SOURCE_TILE_DRAG_TYPE = 'application/x-pixelforge-source-tile';

function drawTile(c: HTMLCanvasElement, tile: Tile): void {
  const size = tile.size;
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  img.data.set(tile.rgba.subarray(0, size * size * 4));
  ctx.putImageData(img, 0, 0);
}

export class TileLibrary extends LitElement {
  private tiles: Tile[] = [];

  constructor() {
    super();
    new StoreController(this);
  }

  createRenderRoot(): this {
    return this;
  }

  render() {
    const unique = store.sourceTiles();
    const saved = store.savedTiles;
    this.tiles = [...unique, ...saved];
    return html`
      <div class="section" @dragover=${this.onDragOver} @drop=${this.onDrop}>
        <h2>TILE LIBRARY</h2>
        <p class="hint">${store.gridSize}×${store.gridSize} tiles · ${unique.length} unique · drag one onto the preview to stamp it.</p>
        <div class="tile-grid">
          ${this.tiles.map(
            (t, i) => html`
              <canvas
                class="tile-thumb"
                width=${t.size}
                height=${t.size}
                data-i=${i}
                draggable="true"
                title="Drag onto the preview to stamp"
                @dragstart=${(e: DragEvent) => this.onDragStart(e, t)}
              ></canvas>
            `,
          )}
        </div>
        ${this.tiles.length === 0 ? html`<p class="hint">No image loaded yet.</p>` : ''}
        <button class="mbtn" ?disabled=${!store.tileSelection} @click=${() => store.addTileSelectionToLibrary()}>
          ➕ ADD SELECTION TO LIBRARY
        </button>
        <p class="hint">Select tiles with the Tile tool, then drag them here (or press the button) to save them for reuse.</p>
      </div>
    `;
  }

  updated(): void {
    this.querySelectorAll<HTMLCanvasElement>('canvas.tile-thumb').forEach((c) => {
      const i = Number(c.dataset.i ?? '0');
      const tile = this.tiles[i];
      if (!tile || c.dataset.drawn === tile.id) return;
      c.dataset.drawn = tile.id;
      drawTile(c, tile);
    });
  }

  private onDragStart(e: DragEvent, tile: Tile): void {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData(TILE_DRAG_TYPE, JSON.stringify({ size: tile.size, rgba: Array.from(tile.rgba) }));
    e.dataTransfer.effectAllowed = 'copy';
  }

  private onDragOver(e: DragEvent): void {
    if (e.dataTransfer?.types.includes(TILE_SELECTION_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  private onDrop(e: DragEvent): void {
    if (e.dataTransfer?.types.includes(TILE_SELECTION_DRAG_TYPE)) {
      e.preventDefault();
      store.addTileSelectionToLibrary();
    }
  }
}

customElements.define('pf-tile-library', TileLibrary);
