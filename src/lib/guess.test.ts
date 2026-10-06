import { describe, expect, it } from "vitest";
import { guessQty } from "./guess";

describe("guessQty", () => {
  it("reads metric amounts", () => {
    expect(guessQty("500 g spinach", "g")).toBe(500);
    expect(guessQty("1 kg potatoes", "g")).toBe(1000);
    expect(guessQty("250ml cream", "ml")).toBe(250);
  });
  it("reads counts and fractions", () => {
    expect(guessQty("2 eggs", "ea")).toBe(2);
    expect(guessQty("½ lemon", "ea")).toBe(0.5);
    expect(guessQty("1½ punnets basil", "punnet")).toBe(1.5);
  });
  it("converts spoons and cups to ml", () => {
    expect(guessQty("1 cup milk", "ml")).toBe(250);
    expect(guessQty("2 Tbsp olive oil", "ml")).toBe(30);
  });
  it("gives up when units don't line up", () => {
    expect(guessQty("2 onions", "g")).toBeNull();
    expect(guessQty("Salt", "ea")).toBeNull();
  });
});
