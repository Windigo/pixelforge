import type { ConvertResult } from '../core/convert';
import { msxPaletteBytes } from '../core/msx';
import { quantizeC64Multicolor, type C64Multicolor } from '../core/c64';
import type { RGB, Selection } from '../core/types';

function downloadBlob(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

function downloadBytes(data: Uint8Array, name: string): void {
  downloadBlob(new Blob([data as unknown as BlobPart], { type: 'application/octet-stream' }), name);
}

function bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function u32(v: number): Uint8Array {
  return new Uint8Array([v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]);
}

function chunk(id: string, data: Uint8Array): Uint8Array[] {
  const pad = data.length & 1 ? new Uint8Array(1) : new Uint8Array();
  return [bytes(id), u32(data.length), data, pad];
}

/** BSAVE header (0xFE) for MSX binary files. */
function bsave(data: Uint8Array, start: number, run: number): Uint8Array {
  const end = start + data.length - 1;
  const out = new Uint8Array(7 + data.length);
  out[0] = 0xfe;
  out[1] = start & 255;
  out[2] = (start >> 8) & 255;
  out[3] = end & 255;
  out[4] = (end >> 8) & 255;
  out[5] = run & 255;
  out[6] = (run >> 8) & 255;
  out.set(data, 7);
  return out;
}

export interface FileOutput {
  ext: string;
  data: Uint8Array;
  mime?: string;
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const a of arrays) {
    out.set(a, p);
    p += a.length;
  }
  return out;
}

/** Fallback: download de bestanden (voor browsers zonder File System Access API). */
export function downloadFiles(files: { name: string; data: Uint8Array }[]): void {
  for (const f of files) downloadBytes(f.data, f.name);
}

export function buildIlbm(r: ConvertResult, selection: Selection | null, planes: number): FileOutput[] {
  const s = selection ?? { x: 0, y: 0, w: r.width, h: r.height };
  const w = s.w || r.width;
  const h = s.h || r.height;
  const rowBytes = Math.ceil(w / 16) * 2;

  const bmhd = new Uint8Array(20);
  const dv = new DataView(bmhd.buffer);
  dv.setUint16(0, w);
  dv.setUint16(2, h);
  dv.setInt16(4, 0);
  dv.setInt16(6, 0);
  bmhd[8] = planes;
  bmhd[9] = 0;
  bmhd[10] = 0;
  dv.setUint16(14, 1);
  dv.setUint16(16, 1);
  dv.setUint16(18, w);

  const cmap = new Uint8Array(r.palette.length * 3);
  r.palette.forEach((c, i) => cmap.set(c, i * 3));

  const body = new Uint8Array(rowBytes * h * planes);
  let p = 0;
  for (let y = 0; y < h; y++) {
    for (let plane = 0; plane < planes; plane++) {
      for (let bx = 0; bx < rowBytes; bx++) {
        let val = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = bx * 8 + bit;
          if (x < w) {
            const idx = r.indexed[(s.y + y) * r.width + s.x + x];
            if (idx & (1 << plane)) val |= 1 << (7 - bit);
          }
        }
        body[p++] = val;
      }
    }
  }

  const bodyChunks = chunk('BODY', body);
  const all = [...chunk('BMHD', bmhd), ...chunk('CMAP', cmap), ...bodyChunks];
  const size = 4 + all.reduce((n, a) => n + a.length, 0);
  const data = concat([bytes('FORM'), u32(size), bytes('ILBM'), ...all]);
  return [{ ext: '.ilbm', data, mime: 'application/octet-stream' }];
}

export async function buildPng(r: ConvertResult, selection: Selection | null): Promise<FileOutput[]> {
  const s = selection ?? { x: 0, y: 0, w: r.width, h: r.height };
  const w = s.w || r.width;
  const h = s.h || r.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(r.preview, s.x, s.y, w, h, 0, 0, w, h);
  const blob = await new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed.'))), 'image/png'),
  );
  const data = new Uint8Array(await blob.arrayBuffer());
  return [{ ext: '.png', data, mime: 'image/png' }];
}

