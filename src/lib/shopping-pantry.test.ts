import { describe, expect, it } from "vitest";
import seedJson from "../data/seed.json";
import type { Seed } from "../types";
import { buildShoppingList, compareStores, type Catalog } from "./costing";
import { addToPantry, buildPantry, correctPantry, pantryForList, tickGot, weekNetting } from "./kitchen";

const seed = seedJson as Seed;
const catalog = (store: Catalog["store"] = "woolworths"): Catalog => ({
  products: new Map(seed.products.map((p) => [p.key, p])),
  recipes: new Map(seed.recipes.map((r) => [r.id, r])),
  basis: "today",
  store,
});
// 2 batches need 630 g of baby marrows: 2 × 350 g packs at R32.99 at Woolworths.
const PLAN = [{ recipeId: "5-veg-mince-freezer-base", batches: 2 }];
const pantryWith = (productKey: string, amount: number) => buildPantry(addToPantry([], productKey, amount, "2026-11-20", "a1"));
const marrows = (list: ReturnType<typeof buildShoppingList>) => list.items.find((i) => i.product.key === "baby_marrows")!;

describe("Shopping List takes off what the Pantry covers", () => {
  it("an item the Pantry fully covers is covered, not to buy", () => {
    const today = buildShoppingList(PLAN, catalog());
    const list = buildShoppingList(PLAN, catalog(), { pantry: pantryWith("baby_marrows", 700) });
    const item = marrows(list);
    expect(item.coveredByPantry).toBe(true);
    expect(item.fromPantry).toBe(630);
    expect(item.packs).toBe(0);
    expect(item.cost).toBe(0);
    expect(list.total).toBeCloseTo(today.total - 65.98, 2);
  });

  it("a partly covered item buys only the remainder, rounded up to whole packs", () => {
    // 630 g less 300 g in the Pantry leaves 330 g: one 350 g pack.
    const item = marrows(buildShoppingList(PLAN, catalog(), { pantry: pantryWith("baby_marrows", 300) }));
    expect(item.coveredByPantry).toBe(false);
    expect(item.fromPantry).toBe(300);
    expect(item.toBuy).toBe(330);
    expect(item.packs).toBe(1);
    expect(item.cost).toBeCloseTo(32.99, 2);
    expect(item.leftover).toBe(20);
  });

  it("buy anyway restores an item to its full amount", () => {
    const today = buildShoppingList(PLAN, catalog());
    const list = buildShoppingList(PLAN, catalog(), { pantry: pantryWith("baby_marrows", 700), buyAnyway: ["baby_marrows"] });
    const item = marrows(list);
    expect(item.buyAnyway).toBe(true);
    expect(item.coveredByPantry).toBe(false);
    expect(item.fromPantry).toBe(0);
    expect(item.packs).toBe(2);
    expect(list.total).toBeCloseTo(today.total, 6);
  });

  it("Got on a partly covered item without a pack size adds only what was still to buy", () => {
    const products = new Map(seed.products.map((p) => [p.key, p]));
    products.set("eggs_loose", { ...seed.products[0], key: "eggs_loose", packSize: null, checkers: undefined });
    const recipe = { id: "x", name: "x", category: "Mains", notes: "", yield: "", link: "", lines: [{ id: "1", text: "x", kind: "product" as const, productKey: "eggs_loose", qty: 6 }] };
    const cat: Catalog = { products, recipes: new Map([["x", recipe]]), basis: "today" };
    const list = buildShoppingList([{ recipeId: "x", batches: 1 }], cat, { pantry: pantryWith("eggs_loose", 4) });
    expect(list.items[0].toBuy).toBe(2);
    const history = tickGot([], "2026-11-23", list, "eggs_loose", "2026-11-24");
    expect(history).toMatchObject([{ kind: "got", amount: 2 }]);
  });

  it("an item the Pantry covers isn't counted as unpriced", () => {
    const products = new Map(seed.products.map((p) => [p.key, p]));
    const unpriced = { ...seed.products[0], key: "mystery", today: null, regular: null };
    products.set("mystery", unpriced);
    const recipe = { id: "x", name: "x", category: "Mains", notes: "", yield: "", link: "", lines: [{ id: "1", text: "x", kind: "product" as const, productKey: "mystery", qty: 1 }] };
    const cat: Catalog = { products, recipes: new Map([["x", recipe]]), basis: "today" };
    expect(buildShoppingList([{ recipeId: "x", batches: 1 }], cat).unpriced).toBe(1);
    const list = buildShoppingList([{ recipeId: "x", batches: 1 }], cat, { pantry: pantryWith("mystery", 5) });
    expect(list.unpriced).toBe(0);
    expect(list.items[0].cost).toBe(0);
  });

  it("the store comparison costs only what's still to buy", () => {
    const today = compareStores(PLAN, catalog());
    const c = compareStores(PLAN, catalog(), { pantry: pantryWith("baby_marrows", 300) });
    // One pack still to buy: R32.99 at Woolworths, R34.99 at Checkers (400 g covers the 330 g).
    expect(c.byProduct.get("baby_marrows")).toEqual({ woolworths: 32.99, checkers: 34.99 });
    expect(c.woolworths.total).toBeCloseTo(today.woolworths.total - 32.99, 2);
    expect(c.checkers.total).toBeCloseTo(today.checkers.total - 34.99, 2);
    expect(c.split).toBeCloseTo(today.split - 32.99, 2);
  });

  it("ticking Got doesn't take the item off the Shopping List of the week it was Got for", () => {
    const WEEK = "2026-11-23";
    // Last week's Got is in the Pantry; this week's is what this list is buying.
    let history = tickGot([], "2026-11-16", buildShoppingList(PLAN, catalog()), "baby_marrows", "2026-11-17");
    history = correctPantry(history, "baby_marrows", 300, "2026-11-22", "c1");
    const before = buildShoppingList(PLAN, catalog(), { pantry: pantryForList(history, WEEK) });
    history = tickGot(history, WEEK, before, "baby_marrows", "2026-11-24");
    const after = buildShoppingList(PLAN, catalog(), { pantry: pantryForList(history, WEEK) });
    expect(marrows(after).packs).toBe(1);
    expect(marrows(after).fromPantry).toBe(300);
    expect(buildPantry(history).get("baby_marrows")?.amount).toBe(650);
  });

  it("a week's Plan and Shopping List cost the same: only what's still to buy", () => {
    const WEEK = "2026-11-23";
    const today = buildShoppingList(PLAN, catalog());
    // 700 g of baby marrows in the Pantry from last week covers the 630 g the Plan needs.
    const history = addToPantry([], "baby_marrows", 700, "2026-11-20", "a1");
    const week = buildShoppingList(PLAN, catalog(), weekNetting(history, WEEK, { buyAnyway: [] }));
    expect(week.total).toBeCloseTo(today.total - 65.98, 2);
    const anyway = buildShoppingList(PLAN, catalog(), weekNetting(history, WEEK, { buyAnyway: ["baby_marrows"] }));
    expect(anyway.total).toBeCloseTo(today.total, 6);
    // With no list for the week yet, nothing is set to Buy anyway.
    expect(buildShoppingList(PLAN, catalog(), weekNetting(history, WEEK)).total).toBeCloseTo(week.total, 6);
  });

  it("with an empty Pantry the list and totals are today's", () => {
    const plan = [
      { recipeId: "easy-chicken-pie", batches: 1 },
      { recipeId: "5-veg-mince-freezer-base", batches: 2 },
      { recipeId: "mince-in-gems", batches: 1 },
    ];
    for (const store of ["woolworths", "checkers"] as const) {
      const today = buildShoppingList(plan, catalog(store));
      const empty = buildShoppingList(plan, catalog(store), { pantry: buildPantry([]) });
      expect(empty).toEqual(today);
      for (const i of empty.items) {
        expect(i.toBuy).toBe(i.qty);
        expect(i.coveredByPantry).toBe(false);
      }
    }
  });
});
