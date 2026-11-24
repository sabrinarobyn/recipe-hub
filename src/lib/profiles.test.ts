import { describe, expect, it } from "vitest";
import { initials, shouldAskForName, type Profile } from "./profiles";

describe("initials shown when a Member has no Profile photo", () => {
  it("takes the first letters of the first and last names", () => {
    expect(initials("Thandi Mokoena")).toBe("TM");
    expect(initials("sam van der berg")).toBe("SB");
  });

  it("uses one letter for a one-word name", () => {
    expect(initials("  Gogo ")).toBe("G");
  });

  it("shows a placeholder for a Member who hasn't set a display name", () => {
    expect(initials(null)).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});

describe("asking for a display name on first sign-in", () => {
  const profile = (p: Partial<Profile>): Profile => ({ userId: "u1", displayName: null, photo: null, nameAskedAt: null, ...p });

  it("asks a Member who has no Profile yet", () => {
    expect(shouldAskForName(undefined)).toBe(true);
  });

  it("asks a Member with no display name who hasn't been asked", () => {
    expect(shouldAskForName(profile({ photo: "data:image/jpeg;base64,AAAA" }))).toBe(true);
  });

  it("doesn't ask again once they skipped", () => {
    expect(shouldAskForName(profile({ nameAskedAt: "2026-11-23T07:00:00Z" }))).toBe(false);
  });

  it("doesn't ask a Member who already has a display name", () => {
    expect(shouldAskForName(profile({ displayName: "Thandi" }))).toBe(false);
  });
});