export function buildSc5(r: ConvertResult): FileOutput[] {
  const W = 256;
  const H = 212;
  // SCREEN 5 BLOAD files are raw VRAM dumps from 0000h through 769Fh:
  // bitmap at 0000h and the BASIC palette storage table at 7680h. Smaller
  // source images are padded with color index 0; larger ones are cropped
  // top-left (no stretching).
  const vram = new Uint8Array(0x76a0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x += 2) {
      const i1 = y < r.height && x < r.width ? r.indexed[y * r.width + x] : 0;
      const i2 = y < r.height && x + 1 < r.width ? r.indexed[y * r.width + x + 1] : 0;
      vram[(y * W + x) / 2] = (i1 << 4) | i2;
    }
  }
  const palette = msxPaletteBytes(r.palette);
  vram.set(palette, 0x7680);
  return [
    { ext: '.sc5', data: bsave(vram, 0x0000, 0x769f) },
    { ext: '.pal', data: msxPaletteBytes(r.palette) },
  ];
}

export function buildSc2(r: ConvertResult): FileOutput[] {
  const at = (y: number, x: number): number =>
    y < r.height && x < r.width ? r.indexed[y * r.width + x] : 0;

  const nameTable = new Uint8Array(768);
  const colorTable = new Uint8Array(0x1800);
  const bandPatterns: Uint8Array[][] = [[], [], []];
  const bandColors: Uint8Array[][] = [[], [], []];
  const pIndex = new Map<string, number>();
  let overflow = false;
  const distance = (a: RGB, b: RGB): number => {
    const dr = a[0] - b[0];
    const dg = a[1] - b[1];
    const db = a[2] - b[2];
    // Approximate perceived brightness and chroma, which matters more than
    // raw RGB distance when choosing only two colors for each 8-pixel row.
    return 0.30 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
  };

  for (let by = 0; by < 24; by++) {
    const band = Math.floor(by / 8);
    for (let bx = 0; bx < 32; bx++) {
      const block = new Uint8Array(8);
      const colorBytes = new Uint8Array(8);
      for (let row = 0; row < 8; row++) {
        const counts = new Map<number, number>();
        for (let px = 0; px < 8; px++) {
          const index = at(by * 8 + row, bx * 8 + px);
          counts.set(index, (counts.get(index) ?? 0) + 1);
        }
        let fg = 0;
        let bg = 0;
        let bestError = Infinity;
        let bestCovered = -1;
        // Color 0 is transparent, not a second black. Only consider it when
        // this pixel row actually contains transparent source pixels.
        const firstColor = counts.has(0) ? 0 : 1;
        for (let a = firstColor; a < r.palette.length; a++) {
          for (let b = a; b < r.palette.length; b++) {
            let error = 0;
            let covered = 0;
            for (const [index, amount] of counts) {
              error += amount * Math.min(distance(r.palette[index], r.palette[a]), distance(r.palette[index], r.palette[b]));
              if (index === a || index === b) covered += amount;
            }
            // Tie-break duplicate RGB colors (transparent 0 and black 1) by
            // preferring the pair that preserves the source color indices.
            if (error < bestError || (error === bestError && covered > bestCovered)) {
              bestError = error;
              bestCovered = covered;
              fg = a;
              bg = b;
            }
          }
        }

        let byte = 0;
        for (let px = 0; px < 8; px++) {
          const pi = at(by * 8 + row, bx * 8 + px);
          const dFG = distance(r.palette[pi], r.palette[fg]);
          const dBG = distance(r.palette[pi], r.palette[bg]);
          if (pi === fg || (pi !== bg && dFG <= dBG)) byte |= 0x80 >> px;
        }
        block[row] = byte;
        colorBytes[row] = (fg << 4) | bg;
        // SCREEN 2 stores foreground in the high nibble and background in
        // the low nibble; bit 1 selects foreground, bit 0 background.
      }

      const key = `${band}:${block.join(',')}:${colorBytes.join(',')}`;
      let pi = pIndex.get(key);
      if (pi === undefined) {
        const bandCount = bandPatterns[band].length;
        if (bandCount >= 256) {
          overflow = true;
          let nearestPattern = 0;
          let nearestError = Infinity;
          for (let candidate = 0; candidate < bandCount; candidate++) {
            const pattern = bandPatterns[band][candidate];
            const candidateColors = bandColors[band][candidate];
            let error = 0;
            for (let row = 0; row < 8; row++) {
              // A SCREEN 2 pattern code owns both its pattern and color rows.
              const colorByte = candidateColors[row];
              const fg = r.palette[colorByte >> 4];
              const bg = r.palette[colorByte & 15];
              for (let px = 0; px < 8; px++) {
                const source = r.palette[at(by * 8 + row, bx * 8 + px)];
                const chosen = pattern[row] & (0x80 >> px) ? fg : bg;
                error += distance(source, chosen);
              }
            }
            if (error < nearestError) {
              nearestError = error;
              nearestPattern = candidate;
            }
          }
          pi = nearestPattern;
        } else {
          pi = bandCount;
          pIndex.set(key, pi);
          bandPatterns[band].push(block);
          bandColors[band].push(colorBytes);
        }
      }
      nameTable[by * 32 + bx] = pi;
    }
  }

  const patGen = new Uint8Array(0x1800);
  for (let band = 0; band < 3; band++) {
    bandPatterns[band].forEach((p, i) => {
      const address = band * 0x800 + i * 8;
      patGen.set(p, address);
      colorTable.set(bandColors[band][i], address);
    });
  }

  // Standard SCREEN 2 dumps span pattern/name/color VRAM through 37FFh.
  // Keep the sprite pattern area (3800h–3FFFh) outside this image file.
  const vram = new Uint8Array(0x3800);
  vram.set(patGen, 0x0000);
  vram.set(nameTable, 0x1800);
  vram.set(colorTable, 0x2000);

  const files: FileOutput[] = [{ ext: '.sc2', data: bsave(vram, 0x0000, 0x0000) }, { ext: '.pal', data: msxPaletteBytes(r.palette) }];
  if (overflow) console.warn('SCREEN 2: meer dan 256 unieke patronen');
  return files;
}

