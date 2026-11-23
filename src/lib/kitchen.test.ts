import { describe, expect, it } from "vitest";
import seedJson from "../data/seed.json";
import type { Seed } from "../types";
import { buildShoppingList, type Catalog } from "./costing";
import { addToPantry, buildPantry, clearPantryItem, cookMeal, correctPantry, isCooked, tickGot, uncookMeal, untickGot, untickWeek, type PantryEvent } from "./kitchen";
import type { PlanEntry } from "../types";

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

describe("Cooked", () => {
  const meal = (recipeId: string, batches = 1, id = "meal-1"): PlanEntry => ({ id, date: "2026-11-25", slot: "dinner", recipeId, batches });

  it("takes the Recipe's Product amounts out of the Pantry", () => {
    let history = addToPantry([], "lean_mince", 1000, "2026-11-20");
    history = addToPantry(history, "baby_marrows", 700, "2026-11-20");
    history = cookMeal(history, meal("5-veg-mince-freezer-base"), catalog(), "2026-11-25");
    const pantry = buildPantry(history);
    expect(pantry.get("lean_mince")?.amount).toBe(500);
    expect(pantry.get("baby_marrows")?.amount).toBe(385);
  });

  it("un-marking Cooked restores exactly those amounts, and the meal is no longer Cooked", () => {
    let history = tickGot([], WEEK, vegMince(), "baby_marrows", "2026-11-24");
    history = addToPantry(history, "lean_mince", 1000, "2026-11-24");
    const before = buildPantry(history);
    history = cookMeal(history, meal("5-veg-mince-freezer-base"), catalog(), "2026-11-25");
    expect(isCooked(history, "meal-1")).toBe(true);
    history = uncookMeal(history, "meal-1");
    expect(isCooked(history, "meal-1")).toBe(false);
    expect(buildPantry(history)).toEqual(before);
  });

  it("scales by batches and takes out what sub-recipes use", () => {
    // Mince in Gems uses 1 × 5 Veg Mince (500 g lean mince) plus 6 gem squash and 80 g cheddar.
    let history = addToPantry([], "lean_mince", 1500, "2026-11-20");
    history = addToPantry(history, "gem_squash", 20, "2026-11-20");
    history = addToPantry(history, "cheddar_grated", 400, "2026-11-20");
    history = cookMeal(history, meal("mince-in-gems", 2), catalog(), "2026-11-25");
    const pantry = buildPantry(history);
    expect(pantry.get("lean_mince")?.amount).toBe(500);
    expect(pantry.get("gem_squash")?.amount).toBe(8);
    expect(pantry.get("cheddar_grated")?.amount).toBe(240);
  });

  it("cooking what the Pantry doesn't have leaves it at zero, never negative", () => {
    let history = addToPantry([], "cheddar_grated", 100, "2026-11-20");
    history = cookMeal(history, meal("mince-in-gems", 2), catalog(), "2026-11-25");
    let pantry = buildPantry(history);
    expect(pantry.has("cheddar_grated")).toBe(false);
    expect(pantry.has("lean_mince")).toBe(false);
    history = addToPantry(history, "lean_mince", 200, "2026-11-26");
    history = addToPantry(history, "cheddar_grated", 50, "2026-11-26");
    pantry = buildPantry(history);
    expect(pantry.get("lean_mince")?.amount).toBe(200);
    expect(pantry.get("cheddar_grated")?.amount).toBe(50);
  });

  it("marking the same meal Cooked twice takes its amounts out once", () => {
    let history = addToPantry([], "lean_mince", 1000, "2026-11-20");
    history = cookMeal(history, meal("5-veg-mince-freezer-base"), catalog(), "2026-11-25");
    history = cookMeal(history, meal("5-veg-mince-freezer-base"), catalog(), "2026-11-26");
    expect(buildPantry(history).get("lean_mince")?.amount).toBe(500);
  });

  it("only the Cooked meal uses up the Pantry; other Planned Meals change nothing", () => {
    let history = addToPantry([], "lean_mince", 1000, "2026-11-20");
    history = cookMeal(history, meal("5-veg-mince-freezer-base", 1, "monday"), catalog(), "2026-11-25");
    history = cookMeal(history, meal("5-veg-mince-freezer-base", 1, "tuesday"), catalog(), "2026-11-26");
    history = uncookMeal(history, "tuesday");
    expect(buildPantry(history).get("lean_mince")?.amount).toBe(500);
    expect(isCooked(history, "monday")).toBe(true);
    expect(isCooked(history, "wednesday")).toBe(false);
  });
});
