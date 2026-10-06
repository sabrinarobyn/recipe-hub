import type { UserData } from "../types";

const LOCAL_KEY = "recipe-hub:v1";

export function emptyUserData(): UserData {
  return { v: 1, settings: { priceBasis: "today" }, productEdits: {}, recipeEdits: {}, categories: [], plan: [], lists: {} };
}

/** Fill in any fields missing from older or hand-edited data. */
export function normalize(raw: unknown): UserData | null {
  if (!raw || typeof raw !== "object" || (raw as UserData).v !== 1) return null;
  const d = raw as Partial<UserData>;
  const base = emptyUserData();
  return {
    v: 1,
    settings: { ...base.settings, ...d.settings },
    productEdits: d.productEdits ?? {},
    recipeEdits: d.recipeEdits ?? {},
    categories: d.categories ?? [],
    plan: Array.isArray(d.plan) ? d.plan : [],
    lists: d.lists ?? {},
  };
}

export function loadLocal(): UserData | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveLocal(data: UserData): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked: the in-memory copy still works */
  }
}

/* ---------- Claude-hosted page: keep data in the viewer's private store ---------- */

interface DocSnap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface DocRef {
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  collection(path: string): CollectionRef;
}
interface CollectionRef {
  doc(id: string): DocRef;
  limit(n: number): { get(): Promise<{ docs: DocSnap[] }> };
}
interface ClaudeRuntime {
  use(name: string): Promise<unknown>;
}

export interface RemoteStore {
  load(): Promise<UserData | null>;
  save(data: UserData): Promise<void>;
  loadPhotos(): Promise<Record<string, string>>;
  setPhoto(recipeId: string, dataUrl: string | null): Promise<void>;
}

function claudeRuntime(): ClaudeRuntime | null {
  const c = (window as unknown as { claude?: ClaudeRuntime }).claude;
  return c && typeof c.use === "function" ? c : null;
}

/**
 * When the app runs as a Claude artifact, keep each person's data in their
 * own private documents so it follows them across devices. Resolves null
 * anywhere else (local dev, GitHub Pages), where browser storage is used.
 */
export async function connectRemote(): Promise<RemoteStore | null> {
  const claude = claudeRuntime();
  if (!claude) return null;
  const [db, user] = (await Promise.all([claude.use("db"), claude.use("user")])) as [
    { doc(path: string): DocRef } | null,
    { id(): Promise<string | null> } | null,
  ];
  if (!db || !user) return null;
  const id = await user.id();
  if (!id) return null;

  // Two documents keep each under the store's per-document size limit.
  const core = db.doc(`data/users/${id}/core`);
  const recipes = db.doc(`data/users/${id}/recipes`);
  // One document per photo, each well under the size limit.
  const photos = db.doc(`data/users/${id}/photos`).collection("items");
  const written: Record<string, string> = {};
  const queue: Record<string, Promise<void>> = {};

  function write(name: string, ref: DocRef, body: Record<string, unknown>): Promise<void> {
    const json = JSON.stringify(body);
    if (written[name] === json) return Promise.resolve();
    written[name] = json;
    // One write at a time per document.
    const next = (queue[name] ?? Promise.resolve()).then(() => ref.set(body));
    queue[name] = next.catch(() => {
      delete written[name];
    });
    return next;
  }

  return {
    async load() {
      const [c, r] = await Promise.all([core.get(), recipes.get()]);
      if (!c.exists && !r.exists) return null;
      const data = normalize({ ...(c.data() ?? {}), recipeEdits: r.data()?.recipeEdits ?? {} });
      if (data) {
        const { recipeEdits, ...rest } = data;
        written.core = JSON.stringify(rest);
        written.recipes = JSON.stringify({ recipeEdits });
      }
      return data;
    },
    async save(data) {
      const { recipeEdits, ...rest } = data;
      await Promise.all([write("core", core, rest), write("recipes", recipes, { recipeEdits })]);
    },
    async loadPhotos() {
      const snap = await photos.limit(1000).get();
      const out: Record<string, string> = {};
      for (const d of snap.docs) {
        const url = d.data()?.url;
        if (typeof url === "string") out[d.id] = url;
      }
      return out;
    },
    setPhoto(recipeId, dataUrl) {
      const ref = photos.doc(recipeId);
      const name = `photo:${recipeId}`;
      const next = (queue[name] ?? Promise.resolve()).then(() => (dataUrl ? ref.set({ url: dataUrl }) : ref.delete()));
      queue[name] = next.catch(() => {});
      return next;
    },
  };
}

/* ---------- files ---------- */

export async function saveFile(filename: string, text: string, type: string): Promise<boolean> {
  const claude = claudeRuntime();
  if (claude) {
    const downloads = (await claude.use("downloads")) as { save(r: { filename: string; data: string }): Promise<unknown> } | null;
    if (!downloads) return false;
    try {
      await downloads.save({ filename, data: text });
      return true;
    } catch {
      return false;
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function readFile(file: File): Promise<string> {
  return file.text();
}