/** C64 multicolor bitmap als Koala Painter-bestand (.koa). */
export function buildC64(r: ConvertResult): FileOutput[] {
  const m = r.c64 ?? quantizeC64Multicolor(r.indexed, r.width, r.height);
  // Koala: 2-byte load-adres ($6000) + 8000 bitmap + 1000 screen-RAM + 1000 color-RAM + 1 achtergrond.
  const data = new Uint8Array(2 + 8000 + 1000 + 1000 + 1);
  data[0] = 0x00;
  data[1] = 0x60;
  data.set(m.bitmap, 2);
  data.set(m.screenRam, 2 + 8000);
  data.set(m.colorRam, 2 + 8000 + 1000);
  data[2 + 8000 + 1000 + 1000] = m.background;
  return [{ ext: '.koa', data, mime: 'application/octet-stream' }];
}

function asmByteLines(data: Uint8Array, perLine = 16): string[] {
  const lines: string[] = [];
  for (let i = 0; i < data.length; i += perLine) {
    const chunk = Array.from(data.slice(i, i + perLine))
      .map((b) => `$${b.toString(16).padStart(2, '0').toUpperCase()}`)
      .join(', ');
    lines.push(`    .byte ${chunk}`);
  }
  return lines;
}

function generateC64Asm(m: C64Multicolor): string {
  const bg = `$${m.background.toString(16).padStart(2, '0').toUpperCase()}`;
  const lines = [
    '// PixelForge — C64 multicolor bitmap',
    '// 160×200 · 16 colours · Kick Assembler',
    '',
    ':BasicUpstart2(main)',
    '',
    'main:',
    '    // Border + background colour',
    '    lda #$00',
    '    sta $d020',
    `    lda #${bg}`,
    '    sta $d021',
    '',
    '    // Enable bitmap mode + multicolor',
    '    lda $d011',
    '    ora #$20',
    '    sta $d011',
    '    lda $d016',
    '    ora #$10',
    '    sta $d016',
    '',
    '    // Bitmap at $2000, screen at $0400',
    '    lda #$18',
    '    sta $d018',
    '',
    '    // Select VIC bank 0 ($0000-$3fff); CIA2 bank bits are inverted',
    '    lda $dd02',
    '    ora #$03',
    '    sta $dd02',
    '    lda $dd00',
    '    ora #$03',
    '    sta $dd00',
    '',
    '    // Copy screen RAM (1000 bytes) to $0400',
    '    ldx #$00',
    'copy_screen:',
    '    lda screen_data, x',
    '    sta $0400, x',
    '    lda screen_data + $0100, x',
    '    sta $0500, x',
    '    lda screen_data + $0200, x',
    '    sta $0600, x',
    '    inx',
    '    bne copy_screen',
    '    ldx #$00',
    'copy_screen_tail:',
    '    lda screen_data + $0300, x',
    '    sta $0700, x',
    '    inx',
    '    cpx #$e8',
    '    bne copy_screen_tail',
    '',
    '    // Copy colour RAM (1000 bytes) to $d800',
    '    ldx #$00',
    'copy_color:',
    '    lda color_data, x',
    '    sta $d800, x',
    '    lda color_data + $0100, x',
    '    sta $d900, x',
    '    lda color_data + $0200, x',
    '    sta $da00, x',
    '    inx',
    '    bne copy_color',
    '    ldx #$00',
    'copy_color_tail:',
    '    lda color_data + $0300, x',
    '    sta $db00, x',
    '    inx',
    '    cpx #$e8',
    '    bne copy_color_tail',
    '',
    'loop:',
    '    jmp loop',
    '',
    '// -------- screen RAM data (1000 bytes) --------',
    'screen_data:',
    ...asmByteLines(m.screenRam),
    '',
    '// -------- colour RAM data (1000 bytes) --------',
    'color_data:',
    ...asmByteLines(m.colorRam),
    '',
    '// -------- bitmap data (8000 bytes, assembled at $2000) --------',
    '.pc = $2000',
    'bitmap:',
    ...asmByteLines(m.bitmap),
  ];
  return lines.join('\n') + '\n';
}

