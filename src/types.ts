export type PriceBasis = "today" | "regular";

/** Per 100 g, or per 100 ml for liquids. */
export interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

export interface Product {
  key: string;
  name: string;
  /** Price on the shelf when last checked, including any promotion. */
  today: number | null;
  /** Price without promotion. */
  regular: number | null;
  packSize: number | null;
  /** Unit that recipe quantities for this product are measured in (g, ml, ea, punnet…). */
  unit: string;
  note: string;
  link: string;
  section: string;
  /** ISO date the price was last checked. */
  updated: string;
  nutrition?: Nutrition | null;
  /** Weight of one unit, for products counted in ea, punnets, cloves… */
  gramsPerUnit?: number | null;
}

export type LineKind = "product" | "recipe" | "basic" | "missing";

export interface IngredientLine {
  id: string;
  /** Ingredient as written in the recipe. */
  text: string;
  kind: LineKind;
  /** kind = product */
  productKey?: string;
  /** kind = recipe: another recipe used as an ingredient (e.g. 5 Veg Mince). */
  recipeId?: string;
  /** Amount in the product's unit, or number of batches for kind = recipe. */
  qty?: number | null;
  substitute?: boolean;
  note?: string;
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  notes: string;
  yield: string;
  /** Portions the recipe makes, for per-serving nutrition. */
  servings?: number | null;
  link: string;
  lines: IngredientLine[];
}

export interface Seed {
  pricesCaptured: string;
  notes: { label: string; text: string }[];
  excluded: { name: string; reason: string; link: string }[];
  categories: string[];
  products: Product[];
  recipes: Recipe[];
}

export type Slot = "breakfast" | "lunch" | "dinner" | "extras";

export interface PlanEntry {
  id: string;
  /** ISO date (yyyy-mm-dd). */
  date: string;
  slot: Slot;
  recipeId: string;
  /** How many times the recipe is made (0.5, 1, 2…). */
  batches: number;
}

export interface ExtraItem {
  id: string;
  text: string;
  price: number | null;
}

export interface WeekList {
  /** Product keys already at home: left off the estimate. */
  have: string[];
  /** Product keys / extra ids ticked off while shopping. */
  got: string[];
  extras: ExtraItem[];
}

export interface Settings {
  priceBasis: PriceBasis;
}

/** Everything the person changes. Seed data is never stored; only edits on top of it. */
export interface UserData {
  v: 1;
  settings: Settings;
  /** null = product deleted. */
  productEdits: Record<string, Product | null>;
  /** null = recipe deleted. */
  recipeEdits: Record<string, Recipe | null>;
  categories: string[];
  plan: PlanEntry[];
  /** Keyed by the Monday of the week (ISO date). */
  lists: Record<string, WeekList>;
}
