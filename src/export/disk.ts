// Minimale FAT12 disk-image (720KB, 3.5" DSDD) met bestanden erop.

export interface DiskFile {
  name: string; // 8.3, hoofdletters
  data: Uint8Array;
}

export function sanitize83(name: string): string {
  const up = name.toUpperCase().replace(/[^A-Z0-9_.-]/g, '');
  const dot = up.indexOf('.');
  let base = dot >= 0 ? up.slice(0, dot) : up;
  let ext = dot >= 0 ? up.slice(dot + 1) : '';
  base = base.slice(0, 8);
  ext = ext.slice(0, 3);
  if (!base) base = 'IMG';
  return ext ? `${base}.${ext}` : base;
}

const SECTORS = 1440;
const BYTES_PER_SECTOR = 512;
const SECTORS_PER_CLUSTER = 2;
const RESERVED = 1;
const NUM_FATS = 2;
const ROOT_ENTRIES = 112;
const SECTORS_PER_FAT = 3;
const ROOT_SECTORS = Math.ceil((ROOT_ENTRIES * 32) / BYTES_PER_SECTOR);
const DATA_START = RESERVED + NUM_FATS * SECTORS_PER_FAT + ROOT_SECTORS;
const CLUSTER_BYTES = BYTES_PER_SECTOR * SECTORS_PER_CLUSTER;

function setFatEntry(fat: Uint8Array, index: number, value: number): void {
  const offset = Math.floor((index * 3) / 2);
  if (index % 2 === 0) {
    fat[offset] = value & 0xff;
    fat[offset + 1] = (fat[offset + 1] & 0xf0) | ((value >> 8) & 0x0f);
  } else {
    fat[offset] = (fat[offset] & 0x0f) | ((value & 0x0f) << 4);
    fat[offset + 1] = (value >> 4) & 0xff;
  }
}

export function buildDisk(files: DiskFile[]): Uint8Array {
  // Capaciteitscheck: een 720KB FAT12-disk heeft een beperkt aantal clusters.
  // Geef een duidelijke fout i.p.v. een cryptische RangeError als iets te groot is.
  const maxClusters = Math.floor((SECTORS - DATA_START) / SECTORS_PER_CLUSTER);
  const totalClusters = files.reduce(
    (n, f) => n + Math.max(1, Math.ceil(f.data.length / CLUSTER_BYTES)),
    0,
  );
  if (totalClusters > maxClusters) {
    throw new Error(
      `Files too large for a 720KB disk (${totalClusters} clusters needed, ${maxClusters} available). Shrink the image with the SCALE slider.`,
    );
  }

  const disk = new Uint8Array(SECTORS * BYTES_PER_SECTOR);

  // ── MSX boot sector + BPB ────────────────────────────
  const dv = new DataView(disk.buffer);
  disk[0] = 0xeb;
  // MSX floppy boot sectors conventionally start with EB FE 90. The
  // 0xFE jump displacement also prevents an x86 PC from trying to boot it.
  disk[1] = 0xfe;
  disk[2] = 0x90;
  disk.set(new TextEncoder().encode('MSX_04  '), 3);
  dv.setUint16(11, BYTES_PER_SECTOR, true);
  disk[13] = SECTORS_PER_CLUSTER;
  dv.setUint16(14, RESERVED, true);
  disk[16] = NUM_FATS;
  dv.setUint16(17, ROOT_ENTRIES, true);
  dv.setUint16(19, SECTORS, true);
  disk[21] = 0xf9;
  dv.setUint16(22, SECTORS_PER_FAT, true);
  dv.setUint16(24, 9, true);
  dv.setUint16(26, 2, true);
  // The MSX disk ROM calls boot code at C01Eh when byte 0 is EB/E9. Return
  // immediately so a data-only image falls through to Disk BASIC instead of
  // executing zero-filled memory and hanging during startup.
  disk[0x1e] = 0xc9; // RET

  // ── FAT-tabellen ─────────────────────────────────────
  const fat = new Uint8Array(SECTORS_PER_FAT * BYTES_PER_SECTOR);
  setFatEntry(fat, 0, 0xff9);
  setFatEntry(fat, 1, 0xfff);

  // ── data schrijven ───────────────────────────────────
  const rootDir = new Uint8Array(ROOT_ENTRIES * 32);
  let nextCluster = 2;
  let entry = 0;

  for (const f of files) {
    const dot = f.name.indexOf('.');
    const base = (dot >= 0 ? f.name.slice(0, dot) : f.name).padEnd(8, ' ');
    const ext = (dot >= 0 ? f.name.slice(dot + 1) : '').padEnd(3, ' ');
    const clusters = Math.max(1, Math.ceil(f.data.length / CLUSTER_BYTES));

    // root-directory entry
    const e = entry * 32;
    for (let i = 0; i < 8; i++) rootDir[e + i] = base.charCodeAt(i);
    for (let i = 0; i < 3; i++) rootDir[e + 8 + i] = ext.charCodeAt(i);
    rootDir[e + 11] = 0x20; // archive
    rootDir[e + 26] = nextCluster & 0xff;
    rootDir[e + 27] = (nextCluster >> 8) & 0xff;
    rootDir[e + 28] = f.data.length & 0xff;
    rootDir[e + 29] = (f.data.length >> 8) & 0xff;
    rootDir[e + 30] = (f.data.length >> 16) & 0xff;
    rootDir[e + 31] = (f.data.length >> 24) & 0xff;

    // data + FAT-ketting
    let cur = nextCluster;
    for (let c = 0; c < clusters; c++) {
      const sector = DATA_START + (cur - 2) * SECTORS_PER_CLUSTER;
      const start = c * CLUSTER_BYTES;
      const end = Math.min(f.data.length, start + CLUSTER_BYTES);
      disk.set(f.data.subarray(start, end), sector * BYTES_PER_SECTOR);
      const isLast = c === clusters - 1;
      setFatEntry(fat, cur, isLast ? 0xfff : cur + 1);
      cur++;
    }

    nextCluster += clusters;
    entry++;
  }

  // ── schrijf FAT + root ───────────────────────────────
  const fatOffset = RESERVED * BYTES_PER_SECTOR;
  for (let i = 0; i < NUM_FATS; i++) disk.set(fat, fatOffset + i * SECTORS_PER_FAT * BYTES_PER_SECTOR);
  const rootOffset = (RESERVED + NUM_FATS * SECTORS_PER_FAT) * BYTES_PER_SECTOR;
  disk.set(rootDir, rootOffset);

  return disk;
}
