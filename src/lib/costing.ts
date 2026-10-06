import type { PriceBasis, Product, Recipe } from "../types";

export interface Catalog {
  products: Map<string, Product>;
  recipes: Map<string, Recipe>;
  basis: PriceBasis;
}

export function priceOf(p: Product, basis: PriceBasis): number | null {
  return basis === "regular" ? (p.regular ?? p.today) : (p.today ?? p.regular);
}

export function onPromotion(p: Product): boolean {
  return p.today != null && p.regular != null && p.today < p.regular;
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
export function usedCost(product: Product, qty: number, basis: PriceBasis): number | null {
  const price = priceOf(product, basis);
  if (price == null || !product.packSize) return null;
  return (qty / product.packSize) * price;
}

export interface ShoppingItem {
  product: Product;
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
  for (const [key, uses] of byProduct) {
    const product = catalog.products.get(key)!;
    const qty = uses.reduce((s, u) => s + u.qty, 0);
    const price = priceOf(product, catalog.basis);
    const packSize = product.packSize || 0;
    const packs = packSize ? packsFor(qty, packSize) : 1;
    const cost = price == null ? null : packs * price;
    const used = usedCost(product, qty, catalog.basis);
    if (cost == null) unpriced++;
    total += cost ?? 0;
    usedTotal += used ?? 0;
    items.push({ product, qty, packs, cost, usedCost: used, leftover: packSize ? packs * packSize - qty : 0, uses });
  }
  items.sort((a, b) => a.product.section.localeCompare(b.product.section) || a.product.name.localeCompare(b.product.name));

  return { items, basics: expansion.basics, missing: expansion.missing, problems: expansion.problems, total, usedTotal, unpriced };
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
    return usedCost(product, line.qty, catalog.basis);
  }
  if (line.kind === "recipe") {
    const sub = line.recipeId ? catalog.recipes.get(line.recipeId) : undefined;
    if (!sub) return null;
    return buildShoppingList([{ recipeId: sub.id, batches: line.qty ?? 1 }], catalog).usedTotal;
  }
  return 0;
}
