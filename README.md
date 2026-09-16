# PixelForge

Een zelfstandige, browsergebaseerde converter voor pixel-art naar Amiga ILBM/IFF.

## Functies

- PNG-invoer en zij-aan-zij origineel/IFF-preview
- Beperkt geïndexeerd palet met nearest-colour mapping
- 1–8 bitplanes en echte ILBM/IFF-export
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
