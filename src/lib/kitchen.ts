/**
 * The kitchen: each Member's Pantry, worked out from their pantry history.
 *
 * The Pantry is never stored as amounts. A Member's private data keeps a list
 * of pantry events (Got, Added, Correction…), and `buildPantry` folds them, in
 * order, into the amount left of each Product. Undoing something (un-ticking
 * Got) removes its event, so the amounts follow.
 *
 * To add a new kind of event (e.g. Cooked), add it to `PantryEvent`, give it a
 * case in `applyEvent`, and add functions that put it in and take it out of a
 * history.
 */
import type { PlanEntry } from "../types";
import { expandRecipe, usedCost, type Catalog, type ShoppingList } from "./costing";
import { uid } from "./format";

interface EventBase {
  /** Unique in the history. A Got's id is `gotId(week, productKey)`, one per week's item, so it can be un-ticked. */
  id: string;
  /** ISO date it happened. */
  at: string;
  productKey: string;
}

/** A Shopping List item ticked Got: adds its packs × pack size, in the Product's unit. */
export interface GotEvent extends EventBase {
  kind: "got";
  amount: number;
  /** Monday of the Shopping List's week. */
  week: string;
}

/** A Product put in by hand: adds the amount. */
export interface AddedEvent extends EventBase {
  kind: "added";
  amount: number;
}

/** A Correction: sets the Pantry Item to this amount (0 clears it). */
export interface CorrectionEvent extends EventBase {
  kind: "correction";
  amount: number;
}

/**
 * One Product a Cooked Planned Meal used: takes the amount out. A Cooked meal
 * puts one of these in the history per Product it uses, all with its `meal` id.
 */
export interface CookedEvent extends EventBase {
  kind: "cooked";
  amount: number;
  /** The Planned Meal's id. */
  meal: string;
}

export type PantryEvent = GotEvent | AddedEvent | CorrectionEvent | CookedEvent;

export interface PantryItem {
  productKey: string;
  /** Amount left, in the Product's unit. Always more than zero. */
  amount: number;
  /** ISO date it was last Got, or null if it was only added by hand since it was last empty. */
  lastGot: string | null;
}

/** Product key → Pantry Item. Only Products with something left are in it. */
export type Pantry = Map<string, PantryItem>;

export const gotId = (week: string, productKey: string) => `got:${week}:${productKey}`;

const later = (a: string | null, b: string) => (a == null || b > a ? b : a);

function applyEvent(item: PantryItem, e: PantryEvent): PantryItem {
  switch (e.kind) {
    case "got":
      return { ...item, amount: item.amount + e.amount, lastGot: later(item.lastGot, e.at) };
    case "added":
      return { ...item, amount: item.amount + e.amount };
    case "correction":
      return { ...item, amount: e.amount };
    case "cooked":
      return { ...item, amount: item.amount - e.amount };
  }
}

/** Fold a pantry history, oldest first, into a Pantry. */
export function buildPantry(history: readonly PantryEvent[]): Pantry {
  const pantry: Pantry = new Map();
  for (const e of history) {
    const item = pantry.get(e.productKey) ?? { productKey: e.productKey, amount: 0, lastGot: null };
    const next = applyEvent(item, e);
    // Never below zero; an empty item leaves the Pantry and starts afresh.
    if (next.amount > 0) pantry.set(e.productKey, next);
    else pantry.delete(e.productKey);
  }
  return pantry;
}

/** Amount of a Product left in the Pantry (0 if none). */
export function pantryAmount(pantry: Pantry, productKey: string): number {
  return pantry.get(productKey)?.amount ?? 0;
}

/**
 * The Pantry a week's Shopping List takes off: everything except that week's
 * own Got, so ticking an item Got doesn't then cover it on the same list.
 */
export function pantryForList(history: readonly PantryEvent[], week: string): Pantry {
  return buildPantry(history.filter((e) => !(e.kind === "got" && e.week === week)));
}

/**
 * Tick a Shopping List item Got. `list` is the week's Shopping List, for the
 * packs and pack size of the store it's costed at. Ticking again replaces the
 * week's earlier Got for that item.
 */
export function tickGot(history: readonly PantryEvent[], week: string, list: ShoppingList, productKey: string, at: string): PantryEvent[] {
  const item = list.items.find((i) => i.product.key === productKey);
  // Extras and basics aren't Products on the list, so they never enter the Pantry.
  if (!item) return [...history];
  const amount = item.offer.packSize ? item.packs * item.offer.packSize : item.toBuy;
  const id = gotId(week, productKey);
  return [...history.filter((e) => e.id !== id), { kind: "got", id, at, productKey, amount, week }];
}

