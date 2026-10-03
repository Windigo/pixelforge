# PixelForge — project context voor AI-agents

> Lees dit volledig voordat je code in deze repo bewerkt. Bedoeld voor DeepSeek,
> Codex en andere coding-agents in een nieuwe sessie.

## Wat dit project is

PixelForge is een **browsergebaseerde pixel-art converter** naar retro-doelsystemen.
Je laadt een PNG en exporteert het als:

- **Amiga ILBM/IFF** — 1–8 bitplanes, geïndexeerd palet
- **MSX SCREEN 5** — 256×212, 16 kleuren, 4 bits/pixel (BSAVE-bitmap + MSX2-palet)
- **MSX SCREEN 2** — 256×192, 16 kleuren (VRAM-dump met patroon/kleur/naamtabel)
- **Pixel-art PNG** — geïndexeerd palet, 2–256 kleuren

Het is een **single-page app, geen backend**. De UI-teksten zijn **Nederlands** —
houd nieuwe UI-strings in het Nederlands.

## Tech stack

- **Vite** (build/dev bundler)
- **TypeScript** (strict)
- **Lit 3** (Web Components, light DOM)
- Geen framework, geen server.

## Commands

```bash
npm install        # eenmalig
npm run dev        # dev-server → http://localhost:5173
npm run build      # tsc + vite build → dist/
npm run typecheck  # tsc --noEmit
npm run preview    # serve de gebouwde dist/
./deploy.sh        # bouwen + kopiëren naar publieke map (zie Deploy)
```

## Architectuur

```
src/
  main.ts                    entry; importeert alle componenten + styles.css
  styles.css                 globale CSS (via light DOM overal van toepassing)
  core/                      pure logica, GEEN DOM (unit-testbaar)
    types.ts  color.ts  resample.ts  msx.ts  convert.ts
  export/exporters.ts        ILBM / PNG / SC5 / SC2 export
  state/store.ts             reactieve singleton store + StoreController
  components/                Lit Web Components (light DOM)
    app-shell  menu-bar  side-bar  preview-pane
    palette-controls  resolution-controls  tools-bar
    palette-swatches  status-bar
```

### Belangrijke patronen (MOET gevolgd worden)

1. **Light DOM**: elke component overschrijft `createRenderRoot() { return this; }`
   zodat de globale CSS in `styles.css` geldt. Gebruik **geen** shadow DOM.
2. **Geen decorators**: gebruik `static properties = { … }` + `customElements.define('pf-x', X)`.
   (`experimentalDecorators` is bewust niet nodig.)
3. **Reactieve store**: abonneer in de **constructor** met `new StoreController(this)`
   (niet `private controller = …` — dat triggert `noUnusedLocals`). Lees state uit de
   `store`-singleton in `render()`; muteer via `store.setX()`.
4. **Pure logica blijft in `core/`** — geen `document`/canvas daar, zodat het los testbaar is.

## Componenten

| Tag | Taak |
|-----|------|
| `pf-app` | shell: menubalk + zijmenu + previews + verborgen file-input |
| `pf-menu-bar` | LADEN / OPSLAAN / formaatknoppen |
| `pf-side-bar` | host de widgets |
| `pf-palette-controls` | bitplanes / kleuren / MSX1-vinkje + samenvoegen + dither |
| `pf-resolution-controls` | resample / schaal / sampling |
| `pf-tools-bar` | selectie / zoom / verslepen |
| `pf-palette-swatches` | kleurenpalet + vastzetten |
| `pf-status-bar` | statusbalk |
| `pf-preview-pane` | canvas + zoom/pan/selectie (`kind="original"|"output"`) |

## Gotchas / valkuilen

- **TS 5.7**: `Uint8Array` is nu generiek (`Uint8Array<ArrayBufferLike>`); doorgeven aan
  `new Blob([…])` faalt. Cast met `as unknown as BlobPart`.
- **`noUnusedLocals`** vlagt ongebruikte private velden → daarom StoreController in de constructor.
- **`useDefineForClassFields: false`** in tsconfig is vereist voor Lit `static properties`.
- **`base: './'`** in `vite.config.ts` → relatieve asset-paden, zodat de bundel vanuit elke
  map werkt (nodig voor de lokale `http.server`-deploy).
- `dist/` en `node_modules/` zijn gitignored (build-output resp. dependencies).

## Formaatdetails (exporters)

- **ILBM**: BMHD + CMAP + BODY chunks; bitplane-packed; `rowBytes = ceil(w/16)*2`.
- **SCREEN 5**: 256×212, 4bpp (2 px/byte, hoge nibble = links). BSAVE-header (0xFE) + MSX2-palet (16×2 bytes, 3-bit RGB).
- **SCREEN 2**: 256×192, VRAM-dump 0x0000–0x37FF (patroongenerator @0x0000, naamtabel @0x1800, kleurtabel @0x2000). 2 kleuren per 8×1-regel; waarschuwing bij >256 patronen.
- **PNG**: cropt selectie, tekent preview-canvas naar een nieuwe canvas, `toBlob`.

## Deploy

- `deploy.sh` → `npm run build` → kopieert `dist/` naar `$PIXELFORGE_PUBLIC_DIR`
  (standaard `~/Sites/pixelforge`).
- Lokale python `http.server` (LaunchAgent `nl.mennohoman.pixelforge`, poort 8088) serveert de map.
- Cloudflare-tunnel: `https://pixelforge.mennohoman.nl` → `localhost:8088`.
- Statische bestanden → **geen herstart nodig** na een nieuwe deploy.

## Geschiedenis / eerdere wensen (belangrijke context)

- Oorspronkelijk één handgeschreven `dist/index.html`. Op verzoek gerefactored naar
  TypeScript+Lit: **"niet één groot bestand, maar componenten met een afgebakende taak."**
- **"Niet bitplanes maar gewoon aantal kleuren tonen"** — voor MSX/PNG-doelen wordt een
  vast "16 kleuren" of een kleuren-slider getoond i.p.v. bitplanes.
- **MSX1 vast palet (TMS9918)** — optioneel vinkje voor SCREEN 2 (anders MSX2-palet).
- **PNG laden in het origineel-paneel** (klik + drag-drop), niet een aparte drop-zone.
- **Menubalk** (LADEN / OPSLAAN / formaatkeuze) om het zijmenu klein te houden.

## Open TODO

- **"Echte per-doel preview"**: het output-paneel toont nu de geïndexeerde afbeelding,
  NIET de echte SCREEN 2-uitvoer (met de 2-kleuren-per-regel-beperking) of de exacte
  Amiga-bitplane-weergave. Dit was aangeboden maar nog niet geïmplementeerd.
