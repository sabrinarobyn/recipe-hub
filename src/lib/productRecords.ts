import type { Product, UserData } from "../types";
import { stableStringify } from "./storage";

/**
 * Products any Member adds while writing a Recipe live in the `products` table, one record each,
 * added once and never changed there. Editors change Products in the shared catalogue block, whose
 * edits overlay the added Products as they overlay the original spreadsheet ones. The app sees one
 * set of Product edits: the added Products with the catalogue's edits on top.
 */
export type ProductEdits = UserData["productEdits"];

/** Product key → a Product a Member added. */
export type AddedProducts = Record<string, Product>;

export function productEditsWithAdded(catalogEdits: ProductEdits, added: AddedProducts): ProductEdits {
  return { ...added, ...catalogEdits };
}

/** The Product edits to keep in the catalogue: everything except added Products left as they were added. */
export function catalogProductEdits(edits: ProductEdits, added: AddedProducts): ProductEdits {
  return Object.fromEntries(
    Object.entries(edits).filter(([key, p]) => !(key in added) || stableStringify(p) !== stableStringify(added[key])),
  );
}

/** Products in `after` that weren't in `before` and aren't one of the `originals`: new to the catalogue. */
export function newProducts(before: ProductEdits, after: ProductEdits, originals: ReadonlySet<string>): Product[] {
  return Object.entries(after)
    .filter(([key, p]) => p && !(key in before) && !originals.has(key))
    .map(([, p]) => p!);
}
