# SCREEN 5 — los logo opslaan als raw data (voor Fusion-C)

> Onderzoek naar hoe je voor MSX SCREEN 5 een **los logo** als raw data opslaat,
> zonder een heel 256×212-scherm, bruikbaar in Fusion-C (of andere MSX-C).

## 1. SCREEN 5 bitmap-formaat (geverifieerd via MSX wiki)

SCREEN 5 (MSX2 "Graphic mode 4") is een **4-bpp bitmap**:

- **Bitmap-tabel** in VRAM op `0x0000`, 27136 bytes (= 256×212 / 2).
- **Elke byte bevat 2 pixels**:
  - hoge nibble (bits 7–4) = **linker** pixel (even x),
  - lage nibble (bits 3–0) = **rechter** pixel (oneven x).
- **Elke regel is 128 bytes** (256 pixels / 2); regels liggen contigu 128 bytes uit elkaar.
- **Palet-tabel** op `0x7680` (32 bytes = 16 kleuren × 2 bytes).
- Overige VRAM-map bij init: sprite-tabellen op 0x7400–0x7FFF.

```
VRAM-adres   inhoud
0x0000       pixel(0,0) | pixel(1,0)     → byte = (links << 4) | rechts
0x0001       pixel(2,0) | pixel(3,0)
...
0x007F       pixel(254,0) | pixel(255,0)
0x0080       pixel(0,1) | pixel(1,1)     ← volgende regel (stride 128 bytes)
```

## 2. Wat een "los logo" aan raw data is

Het huidige SC5-export vult op tot 256×212 en zet er een BSAVE-header + palet bij.

Voor een los logo wil je alleen de **contigue gepackte pixels**:

- breedte `W` (even), hoogte `H` → **`H` regels × `(W / 2)` bytes**.
- Geen header, geen opvulling tot vol scherm.
- Elke byte: `(pixelLinks << 4) | pixelRechts`.

Voorbeeld: 32×128 logo → `128 × 16 = 2048 bytes` (i.p.v. 27136 bytes voor een vol scherm).

> **Stride-valkuil:** een SCREEN 5-regel is 128 bytes breed. De contigue data kun je
> niet in één keer op één VRAM-adres zetten en verwachten dat het klopt — je moet
> **per regel** kopiëren met de 128-byte stride. Alternatief: data óók opslaan met
> 128-byte-regels (dan direct BLOAD-baar, maar scherm-breed / veel padding).

## 3. Palet

16 kleuren, 3-bit RGB. Twee representaties:

- **`.pal`-bestand** (VRAM-tabelformaat, zoals PixelForge nu exporteert): 32 bytes,
  per kleur 2 bytes = `(R << 4) | B` gevolgd door `G` ("BASIC palette storage table"
  op `0x7680`).
- **Fusion-C**: palet via VDP-registers met `SetPalette(i, r, g, b)` per kleur
  (r/g/b = 0..7), of het `.pal`-bestand inladen.

## 4. Gebruik in Fusion-C

Relevante functies (headers `msx_fusion.h` / `vdp_graph2.h`), uit Fusion-C v1.2:

- `SetScreen(5)` (of `Screen(5)`) — SCREEN 5 aanzetten.
- `SetPalette(color, r, g, b)` / `SetSC5Palette(...)` — palet zetten.
- `CopyRamToVram(source, vramAdres, length)` — RAM → VRAM.
- `HMMC`, `Vpoke`, `RleWBToVram` — alternatieven (HMMC = high-speed copy,
  RleWBToVram = RLE-gecomprimeerd).

Officiële voorbeelden in de repo: `loadScreen5Image.c` en `sc5Palette.c`.

Pseudo-C voor een los logo (W even, rowBytes = W/2):

```c
const unsigned char logo[2048] = { ... };   // 32×128, contigue 4bpp

SetScreen(5);
for (int i = 0; i < 16; i++) SetPalette(i, r[i], g[i], b[i]);

int baseX = 16, baseY = 16;
int vram = baseY * 128 + baseX / 2;
int rowBytes = 32 / 2;                      // 16 bytes per regel
for (int y = 0; y < 128; y++)
    CopyRamToVram(logo + y * rowBytes, vram + y * 128, rowBytes);
```

## 5. Gewenste PixelForge-export (TODO)

Een "SAVE → Raw SCREEN 5 logo" zou moeten produceren:

1. **`.bin` / `.h` / `.c`** met de gepackte pixels — `H × (W/2)` bytes, high-nibble =
   links, géén full-screen opvulling. Als C-array voor direct `#include`.
2. **`.pal`** — 32 bytes (of C-array met 16× 3-bit RGB voor `SetPalette`).
3. Afmetingen `W × H` erbij (als commentaar of mini-header), want de data bevat
   zelf geen breedte/hoogte.

### Status
- [ ] Onderzoek gedaan (dit bestand).
- [ ] Export-optie bouwen in PixelForge.
