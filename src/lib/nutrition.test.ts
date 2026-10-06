import { describe, expect, it } from "vitest";
import seedJson from "../data/seed.json";
import type { Seed } from "../types";
import type { Catalog } from "./costing";
import { energySplit, gramsOf, productMacros, recipeNutrition } from "./nutrition";

const seed = seedJson as Seed;
const catalog: Catalog = {
  products: new Map(seed.products.map((p) => [p.key, p])),
  recipes: new Map(seed.recipes.map((r) => [r.id, r])),
  basis: "today",
};
const product = (k: string) => catalog.products.get(k)!;

describe("nutrition", () => {
  it("every product has nutrition and a unit weight where needed", () => {
    for (const p of seed.products) {
      expect(p.nutrition, p.key).toBeTruthy();
      if (p.unit !== "g" && p.unit !== "ml") expect(p.gramsPerUnit, p.key).toBeGreaterThan(0);
    }
  });

  it("every recipe has a portion count", () => {
    for (const r of seed.recipes) expect(r.servings, r.id).toBeGreaterThan(0);
  });

  it("converts counted units to grams", () => {
    expect(gramsOf(product("eggs"), 2)).toBe(100);
    expect(gramsOf(product("feta"), 50)).toBe(50);
    expect(productMacros(product("eggs"), 2)!.kcal).toBeCloseTo(143, 5);
  });

  it("adds up a recipe and divides by portions", () => {
    const r = catalog.recipes.get("loaded-avo-egg-bowl")!;
    const n = recipeNutrition(r, catalog);
    expect(n.servings).toBe(1);
    expect(n.perServing!.kcal).toBeCloseTo(n.total.kcal, 6);
    expect(n.total.kcal).toBeGreaterThan(300);
  });

  it("includes recipes used as ingredients", () => {
    const base = recipeNutrition(catalog.recipes.get("5-veg-mince-freezer-base")!, catalog);
    const gems = recipeNutrition(catalog.recipes.get("mince-in-gems")!, catalog);
    expect(gems.total.kcal).toBeGreaterThan(base.total.kcal);
  });

  it("lists ingredients it can't count", () => {
    const n = recipeNutrition(catalog.recipes.get("bovril-seed-crackers")!, catalog);
    expect(n.notCounted.map((x) => x.text)).toContain("1 Tbsp psyllium husk");
  });

  it("splits energy between macros", () => {
    const s = energySplit({ kcal: 0, protein: 10, carbs: 10, fat: 0, fibre: 0 });
    expect(s.protein).toBeCloseTo(0.5);
    expect(s.fat).toBe(0);
  });
});
