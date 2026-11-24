import { describe, expect, it } from "vitest";
import type { Recipe } from "../types";
import { editsFromRecords, recordChanges } from "./recipeRecords";

const recipe = (id: string, name: string): Recipe => ({ id, name, category: "Mains", notes: "", yield: "", link: "", lines: [] });

describe("Recipe records", () => {
  it("overlay the original Recipes as edits: a body is an edit or an added Recipe, deleted is a removed Recipe", () => {
    const pie = recipe("r-1", "Spinach and feta pie");
    const soup = recipe("u-1", "Lentil soup");
    expect(
      editsFromRecords([
        { id: "r-1", body: pie, deleted: false },
        { id: "r-2", body: null, deleted: true },
        { id: "u-1", body: soup, deleted: false },
        { id: "u-2", body: recipe("u-2", "Toast"), deleted: true },
      ]),
    ).toEqual({ "r-1": pie, "r-2": null, "u-1": soup, "u-2": null });
  });

  it("save only the Recipes that changed", () => {
    const before = { "r-1": recipe("r-1", "Pie"), "r-2": recipe("r-2", "Stew") };
    const after = { "r-1": recipe("r-1", "Pie"), "r-2": recipe("r-2", "Beef stew"), "u-1": recipe("u-1", "Soup") };
    expect(recordChanges(before, after)).toEqual({
      save: [
        { id: "r-2", body: recipe("r-2", "Beef stew"), deleted: false },
        { id: "u-1", body: recipe("u-1", "Soup"), deleted: false, added: true },
      ],
      remove: [],
    });
  });

  it("treat the same Recipe with its fields in another order as unchanged", () => {
    const pie = recipe("r-1", "Pie");
    const reordered = Object.fromEntries(Object.entries(pie).reverse()) as unknown as Recipe;
    expect(recordChanges({ "r-1": pie }, { "r-1": reordered })).toEqual({ save: [], remove: [] });
  });

  it("mark a Recipe new to the Recipe Book as added, so it is saved with its Author", () => {
    const originals = new Set(["r-1", "r-2"]);
    const before = { "u-1": recipe("u-1", "Soup") };
    const after = {
      "u-1": recipe("u-1", "Lentil soup"),
      "u-2": recipe("u-2", "Toast"),
      "r-1": recipe("r-1", "Pie, my way"),
      "r-2": null,
    };
    expect(recordChanges(before, after, originals).save).toEqual([
      { id: "u-1", body: recipe("u-1", "Lentil soup"), deleted: false },
      { id: "u-2", body: recipe("u-2", "Toast"), deleted: false, added: true },
      { id: "r-1", body: recipe("r-1", "Pie, my way"), deleted: false },
      { id: "r-2", body: null, deleted: true },
    ]);
  });

  it("mark a deleted Recipe removed, and drop the record on Undo my changes", () => {
    const before = { "r-1": recipe("r-1", "Pie"), "r-2": null, "u-1": recipe("u-1", "Soup") };
    const after = { "r-1": null, "u-1": recipe("u-1", "Soup") };
    expect(recordChanges(before, after)).toEqual({
      save: [{ id: "r-1", body: null, deleted: true }],
      remove: ["r-2"],
    });
  });
});
