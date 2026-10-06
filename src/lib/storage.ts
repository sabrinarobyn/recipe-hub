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

/* ---------- the two halves of the data ---------- */

/** Recipes, prices, categories: the owner's shared recipe book. */
export interface Book {
  productEdits: UserData["productEdits"];
  recipeEdits: UserData["recipeEdits"];
  categories: string[];
}
/** Each person's own plan, lists and settings. */
export type Personal = Pick<UserData, "v" | "settings" | "plan" | "lists">;

export function pickBook(d: UserData): Book {
  return { productEdits: d.productEdits, recipeEdits: d.recipeEdits, categories: d.categories };
}
export function pickPersonal(d: UserData): Personal {
  return { v: 1, settings: d.settings, plan: d.plan, lists: d.lists };
}
function bookFrom(raw: Record<string, unknown> | undefined): Partial<Book> {
  return {
    productEdits: (raw?.productEdits as Book["productEdits"]) ?? {},
    recipeEdits: (raw?.recipeEdits as Book["recipeEdits"]) ?? {},
    categories: Array.isArray(raw?.categories) ? (raw!.categories as string[]) : [],
  };
}

/** JSON with sorted keys, so the same data always compares equal whatever order the store returns. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

/* ---------- Claude-hosted page ---------- */

interface DocSnap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
  metadata?: { hasPendingWrites: boolean };
}
interface DbError {
  code: string;
}
interface DocRef {
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  collection(path: string): CollectionRef;
  onSnapshot(next: (s: DocSnap) => void, error?: (e: DbError) => void): () => void;
}
interface CollectionRef {
  doc(id: string): DocRef;
  limit(n: number): {
    get(): Promise<{ docs: DocSnap[] }>;
    onSnapshot(next: (s: { docs: DocSnap[] }) => void, error?: (e: DbError) => void): () => void;
  };
}
interface Db {
  doc(path: string): DocRef;
  collection(path: string): CollectionRef;
}
interface UserApi {
  id(): Promise<string | null>;
  isOwner(): Promise<boolean>;
  canEdit(): Promise<boolean>;
}
interface ClaudeRuntime {
  use(name: string): Promise<unknown>;
}

export interface RemoteStore {
  /** Owner and Editors change the shared book; everyone else reads it. */
  canEditBook: boolean;
  isOwner: boolean;
  loadBook(): Promise<Book | null>;
  saveBook(b: Book): Promise<void>;
  /** Live updates to the book from other devices and people. */
  onBook(cb: (b: Book) => void): () => void;
  loadPersonal(): Promise<Personal | null>;
  /** Rejects when this viewer can't save to their account (view-only access). */
  savePersonal(p: Personal): Promise<void>;
  loadPhotos(): Promise<Record<string, string>>;
  setPhoto(recipeId: string, dataUrl: string | null): Promise<void>;
  onPhotos(cb: (p: Record<string, string>) => void): () => void;
  /** The owner's data from before the book was shared (all private, under their own id). */
  loadLegacy(): Promise<{ data: UserData | null; photos: Record<string, string> }>;
}

export type Connection = { kind: "none" } | { kind: "signed-out" } | { kind: "ok"; store: RemoteStore };

function claudeRuntime(): ClaudeRuntime | null {
  const c = (window as unknown as { claude?: ClaudeRuntime }).claude;
  return c && typeof c.use === "function" ? c : null;
}

function photoMap(docs: DocSnap[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of docs) {
    const url = d.data()?.url;
    if (typeof url === "string") out[d.id] = url;
  }
  return out;
}

/**
 * When the app runs as a Claude artifact:
 * - the recipe book (recipes, prices, photos) lives in shared documents under
 *   data/book, which everyone the page is shared with can read, and only the
 *   owner and Editors can change;
 * - each person's plan, lists and settings live in their own private
 *   documents under data/users/<id>.
 * Resolves "none" anywhere else (local dev, GitHub Pages), where browser
 * storage is used, and "signed-out" when the viewer can't reach the data.
 */
