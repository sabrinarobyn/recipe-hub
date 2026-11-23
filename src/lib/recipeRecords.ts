import type { Recipe, UserData } from "../types";
import { stableStringify } from "./storage";

/**
 * The Recipe Book's recipes are stored as one record per Recipe (docs/adr/0001-one-record-per-recipe.md).
 * The app works with them as recipe edits laid over the original spreadsheet Recipes:
 *   a record with a body  ↔  an edited original or an added Recipe  (edits[id] = Recipe)
 *   a record marked deleted ↔ a removed Recipe                        (edits[id] = null)
 *   no record              ↔  the original as it is                    (no edits[id])
 */
export type RecipeEdits = UserData["recipeEdits"];

/** The part of a record the app reads and writes. The Author and timestamps are left to the database. */
export interface RecipeRecord {
  id: string;
  body: Recipe | null;
  deleted: boolean;
}

export function editsFromRecords(records: RecipeRecord[]): RecipeEdits {
  return Object.fromEntries(records.map((r) => [r.id, r.deleted ? null : r.body]));
}

export function recordFromEdit(id: string, edit: Recipe | null): RecipeRecord {
  return edit ? { id, body: edit, deleted: false } : { id, body: null, deleted: true };
}

/** The records to save and to remove so that the stored records go from `before` to `after`. */
export function recordChanges(before: RecipeEdits, after: RecipeEdits): { save: RecipeRecord[]; remove: string[] } {
  const save = Object.entries(after)
    .filter(([id, edit]) => !(id in before) || stableStringify(before[id]) !== stableStringify(edit))
    .map(([id, edit]) => recordFromEdit(id, edit));
  const remove = Object.keys(before).filter((id) => !(id in after));
  return { save, remove };
}
