import type { Nutrition, Product, Recipe } from "../types";
import { expandRecipe, type Catalog, type LooseItem } from "./costing";

export type Macros = Nutrition;

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };

export function addMacros(a: Macros, b: Macros, times = 1): Macros {
  return {
    kcal: a.kcal + b.kcal * times,
    protein: a.protein + b.protein * times,
    carbs: a.carbs + b.carbs * times,
    fat: a.fat + b.fat * times,
    fibre: a.fibre + b.fibre * times,
  };
}

export function scaleMacros(m: Macros, by: number): Macros {
  return addMacros(ZERO, m, by);
}

/** Weight in grams (or ml) of `qty` of a product, or null if it can't be worked out. */
export function gramsOf(product: Product, qty: number): number | null {
  if (product.unit === "g" || product.unit === "ml") return qty;
  return product.gramsPerUnit ? qty * product.gramsPerUnit : null;
}

/** Nutrition for `qty` of a product, or null if the product has no nutrition info. */
export function productMacros(product: Product, qty: number): Macros | null {
  const grams = gramsOf(product, qty);
  if (grams == null || !product.nutrition) return null;
  return scaleMacros(product.nutrition, grams / 100);
}

export interface RecipeNutrition {
  /** The whole recipe, made once. */
  total: Macros;
  /** One portion, when the recipe says how many it serves. */
  perServing: Macros | null;
  servings: number | null;
  /** Ingredients left out of the totals: no nutrition info, not costed, or not at Woolworths. */
  notCounted: LooseItem[];
}

export function recipeNutrition(recipe: Recipe, catalog: Catalog): RecipeNutrition {
  const x = expandRecipe(recipe.id, 1, catalog);
  let total = ZERO;
  const notCounted: LooseItem[] = [...x.missing, ...x.problems];
  for (const need of x.needs) {
    const m = productMacros(catalog.products.get(need.productKey)!, need.qty);
    if (m) total = addMacros(total, m);
    else notCounted.push({ text: need.text, recipeId: need.recipeId });
  }
  const servings = recipe.servings && recipe.servings > 0 ? recipe.servings : null;
  return { total, perServing: servings ? scaleMacros(total, 1 / servings) : null, servings, notCounted };
}

/** Share of energy from each macro, for the little bar. Alcohol and fibre are left out. */
export function energySplit(m: Macros): { protein: number; carbs: number; fat: number } {
  const p = m.protein * 4;
  const c = m.carbs * 4;
  const f = m.fat * 9;
  const sum = p + c + f || 1;
  return { protein: p / sum, carbs: c / sum, fat: f / sum };
}
