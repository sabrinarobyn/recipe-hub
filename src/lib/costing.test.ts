import { describe, expect, it } from "vitest";
import seedJson from "../data/seed.json";
import sheet from "./__fixtures__/sheet-totals.json";
import type { Seed } from "../types";
import { buildShoppingList, packsFor, summarizeRecipe, type Catalog } from "./costing";

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
