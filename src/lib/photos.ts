/** Recipe photos, keyed by recipe id, as JPEG data URLs. */
export type Photos = Record<string, string>;

const MAX_EDGE = 720;
/** Stays well under the hosted store's 256 KB per-document limit. */
const MAX_BYTES = 140_000;

/** Shrink a photo from the camera or library to a small JPEG data URL. */
export async function resizePhoto(file: Blob): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not-image");
  const bitmap = await createImageBitmap(file);
  let edge = MAX_EDGE;
  for (;;) {
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.72, 0.6, 0.5]) {
      const url = canvas.toDataURL("image/jpeg", quality);
      if (url.length <= MAX_BYTES) {
        bitmap.close();
        return url;
      }
    }
    edge = Math.round(edge * 0.75);
  }
}

/* ---------- this browser: IndexedDB (photos are too big for localStorage) ---------- */

const DB_NAME = "recipe-hub";
const STORE = "photos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadLocalPhotos(): Promise<Photos> {
  try {
    const db = await openDb();
    return await new Promise<Photos>((resolve, reject) => {
      const out: Photos = {};
      const req = db.transaction(STORE).objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(out);
        if (typeof cursor.value === "string") out[String(cursor.key)] = cursor.value;
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return {};
  }
}

export async function saveLocalPhoto(recipeId: string, dataUrl: string | null): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      if (dataUrl) store.put(dataUrl, recipeId);
      else store.delete(recipeId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* private window or storage blocked: the photo still shows this visit */
  }
}

export async function replaceLocalPhotos(photos: Photos): Promise<void> {
  const existing = await loadLocalPhotos();
  for (const id of Object.keys(existing)) if (!(id in photos)) await saveLocalPhoto(id, null);
  for (const [id, url] of Object.entries(photos)) if (existing[id] !== url) await saveLocalPhoto(id, url);
}
