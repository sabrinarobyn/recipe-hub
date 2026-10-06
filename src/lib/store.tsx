import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import seedJson from "../data/seed.json";
import type { PlanEntry, Product, Recipe, Seed, UserData, WeekList } from "../types";
import { summarizeRecipe, type Catalog } from "./costing";
import { recipeNutrition } from "./nutrition";
import { connectRemote, emptyUserData, loadLocal, pickBook, pickPersonal, saveLocal, type Book, type RemoteStore } from "./storage";
import { loadLocalPhotos, replaceLocalPhotos, saveLocalPhoto, type Photos } from "./photos";

export const seed = seedJson as Seed;

function merge<T>(base: T[], keyOf: (t: T) => string, edits: Record<string, T | null>): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const item of base) {
    const k = keyOf(item);
    seen.add(k);
    if (k in edits) {
      const e = edits[k];
      // Fields added since the edit was saved (like nutrition) come from the original.
      if (e) out.push({ ...item, ...e });
    } else out.push(item);
  }
  for (const [k, e] of Object.entries(edits)) if (!seen.has(k) && e) out.push(e);
  return out;
}

export function buildCatalog(data: UserData): Catalog & { productList: Product[]; recipeList: Recipe[]; categories: string[] } {
  const productList = merge(seed.products, (p) => p.key, data.productEdits);
  const recipeList = merge(seed.recipes, (r) => r.id, data.recipeEdits);
  const categories = [...new Set([...seed.categories, ...data.categories, ...recipeList.map((r) => r.category)])]
    .filter(Boolean)
    .sort();
  return {
    products: new Map(productList.map((p) => [p.key, p])),
    recipes: new Map(recipeList.map((r) => [r.id, r])),
    basis: data.settings.priceBasis,
    productList,
    recipeList,
    categories,
  };
}

export type AppCatalog = ReturnType<typeof buildCatalog>;

export const emptyList = (): WeekList => ({ have: [], got: [], extras: [] });

export type SyncState = {
  /** Where the recipe book lives: this browser, live shared copy, or unreachable. */
  book: "local" | "connecting" | "live" | "signed-out" | "error";
  /** Where this person's plan and lists are saved. */
  personal: "browser" | "account";
};

type Kind = "book" | "personal" | "both";

