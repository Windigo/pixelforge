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

## Lokaal gebruiken

Open `dist/index.html` rechtstreeks in een moderne browser. Je kunt ook een
lokale statische server gebruiken:

```bash
python3 -m http.server 8088 --directory dist
```

Open daarna `http://localhost:8088`.

## Deploy

`deploy.sh` is een optioneel voorbeeld voor een eigen lokale statische
webserver. Pas de doelmap aan via de omgevingsvariabele
`PIXELFORGE_PUBLIC_DIR`:

```bash
PIXELFORGE_PUBLIC_DIR=/pad/naar/publieke/map ./deploy.sh
```