/** Kick Assembler source (.asm) met de data als assembly en een viewer-routine. */
export function buildC64Asm(r: ConvertResult): FileOutput {
  const m = r.c64 ?? quantizeC64Multicolor(r.indexed, r.width, r.height);
  return { ext: '.asm', data: new TextEncoder().encode(generateC64Asm(m)), mime: 'text/plain' };
}

/** Standalone .prg voor direct laden op een C64/emulator. */
export function buildC64Prg(r: ConvertResult): FileOutput {
  const m = r.c64 ?? quantizeC64Multicolor(r.indexed, r.width, r.height);
  return { ext: '.prg', data: buildC64DirectPrg(m), mime: 'application/octet-stream' };
}

/**
 * A C64 PRG must be a contiguous memory image. Load the bitmap at $2000,
 * where VIC bank 0 can read it directly, then append a BASIC-startable stub
 * at $0801. The screen/color tables are copied by a short unrolled routine.
 */
function buildC64DirectPrg(m: C64Multicolor): Uint8Array {
  const code: number[] = [];
  const emit = (...v: number[]) => code.push(...v);
  const staAbs = (addr: number) => emit(0x8d, addr & 255, addr >> 8);
  const staAbsX = (addr: number) => emit(0x9d, addr & 255, addr >> 8);
  const ldaImm = (v: number) => emit(0xa9, v);
  const ldaAbsX = (addr: number) => emit(0xbd, addr & 255, addr >> 8);
  const ldxImm = (v: number) => emit(0xa2, v);
  const inx = () => emit(0xe8);
  const bne = (offset: number) => emit(0xd0, offset & 255);

  // The BASIC line is 12 bytes, so its machine-code entry is $080d (2061).
  ldaImm(0); staAbs(0xd020);
  ldaImm(m.background); staAbs(0xd021);
  emit(0xad, 0x11, 0xd0, 0x09, 0x20); staAbs(0xd011);
  emit(0xad, 0x16, 0xd0, 0x09, 0x10); staAbs(0xd016);
  ldaImm(0x18); staAbs(0xd018);
  // CIA2 bank bits are inverted: $03 selects VIC bank 0 ($0000-$3fff).
  emit(0xad, 0x00, 0xdd, 0x09, 0x03); staAbs(0xdd00);

  // Copy screen RAM and color RAM from their fixed PRG load addresses.
  ldxImm(0);
  const screenLoop = code.length;
  for (let page = 0; page < 3; page++) {
    ldaAbsX(0x3f40 + page * 0x100); staAbsX(0x0400 + page * 0x100);
  }
  inx();
  const screenBne = code.length; bne(0);
  code[screenBne + 1] = (screenLoop - (screenBne + 2)) & 255;
  ldxImm(0);
  const screenTailLoop = code.length;
  ldaAbsX(0x4240); staAbsX(0x0700);
  inx();
  emit(0xe0, 0xe8); // CPX #$e8: remaining 232 screen cells
  const screenTailBne = code.length; bne(0);
  code[screenTailBne + 1] = (screenTailLoop - (screenTailBne + 2)) & 255;

  ldxImm(0);
  const colorLoop = code.length;
  for (let page = 0; page < 3; page++) {
    ldaAbsX(0x4328 + page * 0x100); staAbsX(0xd800 + page * 0x100);
  }
  inx();
  const colorBne = code.length; bne(0);
  code[colorBne + 1] = (colorLoop - (colorBne + 2)) & 255;
  ldxImm(0);
  const colorTailLoop = code.length;
  ldaAbsX(0x4628); staAbsX(0xdb00);
  inx();
  emit(0xe0, 0xe8); // CPX #$e8: remaining 232 color-RAM cells
  const colorTailBne = code.length; bne(0);
  code[colorTailBne + 1] = (colorTailLoop - (colorTailBne + 2)) & 255;

  // Stable idle loop after VIC-II setup.
  const loopAddress = 0x080d + code.length;
  emit(0x4c, loopAddress & 255, loopAddress >> 8);

  const basic = [
    0x0b, 0x08, // next BASIC line at $080b
    0x0a, 0x00, // line 10
    0x9e, 0x32, 0x30, 0x36, 0x31, // SYS 2061
    0x00, 0x00, 0x00,
  ];
  const loadAddress = 0x0801;
  const bitmapAddress = 0x2000;
  const screenAddress = bitmapAddress + m.bitmap.length;
  const colorAddress = screenAddress + m.screenRam.length;
  const endAddress = colorAddress + m.colorRam.length + 1;
  if (screenAddress !== 0x3f40 || colorAddress !== 0x4328 || endAddress !== 0x4711) {
    throw new Error('Unexpected C64 PRG data layout.');
  }
  const memory = new Uint8Array(endAddress - loadAddress);
  memory.set(basic, 0);
  memory.set(code, 0x080d - loadAddress);
  memory.set(m.bitmap, bitmapAddress - loadAddress);
  memory.set(m.screenRam, screenAddress - loadAddress);
  memory.set(m.colorRam, colorAddress - loadAddress);
  memory[endAddress - loadAddress - 1] = m.background;
  const prg = new Uint8Array(memory.length + 2);
  prg[0] = loadAddress & 255;
  prg[1] = loadAddress >> 8;
  prg.set(memory, 2);
  return prg;
}
