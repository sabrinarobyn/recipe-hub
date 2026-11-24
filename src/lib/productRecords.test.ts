import { describe, expect, it } from "vitest";
import type { Product } from "../types";
import { catalogProductEdits, newProducts, productEditsWithAdded } from "./productRecords";

const product = (key: string, today: number): Product =>
  ({ key, name: key, today, regular: today, packSize: 100, unit: "g", note: "", link: "", section: "Pantry", updated: "2026-11-23" }) as Product;

describe("Products added by Members", () => {
  it("sit under the catalogue's edits, which change or remove them", () => {
    const added = { paprika: product("paprika", 30), cumin: product("cumin", 25), sumac: product("sumac", 40) };
    const catalog = { paprika: product("paprika", 28), cumin: null, eggs: product("eggs", 50) };
    expect(productEditsWithAdded(catalog, added)).toEqual({
      paprika: product("paprika", 28),
      cumin: null,
      sumac: product("sumac", 40),
      eggs: product("eggs", 50),
    });
  });

  it("stay out of the catalogue until an Editor changes them", () => {
    const added = { paprika: product("paprika", 30), sumac: product("sumac", 40) };
    const edits = { paprika: product("paprika", 28), sumac: product("sumac", 40), eggs: product("eggs", 50) };
    expect(catalogProductEdits(edits, added)).toEqual({ paprika: product("paprika", 28), eggs: product("eggs", 50) });
  });

  it("are the Products new to the catalogue: not stored before and not one of the originals", () => {
    const before = { sumac: product("sumac", 40), eggs: product("eggs", 50) };
    const after = { ...before, eggs: product("eggs", 45), paprika: product("paprika", 30), milk: product("milk", 20), gone: null };
    expect(newProducts(before, after, new Set(["milk"]))).toEqual([product("paprika", 30)]);
  });
});
