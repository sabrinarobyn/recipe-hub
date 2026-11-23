import { describe, expect, it } from "vitest";
import seedJson from "../data/seed.json";
import type { Seed } from "../types";
import { buildShoppingList, type Catalog } from "./costing";
import { addToPantry, buildPantry, clearPantryItem, correctPantry, tickGot, untickGot, untickWeek, type PantryEvent } from "./kitchen";

const seed = seedJson as Seed;
const catalog = (store: Catalog["store"] = "woolworths"): Catalog => ({
  products: new Map(seed.products.map((p) => [p.key, p])),
  recipes: new Map(seed.recipes.map((r) => [r.id, r])),
  basis: "today",
  store,
});
const WEEK = "2026-11-23";
const vegMince = (store?: Catalog["store"]) => buildShoppingList([{ recipeId: "5-veg-mince-freezer-base", batches: 2 }], catalog(store));

describe("Got", () => {
  it("adds the item's packs × pack size to the Pantry", () => {
    // 2 batches need 630 g of baby marrows: 2 × 350 g packs at Woolworths.
    const history = tickGot([], WEEK, vegMince(), "baby_marrows", "2026-11-24");
    const pantry = buildPantry(history);
    expect(pantry.get("baby_marrows")).toEqual({ productKey: "baby_marrows", amount: 700, lastGot: "2026-11-24" });
  });

  it("uses the pack size of the store the list is for", () => {
    // Checkers sells baby marrows in 400 g packs: 2 packs cover 630 g.
    const pantry = buildPantry(tickGot([], WEEK, vegMince("checkers"), "baby_marrows", "2026-11-24"));
    expect(pantry.get("baby_marrows")?.amount).toBe(800);
  });

  it("un-ticking removes exactly that week's Got", () => {
    let history = tickGot([], "2026-11-16", vegMince(), "baby_marrows", "2026-11-17");
    history = tickGot(history, WEEK, vegMince(), "baby_marrows", "2026-11-24");
    history = untickGot(history, WEEK, "baby_marrows");
    expect(buildPantry(history).get("baby_marrows")).toEqual({ productKey: "baby_marrows", amount: 700, lastGot: "2026-11-17" });
    expect(buildPantry(untickGot(history, "2026-11-16", "baby_marrows")).has("baby_marrows")).toBe(false);
  });

  it("ticking the same item twice counts it once", () => {
    let history = tickGot([], WEEK, vegMince(), "baby_marrows", "2026-11-24");
    history = tickGot(history, WEEK, vegMince(), "baby_marrows", "2026-11-25");
    expect(buildPantry(history).get("baby_marrows")?.amount).toBe(700);
  });

  it("extras and basics never enter the Pantry", () => {
    const list = vegMince();
    let history: PantryEvent[] = tickGot([], WEEK, list, "extra-dishwasher-tabs", "2026-11-24");
    for (const b of list.basics) history = tickGot(history, WEEK, list, b.text, "2026-11-24");
    expect(history).toEqual([]);
    for (const i of list.items) history = tickGot(history, WEEK, list, i.product.key, "2026-11-24");
    expect([...buildPantry(history).keys()].sort()).toEqual(list.items.map((i) => i.product.key).sort());
  });
});

describe("Added and Correction", () => {
  it("a Product added by hand goes in with its amount and no Got date", () => {
    const history = addToPantry([], "feta", 150, "2026-11-20");
    expect(buildPantry(history).get("feta")).toEqual({ productKey: "feta", amount: 150, lastGot: null });
  });

  it("adds on top of what is already there", () => {
    let history = tickGot([], WEEK, vegMince(), "baby_marrows", "2026-11-24");
    history = addToPantry(history, "baby_marrows", 100, "2026-11-25");
    expect(buildPantry(history).get("baby_marrows")).toEqual({ productKey: "baby_marrows", amount: 800, lastGot: "2026-11-24" });
  });

  it("a Correction sets the amount, and later events build on it", () => {
    let history = tickGot([], WEEK, vegMince(), "baby_marrows", "2026-11-24");
    history = correctPantry(history, "baby_marrows", 250, "2026-11-26");
    expect(buildPantry(history).get("baby_marrows")?.amount).toBe(250);
    history = addToPantry(history, "baby_marrows", 50, "2026-11-27");
    expect(buildPantry(history).get("baby_marrows")).toEqual({ productKey: "baby_marrows", amount: 300, lastGot: "2026-11-24" });
  });

  it("a Correction to zero clears the item", () => {
    let history = addToPantry([], "feta", 150, "2026-11-20");
    history = correctPantry(history, "feta", 0, "2026-11-21");
    expect(buildPantry(history).has("feta")).toBe(false);
  });

  it("amounts never go below zero", () => {
    let history = correctPantry([], "feta", -40, "2026-11-21");
    expect(buildPantry(history).has("feta")).toBe(false);
    history = addToPantry(history, "feta", 100, "2026-11-22");
    expect(buildPantry(history).get("feta")?.amount).toBe(100);
  });

  it("clearing an item empties it, and a later Got starts it afresh", () => {
    let history = tickGot([], "2026-11-16", vegMince(), "baby_marrows", "2026-11-17");
    history = clearPantryItem(history, "baby_marrows", "2026-11-20");
    expect(buildPantry(history).has("baby_marrows")).toBe(false);
    history = tickGot(history, WEEK, buildShoppingList([{ recipeId: "5-veg-mince-freezer-base", batches: 1 }], catalog()), "baby_marrows", "2026-11-24");
    expect(buildPantry(history).get("baby_marrows")).toEqual({ productKey: "baby_marrows", amount: 350, lastGot: "2026-11-24" });
  });

  it("un-ticking a whole week removes only that week's Gots", () => {
    let history = tickGot([], "2026-11-16", vegMince(), "baby_marrows", "2026-11-17");
    history = addToPantry(history, "feta", 100, "2026-11-18");
    for (const i of vegMince().items) history = tickGot(history, WEEK, vegMince(), i.product.key, "2026-11-24");
    const pantry = buildPantry(untickWeek(history, WEEK));
    expect([...pantry.values()]).toEqual([
      { productKey: "baby_marrows", amount: 700, lastGot: "2026-11-17" },
      { productKey: "feta", amount: 100, lastGot: null },
    ]);
  });

  it("un-ticking a Got from before a Correction leaves the corrected amount", () => {
    let history = tickGot([], WEEK, vegMince(), "baby_marrows", "2026-11-24");
    history = correctPantry(history, "baby_marrows", 250, "2026-11-26");
    history = untickGot(history, WEEK, "baby_marrows");
    expect(buildPantry(history).get("baby_marrows")).toEqual({ productKey: "baby_marrows", amount: 250, lastGot: null });
  });
});
