import { describe, expect, it } from "vitest";
import { addDays, weekStart } from "./dates";

describe("dates", () => {
  it("finds the Monday of a week", () => {
    expect(weekStart("2026-10-06")).toBe("2026-10-05"); // Tuesday
    expect(weekStart("2026-10-11")).toBe("2026-10-05"); // Sunday
    expect(weekStart("2026-10-05")).toBe("2026-10-05");
  });
  it("crosses month ends", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
  });
});
