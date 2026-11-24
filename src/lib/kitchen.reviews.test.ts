import { describe, expect, it } from "vitest";
import { byReviews, canDeleteReview, canEditReview, recipeReviews, reviewSummaries, type Review } from "./kitchen";

const AMY = "user-amy";
const BEN = "user-ben";
const CAZ = "user-caz";
const DAN = "user-dan";

function review(recipeId: string, userId: string, stars: number, createdAt = "2026-11-20T10:00:00Z", comment: string | null = null): Review {
  return { id: `${recipeId}:${userId}`, recipeId, userId, stars, comment, createdAt, updatedAt: createdAt };
}

describe("review summary", () => {
  it("gives each reviewed Recipe its average stars and number of Reviews", () => {
    const summaries = reviewSummaries([
      review("shakshuka", AMY, 5),
      review("shakshuka", BEN, 4),
      review("shakshuka", CAZ, 2),
      review("lentil-curry", AMY, 3),
    ]);
    expect(summaries.get("shakshuka")).toEqual({ average: 11 / 3, count: 3 });
    expect(summaries.get("lentil-curry")).toEqual({ average: 3, count: 1 });
  });

  it("leaves Recipes with no Reviews out", () => {
    expect(reviewSummaries([review("shakshuka", AMY, 5)]).has("lentil-curry")).toBe(false);
    expect(reviewSummaries([]).size).toBe(0);
  });
});

describe("a Recipe's Reviews", () => {
  it("are only that Recipe's, newest first", () => {
    const reviews = [
      review("shakshuka", AMY, 5, "2026-11-01T08:00:00Z"),
      review("lentil-curry", BEN, 3, "2026-11-22T08:00:00Z"),
      review("shakshuka", CAZ, 2, "2026-11-21T08:00:00Z"),
      review("shakshuka", BEN, 4, "2026-11-10T08:00:00Z"),
    ];
    expect(recipeReviews(reviews, "shakshuka").map((r) => r.userId)).toEqual([CAZ, BEN, AMY]);
  });
});

describe("review permissions", () => {
  const amysReview = review("shakshuka", AMY, 4);

  it.each(["viewer", "editor", "admin"] as const)("a %s can edit and delete their own Review", (role) => {
    const amy = { userId: AMY, role };
    expect(canEditReview(amy, amysReview)).toBe(true);
    expect(canDeleteReview(amy, amysReview)).toBe(true);
  });

  it.each(["viewer", "editor", "admin"] as const)("a %s can't edit someone else's Review", (role) => {
    expect(canEditReview({ userId: BEN, role }, amysReview)).toBe(false);
  });

  it("a Viewer can't delete someone else's Review", () => {
    expect(canDeleteReview({ userId: BEN, role: "viewer" }, amysReview)).toBe(false);
  });

  it.each(["editor", "admin"] as const)("an %s can delete any Review", (role) => {
    expect(canDeleteReview({ userId: BEN, role }, amysReview)).toBe(true);
  });

  it("someone not signed in or no longer on the invite list can do neither", () => {
    expect(canEditReview(null, amysReview)).toBe(false);
    expect(canDeleteReview(null, amysReview)).toBe(false);
    expect(canEditReview({ userId: AMY, role: null }, amysReview)).toBe(false);
    expect(canDeleteReview({ userId: AMY, role: null }, amysReview)).toBe(false);
  });
});

describe("sorting by Reviews", () => {
  it("puts the best average first, more Reviews first on a tie, and unreviewed Recipes last, otherwise keeping the order", () => {
    const summaries = reviewSummaries([
      review("toast", AMY, 3),
      review("shakshuka", AMY, 5),
      review("shakshuka", BEN, 4),
      review("pancakes", AMY, 5),
      review("pancakes", BEN, 4),
      review("pancakes", CAZ, 5),
      review("soup", AMY, 4),
      review("soup", BEN, 5),
      review("soup", CAZ, 4),
      review("soup", DAN, 5),
      review("toast-2", AMY, 3),
    ]);
    // pancakes 4.67 (3), soup 4.5 (4), shakshuka 4.5 (2), toast and toast-2 3 (1) in their given order, then the unreviewed.
    const ids = ["unreviewed-b", "toast-2", "shakshuka", "toast", "soup", "unreviewed-a", "pancakes"];
    expect([...ids].sort(byReviews(summaries))).toEqual(["pancakes", "soup", "shakshuka", "toast-2", "toast", "unreviewed-b", "unreviewed-a"]);
  });
});