/** Un-tick a Got: removes exactly what ticking it added. */
export function untickGot(history: readonly PantryEvent[], week: string, productKey: string): PantryEvent[] {
  const id = gotId(week, productKey);
  return history.filter((e) => e.id !== id);
}

/** Un-tick every Got of a week. */
export function untickWeek(history: readonly PantryEvent[], week: string): PantryEvent[] {
  return history.filter((e) => !(e.kind === "got" && e.week === week));
}

/** Put a Product in the Pantry by hand. */
export function addToPantry(history: readonly PantryEvent[], productKey: string, amount: number, at: string, id = uid()): PantryEvent[] {
  if (!(amount > 0)) return [...history];
  return [...history, { kind: "added", id, at, productKey, amount }];
}

/** Make a Correction: set a Pantry Item to an amount. Zero (or less) clears it. */
export function correctPantry(history: readonly PantryEvent[], productKey: string, amount: number, at: string, id = uid()): PantryEvent[] {
  return [...history, { kind: "correction", id, at, productKey, amount: Math.max(0, amount) }];
}

/** Clear a Pantry Item: a Correction to zero. */
export function clearPantryItem(history: readonly PantryEvent[], productKey: string, at: string, id = uid()): PantryEvent[] {
  return correctPantry(history, productKey, 0, at, id);
}

export const cookedId = (mealId: string, productKey: string) => `cooked:${mealId}:${productKey}`;

/**
 * Mark a Planned Meal Cooked: takes out each Product its Recipe uses, scaled by
 * its batches and expanded through sub-recipes the way the Shopping List is.
 * Marking it again replaces the earlier Cooked.
 */
export function cookMeal(history: readonly PantryEvent[], meal: PlanEntry, catalog: Catalog, at: string): PantryEvent[] {
  const used = new Map<string, number>();
  for (const n of expandRecipe(meal.recipeId, meal.batches, catalog).needs) used.set(n.productKey, (used.get(n.productKey) ?? 0) + n.qty);
  const cooked: CookedEvent[] = [...used].map(([productKey, amount]) => ({ kind: "cooked", id: cookedId(meal.id, productKey), at, productKey, amount, meal: meal.id }));
  return [...uncookMeal(history, meal.id), ...cooked];
}

/** Un-mark a Planned Meal Cooked: puts back exactly what marking it took out. */
export function uncookMeal(history: readonly PantryEvent[], mealId: string): PantryEvent[] {
  return history.filter((e) => !(e.kind === "cooked" && e.meal === mealId));
}

/** Whether a Planned Meal is Cooked. */
export function isCooked(history: readonly PantryEvent[], mealId: string): boolean {
  return history.some((e) => e.kind === "cooked" && e.meal === mealId);
}

// ── Suggestions ─────────────────────────────────────────────────────────────

/** A Recipe suggested from what's in the Pantry. */
export interface Suggestion {
  recipeId: string;
  /** Share of the Recipe's Product need the Pantry covers, 0–1, weighted by cost. */
  coverage: number;
  /** Pantry Items it would use, with the amount of each (up to what's left), by Product key. */
  uses: { productKey: string; amount: number }[];
}

/**
 * Recipes that use what's in the Pantry, best match first. A Recipe's match is
 * the share of its Product need (one batch, by cost) the Pantry covers.
 * Basics aren't Products, so they don't count. Recipes that use nothing in
 * the Pantry aren't suggested.
 */
export function suggestRecipes(pantry: Pantry, catalog: Catalog): Suggestion[] {
  if (pantry.size === 0) return [];
  const out: Suggestion[] = [];
  for (const recipe of catalog.recipes.values()) {
    const need = new Map<string, number>();
    for (const n of expandRecipe(recipe.id, 1, catalog).needs) need.set(n.productKey, (need.get(n.productKey) ?? 0) + n.qty);
    if (need.size === 0) continue;
    let total = 0;
    let covered = 0;
    let shares = 0;
    const uses: Suggestion["uses"] = [];
    for (const [key, qty] of need) {
      const have = Math.min(qty, pantryAmount(pantry, key));
      if (have > 0) uses.push({ productKey: key, amount: have });
      const product = catalog.products.get(key)!;
      total += usedCost(product, qty, catalog) ?? 0;
      covered += usedCost(product, have, catalog) ?? 0;
      shares += have / qty;
    }
    if (uses.length === 0) continue;
    // Unpriced Products can't be weighted by cost; fall back to an even share each.
    const coverage = total > 0 ? covered / total : shares / need.size;
    uses.sort((a, b) => a.productKey.localeCompare(b.productKey));
    out.push({ recipeId: recipe.id, coverage, uses });
  }
  return out.sort((a, b) => b.coverage - a.coverage);
}
