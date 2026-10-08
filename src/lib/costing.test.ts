import { describe, expect, it } from "vitest";
import seedJson from "../data/seed.json";
import sheet from "./__fixtures__/sheet-totals.json";
import type { Seed } from "../types";
import { buildShoppingList, compareStores, packsFor, summarizeRecipe, type Catalog } from "./costing";

const seed = seedJson as Seed;
const catalog = (basis: Catalog["basis"] = "today"): Catalog => ({
  products: new Map(seed.products.map((p) => [p.key, p])),
  recipes: new Map(seed.recipes.map((r) => [r.id, r])),
  basis,
});
const expected = sheet as Record<string, { perMake: number; shop: number }>;
const usesMince = new Set(["mince-in-gems", "mince-on-mushrooms", "low-carb-cottage-pie-cauli-mash"]);

describe("recipe costs match the spreadsheet", () => {
  for (const recipe of seed.recipes) {
    it(recipe.name, () => {
      const s = summarizeRecipe(recipe, catalog());
      expect(s.perMake).toBeCloseTo(expected[recipe.id].perMake, 2);
      if (usesMince.has(recipe.id)) {
        // The sheet buys the 5 Veg Mince packs separately; merging shared products can only save money.
        expect(s.shop).toBeLessThanOrEqual(expected[recipe.id].shop + 0.005);
      } else {
        expect(s.shop).toBeCloseTo(expected[recipe.id].shop, 2);
      }
    });
  }
});

describe("shopping list", () => {
  it("rounds up packs across the whole plan, not per recipe", () => {
    const one = buildShoppingList([{ recipeId: "5-veg-mince-freezer-base", batches: 1 }], catalog());
    const two = buildShoppingList([{ recipeId: "5-veg-mince-freezer-base", batches: 2 }], catalog());
    const marrows1 = one.items.find((i) => i.product.key === "baby_marrows")!;
    const marrows2 = two.items.find((i) => i.product.key === "baby_marrows")!;
    expect(marrows1.qty).toBe(315);
    expect(marrows1.packs).toBe(1);
    expect(marrows2.qty).toBe(630);
    expect(marrows2.packs).toBe(2);
    expect(two.usedTotal).toBeCloseTo(one.usedTotal * 2, 6);
  });

  it("expands recipes used as ingredients", () => {
    const list = buildShoppingList([{ recipeId: "mince-in-gems", batches: 1 }], catalog());
    expect(list.items.some((i) => i.product.key === "lean_mince")).toBe(true);
  });

  it("uses regular prices when asked", () => {
    const today = buildShoppingList([{ recipeId: "one-pot-lemon-chicken-orzo", batches: 1 }], catalog("today"));
    const regular = buildShoppingList([{ recipeId: "one-pot-lemon-chicken-orzo", batches: 1 }], catalog("regular"));
    expect(regular.total).toBeGreaterThanOrEqual(today.total);
  });

  it("packsFor tolerates float noise", () => {
    expect(packsFor(500, 500)).toBe(1);
    expect(packsFor(0.1 + 0.2, 0.3)).toBe(1);
    expect(packsFor(501, 500)).toBe(2);
    expect(packsFor(0, 500)).toBe(0);
  });
});

describe("store comparison", () => {
  const plan = [
    { recipeId: "easy-chicken-pie", batches: 1 },
    { recipeId: "spinach-feta-filo-tart", batches: 1 },
    { recipeId: "bovril-seed-crackers", batches: 1 },
  ];

  it("prices with the Checkers equivalent and its pack size", () => {
    const list = buildShoppingList([{ recipeId: "spinach-feta-filo-tart", batches: 1 }], { ...catalog(), store: "checkers" });
    const feta = list.items.find((i) => i.product.key === "feta")!;
    expect(feta.offer.store).toBe("checkers");
    expect(feta.offer.name).toMatch(/Fairview/);
    expect(feta.cost).toBeCloseTo(feta.packs * 23.99, 2);
  });

  it("falls back to Woolworths where Checkers has no equivalent", () => {
    const products = new Map(seed.products.map((p) => [p.key, p]));
    const noMatch = seed.products.find((p) => p.checkers?.match === "none")!;
    const recipe = { id: "x", name: "x", category: "Mains", notes: "", yield: "", link: "", lines: [{ id: "1", text: "x", kind: "product" as const, productKey: noMatch.key, qty: 1 }] };
    const cat: Catalog = { products, recipes: new Map([["x", recipe]]), basis: "today", store: "checkers" };
    const list = buildShoppingList([{ recipeId: "x", batches: 1 }], cat);
    expect(list.fallbacks).toBe(1);
    expect(list.items[0].offer.store).toBe("woolworths");
  });

  it("the split is never dearer than either store", () => {
    const c = compareStores(plan, catalog());
    expect(c.split).toBeLessThanOrEqual(c.woolworths.total + 0.001);
    expect(c.split).toBeLessThanOrEqual(c.checkers.total + 0.001);
    expect(c.byProduct.size).toBe(c.woolworths.items.length);
  });

  it("every researched Checkers match has a price and pack size", () => {
    for (const p of seed.products) {
      expect(p.checkers, p.key).toBeTruthy();
      if (p.checkers!.match !== "none") {
        expect(p.checkers!.price, p.key).toBeGreaterThan(0);
        expect(p.checkers!.packSize, p.key).toBeGreaterThan(0);
      }
    }
  });
});
