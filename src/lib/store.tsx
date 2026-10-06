import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import seedJson from "../data/seed.json";
import type { PlanEntry, Product, Recipe, Seed, UserData, WeekList } from "../types";
import { summarizeRecipe, type Catalog } from "./costing";
import { connectRemote, emptyUserData, loadLocal, saveLocal, type RemoteStore } from "./storage";

export const seed = seedJson as Seed;

export type SyncState = "browser" | "connecting" | "account" | "error";

function merge<T>(base: T[], keyOf: (t: T) => string, edits: Record<string, T | null>): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const item of base) {
    const k = keyOf(item);
    seen.add(k);
    if (k in edits) {
      const e = edits[k];
      if (e) out.push(e);
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

function useAppDataInternal() {
  const [data, setData] = useState<UserData>(() => loadLocal() ?? emptyUserData());
  const [sync, setSync] = useState<SyncState>("browser");
  const remote = useRef<RemoteStore | null>(null);
  const changedByUser = useRef(false);
  const latest = useRef(data);
  latest.current = data;

  useEffect(() => {
    let cancelled = false;
    setSync("connecting");
    connectRemote()
      .then(async (store) => {
        if (cancelled) return;
        if (!store) return setSync("browser");
        const saved = await store.load();
        remote.current = store;
        // Edits made while connecting win over the stored copy.
        if (saved && !changedByUser.current) {
          setData(saved);
          saveLocal(saved);
        } else {
          await store.save(latest.current);
        }
        if (!cancelled) setSync("account");
      })
      .catch(() => !cancelled && setSync("error"));
    return () => {
      cancelled = true;
    };
  }, []);

  const timer = useRef<number>();
  useEffect(() => {
    if (!changedByUser.current) return;
    saveLocal(data);
    const store = remote.current;
    if (!store) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      store.save(latest.current).then(
        () => setSync("account"),
        () => setSync("error"),
      );
    }, 700);
  }, [data]);

  const update = useCallback((fn: (d: UserData) => UserData) => {
    changedByUser.current = true;
    setData((d) => fn(d));
  }, []);

  const replaceAll = useCallback((next: UserData) => {
    changedByUser.current = true;
    setData(next);
  }, []);

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
        }),
      updatePrice: (key: string, field: "today" | "regular", value: number | null, date: string) =>
        update((d) => {
          const current = buildCatalog(d).products.get(key);
          if (!current) return d;
          return { ...d, productEdits: { ...d.productEdits, [key]: { ...current, [field]: value, updated: date } } };
        }),
      deleteProduct: (key: string) => update((d) => ({ ...d, productEdits: { ...d.productEdits, [key]: null } })),
      resetProduct: (key: string) =>
        update((d) => {
          const productEdits = { ...d.productEdits };
          delete productEdits[key];
          return { ...d, productEdits };
        }),
      saveRecipe: (r: Recipe) => update((d) => ({ ...d, recipeEdits: { ...d.recipeEdits, [r.id]: r } })),
      deleteRecipe: (id: string) =>
        update((d) => ({
          ...d,
          recipeEdits: { ...d.recipeEdits, [id]: null },
          plan: d.plan.filter((e) => e.recipeId !== id),
        })),
      resetRecipe: (id: string) =>
        update((d) => {
          const recipeEdits = { ...d.recipeEdits };
          delete recipeEdits[id];
          return { ...d, recipeEdits };
        }),
      addCategory: (name: string) =>
        update((d) => (d.categories.includes(name) ? d : { ...d, categories: [...d.categories, name] })),
      addToPlan: (entry: PlanEntry) => update((d) => ({ ...d, plan: [...d.plan, entry] })),
      updatePlanEntry: (id: string, patch: Partial<PlanEntry>) =>
        update((d) => ({ ...d, plan: d.plan.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      removePlanEntry: (id: string) => update((d) => ({ ...d, plan: d.plan.filter((e) => e.id !== id) })),
      setPlan: (plan: PlanEntry[]) => update((d) => ({ ...d, plan })),
      updateList: (week: string, fn: (l: WeekList) => WeekList) =>
        update((d) => ({ ...d, lists: { ...d.lists, [week]: fn(d.lists[week] ?? emptyList()) } })),
      replaceAll,
    }),
    [update, replaceAll],
  );

  return { data, catalog, sync, actions };
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
