import type { PriceBasis, Product, Recipe, StoreId } from "../types";

export interface Catalog {
  products: Map<string, Product>;
  recipes: Map<string, Recipe>;
  basis: PriceBasis;
  /** Store to cost with. Defaults to Woolworths. */
  store?: StoreId;
}

export const STORE_NAMES: Record<StoreId, string> = { woolworths: "Woolworths", checkers: "Checkers" };

export function priceOf(p: Product, basis: PriceBasis): number | null {
  return basis === "regular" ? (p.regular ?? p.today) : (p.today ?? p.regular);
}

export function onPromotion(p: Product): boolean {
  return p.today != null && p.regular != null && p.today < p.regular;
}

/** What you'd actually buy for a product at a store. */
export interface Offer {
  store: StoreId;
  name: string;
  price: number | null;
  packSize: number | null;
  link: string;
  promo: boolean;
  /** The chosen store has no equivalent, so the Woolworths product stands in. */
  fallback: boolean;
}

export function offerFor(p: Product, store: StoreId = "woolworths", basis: PriceBasis = "today"): Offer {
  const c = p.checkers;
  if (store === "checkers" && c && c.match !== "none" && c.price != null && c.packSize) {
    return {
      store: "checkers",
      name: c.name,
      price: basis === "regular" ? (c.regular ?? c.price) : c.price,
      packSize: c.packSize,
      link: c.link,
      promo: c.regular != null && c.price < c.regular,
      fallback: false,
    };
  }
  return {
    store: "woolworths",
    name: p.name,
    price: priceOf(p, basis),
    packSize: p.packSize,
    link: p.link,
    promo: onPromotion(p),
    fallback: store !== "woolworths",
  };
}

/** Packs needed to cover qty. Tiny tolerance so 500 g of a 500 g pack is 1 pack, not 2. */
export function packsFor(qty: number, packSize: number): number {
  if (qty <= 0) return 0;
  return Math.max(1, Math.ceil(qty / packSize - 1e-9));
}

/** One product amount a recipe needs, after expanding recipes used as ingredients. */
export interface Need {
  productKey: string;
  qty: number;
  /** Top-level recipe the need came from. */
  recipeId: string;
  /** Ingredient text as written. */
  text: string;
}

export interface LooseItem {
  text: string;
  recipeId: string;
  note?: string;
}

export interface Expansion {
  needs: Need[];
  basics: LooseItem[];
  missing: LooseItem[];
  /** Lines that can't be costed: no product picked, product deleted, or no amount. */
  problems: LooseItem[];
}

/** Flatten a recipe (made `batches` times) into product amounts. */
export function expandRecipe(
  recipeId: string,
  batches: number,
  catalog: Catalog,
  into: Expansion = { needs: [], basics: [], missing: [], problems: [] },
  topId: string = recipeId,
  seen: Set<string> = new Set(),
): Expansion {
  const recipe = catalog.recipes.get(recipeId);
  if (!recipe || seen.has(recipeId)) return into;
  const path = new Set(seen).add(recipeId);
  for (const line of recipe.lines) {
    const item = { text: line.text, recipeId: topId, note: line.note };
    if (line.kind === "basic") into.basics.push(item);
    else if (line.kind === "missing") into.missing.push(item);
    else if (line.kind === "recipe") {
      if (!line.recipeId || !catalog.recipes.has(line.recipeId) || path.has(line.recipeId)) into.problems.push(item);
      else expandRecipe(line.recipeId, batches * (line.qty ?? 1), catalog, into, topId, path);
    } else {
      const product = line.productKey ? catalog.products.get(line.productKey) : undefined;
      if (!product || !line.qty || line.qty <= 0) into.problems.push(item);
      else into.needs.push({ productKey: product.key, qty: line.qty * batches, recipeId: topId, text: line.text });
    }
  }
  return into;
}

/** Cost of the share of each pack actually used. null when the product has no price or pack size. */
export function usedCost(product: Product, qty: number, catalog: Catalog): number | null {
  const offer = offerFor(product, catalog.store, catalog.basis);
  if (offer.price == null || !offer.packSize) return null;
  return (qty / offer.packSize) * offer.price;
}

export interface ShoppingItem {
  product: Product;
  offer: Offer;
  qty: number;
  packs: number;
  /** Full packs × price. null if the product has no price. */
  cost: number | null;
  usedCost: number | null;
  /** Amount left over in the last pack. */
  leftover: number;
  uses: Need[];
}

export interface ShoppingList {
  items: ShoppingItem[];
  basics: LooseItem[];
  missing: LooseItem[];
  problems: LooseItem[];
  /** Full packs to buy. */
  total: number;
  /** Value of what the recipes actually use. */
  usedTotal: number;
  unpriced: number;
  /** Items priced at Woolworths because the chosen store has no equivalent. */
  fallbacks: number;
}