export async function connectRemote(): Promise<Connection> {
  const claude = claudeRuntime();
  if (!claude) return { kind: "none" };
  const [db, user] = (await Promise.all([claude.use("db"), claude.use("user")])) as [Db | null, UserApi | null];
  if (!db) return { kind: "signed-out" };
  const [id, isOwner, canEdit] = user ? await Promise.all([user.id(), user.isOwner(), user.canEdit()]) : [null, false, false];

  const catalogDoc = db.doc("data/book/parts/catalog");
  const recipesDoc = db.doc("data/book/parts/recipes");
  const photos = db.collection("data/book/photos");
  const personalDoc = id ? db.doc(`data/users/${id}/personal`) : null;

  const written: Record<string, string> = {};
  const queue: Record<string, Promise<void>> = {};

  /** Write a document unless it's unchanged; one write at a time per document. */
  function write(name: string, ref: DocRef, body: Record<string, unknown>): Promise<void> {
    const json = stableStringify(body);
    if (written[name] === json) return Promise.resolve();
    written[name] = json;
    const next = (queue[name] ?? Promise.resolve()).then(() => ref.set(body));
    queue[name] = next.catch(() => {
      delete written[name];
    });
    return next;
  }

  const catalogBody = (b: Book) => ({ productEdits: b.productEdits, categories: b.categories });
  const recipesBody = (b: Book) => ({ recipeEdits: b.recipeEdits });

  return {
    kind: "ok",
    store: {
      canEditBook: canEdit || isOwner,
      isOwner,
      async loadBook() {
        const [c, r] = await Promise.all([catalogDoc.get(), recipesDoc.get()]);
        if (!c.exists && !r.exists) return null;
        const book = { ...bookFrom(c.data()), recipeEdits: bookFrom(r.data()).recipeEdits } as Book;
        written.catalog = stableStringify(catalogBody(book));
        written.recipes = stableStringify(recipesBody(book));
        return book;
      },
      async saveBook(b) {
        await Promise.all([write("catalog", catalogDoc, catalogBody(b)), write("recipes", recipesDoc, recipesBody(b))]);
      },
      onBook(cb) {
        let catalog: Record<string, unknown> | undefined;
        let recipes: Record<string, unknown> | undefined;
        const seen = new Set<string>();
        let changed = false;
        const emit = (name: "catalog" | "recipes", snap: DocSnap) => {
          if (snap.metadata?.hasPendingWrites) return;
          const body = snap.data();
          if (name === "catalog") catalog = body;
          else recipes = body;
          seen.add(name);
          const json = stableStringify(body ?? {});
          // Unchanged means it's our own write coming back.
          if (written[name] !== json) {
            written[name] = json;
            changed = true;
          }
          // Wait for both halves so a partial book never replaces the whole one.
          if (seen.size < 2 || !changed) return;
          changed = false;
          cb({ ...bookFrom(catalog), recipeEdits: bookFrom(recipes).recipeEdits } as Book);
        };
        const u1 = catalogDoc.onSnapshot((s) => emit("catalog", s), () => {});
        const u2 = recipesDoc.onSnapshot((s) => emit("recipes", s), () => {});
        return () => (u1(), u2());
      },
      async loadPersonal() {
        if (!personalDoc) return null;
        const snap = await personalDoc.get();
        if (!snap.exists) return null;
        const d = normalize({ v: 1, ...snap.data() });
        if (!d) return null;
        const p = pickPersonal(d);
        written.personal = stableStringify(p);
        return p;
      },
      savePersonal(p) {
        if (!personalDoc) return Promise.reject({ code: "invalid_argument" });
        return write("personal", personalDoc, p as unknown as Record<string, unknown>);
      },
      async loadPhotos() {
        return photoMap((await photos.limit(1000).get()).docs);
      },
      setPhoto(recipeId, dataUrl) {
        const ref = photos.doc(recipeId);
        const name = `photo:${recipeId}`;
        const next = (queue[name] ?? Promise.resolve()).then(() => (dataUrl ? ref.set({ url: dataUrl }) : ref.delete()));
        queue[name] = next.catch(() => {});
        return next;
      },
      onPhotos(cb) {
        return photos.limit(1000).onSnapshot(
          (s) => cb(photoMap(s.docs)),
          () => {},
        );
      },
      async loadLegacy() {
        if (!id) return { data: null, photos: {} };
        const [c, r, p] = await Promise.all([
          db.doc(`data/users/${id}/core`).get(),
          db.doc(`data/users/${id}/recipes`).get(),
          db.doc(`data/users/${id}/photos`).collection("items").limit(1000).get(),
        ]);
        const data = c.exists || r.exists ? normalize({ ...(c.data() ?? {}), v: 1, recipeEdits: r.data()?.recipeEdits ?? {} }) : null;
        return { data, photos: photoMap(p.docs) };
      },
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
