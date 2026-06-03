// src/lib/storage/asset-store.ts
const DB_NAME = 'lyricvideo';
const STORE = 'assets';
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putAsset(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function getAsset(key: string): Promise<Blob | null> {
  const db = await openDb();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror = () => reject(req.error);
      // A transaction-level abort (e.g. browser storage error) won't fire
      // req.onerror — without these the promise would hang and db.close() never runs.
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
    });
  } finally {
    db.close();
  }
}

export async function deleteAsset(key: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function listAssetKeys(): Promise<string[]> {
  const db = await openDb();
  try {
    return await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
    });
  } finally {
    db.close();
  }
}
