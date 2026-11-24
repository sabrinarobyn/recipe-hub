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

/**
 * The part of a record the app reads and writes. Timestamps are left to the database.
 * `author_id` is read (empty for the originals); it's only written when a Recipe is `added`.
 */
export interface RecipeRecord {
  id: string;
  body: Recipe | null;
  deleted: boolean;
  author_id?: string | null;
  /** A Recipe new to the Recipe Book: saved with the Member saving it as its Author. */
  added?: true;
}

/** Recipe id → its Author's user id, for the Recipes that have one. */
export type RecipeAuthors = Record<string, string>;

export function editsFromRecords(records: RecipeRecord[]): RecipeEdits {
  return Object.fromEntries(records.map((r) => [r.id, r.deleted ? null : r.body]));
}

export function authorsFromRecords(records: RecipeRecord[]): RecipeAuthors {
  return Object.fromEntries(records.filter((r) => r.author_id).map((r) => [r.id, r.author_id!]));
}

export function recordFromEdit(id: string, edit: Recipe | null): RecipeRecord {
  return edit ? { id, body: edit, deleted: false } : { id, body: null, deleted: true };
}

/**
 * The records to save and to remove so that the stored records go from `before` to `after`.
 * A Recipe that has no record yet and isn't one of the `originals` is marked `added`.
 */
export function recordChanges(
  before: RecipeEdits,
  after: RecipeEdits,
  originals: ReadonlySet<string> = new Set(),
): { save: RecipeRecord[]; remove: string[] } {
  const save = Object.entries(after)
    .filter(([id, edit]) => !(id in before) || stableStringify(before[id]) !== stableStringify(edit))
    .map(([id, edit]) => {
      const record = recordFromEdit(id, edit);
      return !(id in before) && !originals.has(id) && edit ? { ...record, added: true as const } : record;
    });
  const remove = Object.keys(before).filter((id) => !(id in after));
  return { save, remove };
}