export function buildShoppingList(entries: { recipeId: string; batches: number }[], catalog: Catalog): ShoppingList {
  const expansion: Expansion = { needs: [], basics: [], missing: [], problems: [] };
  for (const e of entries) expandRecipe(e.recipeId, e.batches, catalog, expansion);

  const byProduct = new Map<string, Need[]>();
  for (const need of expansion.needs) {
    const list = byProduct.get(need.productKey) ?? [];
    list.push(need);
    byProduct.set(need.productKey, list);
  }

  const items: ShoppingItem[] = [];
  let total = 0;
  let usedTotal = 0;
  let unpriced = 0;
  let fallbacks = 0;
  for (const [key, uses] of byProduct) {
    const product = catalog.products.get(key)!;
    const offer = offerFor(product, catalog.store, catalog.basis);
    const qty = uses.reduce((s, u) => s + u.qty, 0);
    const packSize = offer.packSize || 0;
    const packs = packSize ? packsFor(qty, packSize) : 1;
    const cost = offer.price == null ? null : packs * offer.price;
    const used = usedCost(product, qty, catalog);
    if (cost == null) unpriced++;
    if (offer.fallback) fallbacks++;
    total += cost ?? 0;
    usedTotal += used ?? 0;
    items.push({ product, offer, qty, packs, cost, usedCost: used, leftover: packSize ? packs * packSize - qty : 0, uses });
  }
  items.sort((a, b) => a.product.section.localeCompare(b.product.section) || a.product.name.localeCompare(b.product.name));

  return { items, basics: expansion.basics, missing: expansion.missing, problems: expansion.problems, total, usedTotal, unpriced, fallbacks };
}

export interface RecipeSummary {
  /** Cost of the share of each pack the recipe uses. */
  perMake: number;
  /** Full packs you'd buy to make it from scratch. */
  shop: number;
  substitutes: number;
  basics: number;
  missing: number;
  problems: number;
}

export function summarizeRecipe(recipe: Recipe, catalog: Catalog): RecipeSummary {
  const list = buildShoppingList([{ recipeId: recipe.id, batches: 1 }], catalog);
  return {
    perMake: list.usedTotal,
    shop: list.total,
    substitutes: recipe.lines.filter((l) => l.substitute).length,
    basics: list.basics.length,
    missing: list.missing.length,
    problems: list.problems.length + list.unpriced,
  };
}

/** Cost of one recipe line, for the recipe detail table. */
export function lineCost(line: Recipe["lines"][number], catalog: Catalog): number | null {
  if (line.kind === "product") {
    const product = line.productKey ? catalog.products.get(line.productKey) : undefined;
    if (!product || !line.qty) return null;
    return usedCost(product, line.qty, catalog);
  }
  if (line.kind === "recipe") {
    const sub = line.recipeId ? catalog.recipes.get(line.recipeId) : undefined;
    if (!sub) return null;
    return buildShoppingList([{ recipeId: sub.id, batches: line.qty ?? 1 }], catalog).usedTotal;
  }
  return 0;
}

export interface StoreComparison {
  woolworths: ShoppingList;
  checkers: ShoppingList;
  /** Buying each item wherever it's cheaper. */
  split: number;
  /** Items cheaper at Checkers in the split. */
  splitCheckers: number;
  /** Per product: full-pack cost at each store (Checkers null when there's no equivalent). */
  byProduct: Map<string, { woolworths: number | null; checkers: number | null }>;
}

/** Cost the same plan at both stores, and work out the cheapest split. */
export function compareStores(entries: { recipeId: string; batches: number }[], catalog: Catalog): StoreComparison {
  const woolworths = buildShoppingList(entries, { ...catalog, store: "woolworths" });
  const checkers = buildShoppingList(entries, { ...catalog, store: "checkers" });
  const byProduct = new Map<string, { woolworths: number | null; checkers: number | null }>();
  for (const i of woolworths.items) byProduct.set(i.product.key, { woolworths: i.cost, checkers: null });
  for (const i of checkers.items) {
    const row = byProduct.get(i.product.key)!;
    row.checkers = i.offer.fallback ? null : i.cost;
  }
  let split = 0;
  let splitCheckers = 0;
  for (const row of byProduct.values()) {
    const w = row.woolworths;
    const c = row.checkers;
    if (c != null && (w == null || c < w)) {
      split += c;
      splitCheckers++;
    } else split += w ?? 0;
  }
  return { woolworths, checkers, split, splitCheckers, byProduct };
}
