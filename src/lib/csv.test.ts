import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";

describe("csv", () => {
  it("round-trips quotes, commas and newlines", () => {
    const rows = [{ Key: "a", Name: 'Say "hi", ok', Price: "1.50" }, { Key: "b", Name: "Two\nlines", Price: "" }];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it("accepts semicolons (Excel in South African locale)", () => {
    expect(parseCsv("Key;Price\nfeta;42.99\n")).toEqual([{ Key: "feta", Price: "42.99" }]);
  });
});