function useAppDataInternal() {
  const [data, setData] = useState<UserData>(() => loadLocal() ?? emptyUserData());
  const [sync, setSync] = useState<SyncState>({ book: "connecting", personal: "browser" });
  const [canEditBook, setCanEditBook] = useState(true);
  const [photos, setPhotos] = useState<Photos>({});
  const remote = useRef<RemoteStore | null>(null);
  const personalRemote = useRef(false);
  const changed = useRef<{ book: boolean; personal: boolean }>({ book: false, personal: false });
  /** A book edit is waiting to be saved: ignore incoming copies until it is. */
  const bookDirty = useRef(false);
  const canEditRef = useRef(true);
  canEditRef.current = canEditBook;
  const notifier = useRef<(m: string) => void>(() => {});
  const latest = useRef(data);
  latest.current = data;
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const applyBook = useCallback((book: Book) => {
    setData((d) => {
      const next = { ...d, ...book };
      saveLocal(next);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unsubs: (() => void)[] = [];
    (async () => {
      const localPhotos = await loadLocalPhotos();
      if (cancelled) return;
      setPhotos((p) => ({ ...localPhotos, ...p }));
      const conn = await connectRemote();
      if (cancelled) return;
      if (conn.kind === "none") return setSync({ book: "local", personal: "browser" });
      if (conn.kind === "signed-out") {
        setCanEditBook(false);
        return setSync({ book: "signed-out", personal: "browser" });
      }
      const store = conn.store;
      setCanEditBook(store.canEditBook);
      let [book, personal, sharedPhotos] = await Promise.all([store.loadBook(), store.loadPersonal(), store.loadPhotos()]);
      const savedPersonal = personal != null;

      // First run of the shared book: the owner moves in what they already have.
      if (!book && store.isOwner) {
        const legacy = await store.loadLegacy();
        const source = legacy.data ?? latest.current;
        book = pickBook(source);
        personal = personal ?? (legacy.data ? pickPersonal(legacy.data) : null);
        await store.saveBook(book);
        sharedPhotos = Object.keys(legacy.photos).length ? legacy.photos : photosRef.current;
        for (const [id, url] of Object.entries(sharedPhotos)) await store.setPhoto(id, url);
      }
      if (cancelled) return;
      remote.current = store;

      if (!changed.current.book) applyBook(book ?? { productEdits: {}, recipeEdits: {}, categories: [] });
      if (personal && !changed.current.personal) {
        setData((d) => ({ ...d, ...personal }));
        // A plan carried over from before sharing still needs saving in its new place.
        personalRemote.current = savedPersonal
          ? true
          : await store.savePersonal(personal).then(
              () => true,
              () => false,
            );
      } else {
        // Save this browser's plan to the account; view-only viewers keep it in the browser.
        personalRemote.current = await store.savePersonal(pickPersonal(latest.current)).then(
          () => true,
          () => false,
        );
      }
      await replaceLocalPhotos(sharedPhotos);
      if (cancelled) return;
      setPhotos(sharedPhotos);
      setSync({ book: "live", personal: personalRemote.current ? "account" : "browser" });
      // Book edits made while connecting haven't been saved anywhere yet.
      if (changed.current.book && store.canEditBook) await store.saveBook(pickBook(latest.current));
      bookDirty.current = false;

      unsubs.push(
        store.onBook((b) => {
          if (!bookDirty.current) applyBook(b);
        }),
        store.onPhotos((p) => {
          setPhotos(p);
          replaceLocalPhotos(p).catch(() => {});
        }),
      );
    })().catch(() => !cancelled && setSync((s) => ({ ...s, book: "error" })));
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [applyBook]);

  const blocked = useCallback(() => {
    notifier.current("Only the owner can change recipes, prices and photos. Your plan and shopping list are yours to change.");
  }, []);

  const setPhoto = useCallback(
    async (recipeId: string, dataUrl: string | null) => {
      if (!canEditRef.current) return blocked();
      setPhotos((p) => {
        const next = { ...p };
        if (dataUrl) next[recipeId] = dataUrl;
        else delete next[recipeId];
        return next;
      });
      await saveLocalPhoto(recipeId, dataUrl);
      await remote.current?.setPhoto(recipeId, dataUrl);
    },
    [blocked],
  );

  const replacePhotos = useCallback(
    async (next: Photos) => {
      if (!canEditRef.current) return;
      const before = photosRef.current;
      setPhotos(next);
      await replaceLocalPhotos(next);
      const store = remote.current;
      if (!store) return;
      for (const id of Object.keys(before)) if (!(id in next)) await store.setPhoto(id, null);
      for (const [id, url] of Object.entries(next)) if (before[id] !== url) await store.setPhoto(id, url);
    },
    [],
  );

  const timer = useRef<number>();
  useEffect(() => {
    const { book, personal } = changed.current;
    if (!book && !personal) return;
    saveLocal(data);
    const store = remote.current;
    if (!store) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const d = latest.current;
      try {
        if (canEditRef.current) await store.saveBook(pickBook(d));
        bookDirty.current = false;
        setSync((s) => ({ ...s, book: "live" }));
      } catch {
        setSync((s) => ({ ...s, book: "error" }));
      }
      if (personalRemote.current) {
        await store.savePersonal(pickPersonal(d)).catch(() => {
          personalRemote.current = false;
          setSync((s) => ({ ...s, personal: "browser" }));
        });
      }
    }, 700);
  }, [data]);

  const update = useCallback(
    (fn: (d: UserData) => UserData, kind: Kind = "personal") => {
      if (kind !== "personal" && !canEditRef.current) return blocked();
      if (kind !== "personal") {
        changed.current.book = true;
        bookDirty.current = true;
      }
      if (kind !== "book") changed.current.personal = true;
      setData((d) => fn(d));
    },
    [blocked],
  );

  const replaceAll = useCallback(
    (next: UserData) => {
      // People who can't edit the book only replace their own plan and lists.
      if (!canEditRef.current) return update((d) => ({ ...d, ...pickPersonal(next) }), "personal");
      update(() => next, "both");
    },
    [update],
  );

  const catalog = useMemo(() => buildCatalog(data), [data]);

  /* ---- actions ---- */
  const actions = useMemo(
    () => ({
      setPriceBasis: (priceBasis: UserData["settings"]["priceBasis"]) =>
        update((d) => ({ ...d, settings: { ...d.settings, priceBasis } })),
      saveProduct: (p: Product, previousKey?: string) =>
        update((d) => {
          const productEdits = { ...d.productEdits, [p.key]: p };
          if (previousKey && previousKey !== p.key) productEdits[previousKey] = null;
          return { ...d, productEdits };
        }, "book"),
      updatePrice: (key: string, field: "today" | "regular", value: number | null, date: string) =>
        update((d) => {
          const current = buildCatalog(d).products.get(key);
          if (!current) return d;
          return { ...d, productEdits: { ...d.productEdits, [key]: { ...current, [field]: value, updated: date } } };
        }, "book"),
      deleteProduct: (key: string) => update((d) => ({ ...d, productEdits: { ...d.productEdits, [key]: null } }), "book"),
      resetProduct: (key: string) =>
        update((d) => {
          const productEdits = { ...d.productEdits };
          delete productEdits[key];
          return { ...d, productEdits };
        }, "book"),
      saveRecipe: (r: Recipe) => update((d) => ({ ...d, recipeEdits: { ...d.recipeEdits, [r.id]: r } }), "book"),
      deleteRecipe: (id: string) => {
        if (!canEditRef.current) return blocked();
        if (photosRef.current[id]) setPhoto(id, null).catch(() => {});
        update((d) => ({
          ...d,
          recipeEdits: { ...d.recipeEdits, [id]: null },
          plan: d.plan.filter((e) => e.recipeId !== id),
        }), "both");
      },
      resetRecipe: (id: string) =>
        update((d) => {
          const recipeEdits = { ...d.recipeEdits };
          delete recipeEdits[id];
          return { ...d, recipeEdits };
        }, "book"),
      addCategory: (name: string) =>
        update((d) => (d.categories.includes(name) ? d : { ...d, categories: [...d.categories, name] }), "book"),
      addToPlan: (entry: PlanEntry) => update((d) => ({ ...d, plan: [...d.plan, entry] })),
      updatePlanEntry: (id: string, patch: Partial<PlanEntry>) =>
        update((d) => ({ ...d, plan: d.plan.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      removePlanEntry: (id: string) => update((d) => ({ ...d, plan: d.plan.filter((e) => e.id !== id) })),
      setPlan: (plan: PlanEntry[]) => update((d) => ({ ...d, plan })),
      updateList: (week: string, fn: (l: WeekList) => WeekList) =>
        update((d) => ({ ...d, lists: { ...d.lists, [week]: fn(d.lists[week] ?? emptyList()) } })),
      replaceAll,
      setPhoto,
      replacePhotos,
    }),
    [update, replaceAll, setPhoto, replacePhotos, blocked],
  );

  const setNotifier = useCallback((fn: (m: string) => void) => {
    notifier.current = fn;
  }, []);

  return { data, catalog, sync, actions, photos, canEditBook, setNotifier };
}

type AppData = ReturnType<typeof useAppDataInternal>;
const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const value = useAppDataInternal();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}

/** Cost summary for every recipe, recomputed only when the data changes. */
export function useSummaries() {
  const { catalog } = useApp();
  return useMemo(
    () => new Map(catalog.recipeList.map((r) => [r.id, summarizeRecipe(r, catalog)])),
    [catalog],
  );
}

/** Whether a recipe or product differs from the spreadsheet: "new", "edited" or null. */
export function editState(edits: Record<string, unknown>, baseIds: Set<string>, id: string): "new" | "edited" | null {
  if (!(id in edits)) return null;
  return baseIds.has(id) ? "edited" : "new";
}

export const seedRecipeIds = new Set(seed.recipes.map((r) => r.id));
export const seedProductKeys = new Set(seed.products.map((p) => p.key));

/** Calories and macros for every recipe, recomputed only when the data changes. */
export function useNutrition() {
  const { catalog } = useApp();
  return useMemo(() => new Map(catalog.recipeList.map((r) => [r.id, recipeNutrition(r, catalog)])), [catalog]);
}
