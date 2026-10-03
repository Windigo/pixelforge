# PixelForge

Een zelfstandige, browsergebaseerde converter voor pixel-art naar meerdere
retro-doelsystemen.

## Functies

- PNG-invoer (sleep in het origineel-paneel, of via de menubalk)
- Menubalk met Laden, Opslaan en keuze van doelsysteem
- Beperkt geïndexeerd palet met nearest-colour mapping
- Meerdere doelsystemen: Amiga ILBM/IFF, MSX SCREEN 5, MSX SCREEN 2 en pixelart-PNG
- Amiga: 1–8 bitplanes en echte ILBM/IFF-export
- MSX SCREEN 5: 256×212, 16 kleuren (4 bits/pixel), BSAVE-bitmap + MSX2-palet
- MSX SCREEN 2: 256×192, 16 kleuren, VRAM-dump (patronen/kleur/naamtabel) + palet,
  met optioneel vast MSX1-palet (TMS9918)
- Pixelart-PNG: geïndexeerd palet, 2–256 kleuren
- Selecties met pixelafmetingen
- Onafhankelijke zoom en pan per preview
- Resampling met pixelcentrum of dominante kleur

## Ontwikkelen

TypeScript + Lit 3 (Web Components) gebundeld met Vite.

```bash
npm install      # eenmalig
npm run dev      # dev-server met hot reload → http://localhost:5173
npm run build    # productie-bundel naar dist/
npm run typecheck
```

De app is opgebouwd uit losse componenten in `src/components/` (menubalk,
zijmenu, previews, palet, resolutie, tools), met pure conversie-/exportlogica in
`src/core/` en `src/export/` en een centrale reactieve store in `src/state/store.ts`.

## Deploy

`deploy.sh` bouwt de bundel en kopieert de volledige `dist/` naar de publieke map.
Pas de doelmap aan via de omgevingsvariabele `PIXELFORGE_PUBLIC_DIR`:

```bash
PIXELFORGE_PUBLIC_DIR=/pad/naar/publieke/map ./deploy.sh
```
