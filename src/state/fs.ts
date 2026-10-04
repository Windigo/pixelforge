// File System Access API-helpers: map kiezen, onthouden (IndexedDB) en schrijven.
export interface SaveFile {
  name: string;
  data: Uint8Array;
}

const DB_NAME = 'pixelforge';
const STORE_NAME = 'handles';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function hasFsAccess(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!hasFsAccess()) return null;
  try {
    const handle = await (window as unknown as { showDirectoryPicker: (o?: { mode?: string }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: 'readwrite' });
    await saveDirHandle(handle);
    return handle;
  } catch {
    return null;
  }
}

export async function saveDirHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(handle, 'dir');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* negeer */
  }
}

export async function loadDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (!('indexedDB' in window)) return null;
  try {
    const db = await openDb();
    const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('dir');
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (handle) {
      const perm = await (
        handle as unknown as { requestPermission: (o: { mode: string }) => Promise<string> }
      ).requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') return handle;
    }
    return null;
  } catch {
    return null;
  }
}

export async function createSubdir(dir: FileSystemDirectoryHandle, name: string): Promise<FileSystemDirectoryHandle> {
  return dir.getDirectoryHandle(name, { create: true });
}

export async function writeFiles(dir: FileSystemDirectoryHandle, files: SaveFile[]): Promise<void> {
  for (const f of files) {
    const fh = await dir.getFileHandle(f.name, { create: true });
    const w = await fh.createWritable();
    await w.write(f.data as unknown as BlobPart);
    await w.close();
  }
}
