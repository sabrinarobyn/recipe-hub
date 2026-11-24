import { describe, expect, it } from "vitest";
import { reviewGallery, type Review, type ReviewPhoto } from "./kitchen";

function review(id: string, recipeId: string, userId: string): Review {
  return { id, recipeId, userId, stars: 4, comment: null, createdAt: "2026-11-01T08:00:00Z", updatedAt: "2026-11-01T08:00:00Z" };
}
function photo(id: string, reviewId: string, createdAt: string): ReviewPhoto {
  return { id, reviewId, dataUrl: `data:image/jpeg;base64,${id}`, createdAt };
}

describe("a Recipe's Review photo gallery", () => {
  const reviews = [review("r-amy", "shakshuka", "amy"), review("r-ben", "shakshuka", "ben"), review("r-caz", "lentil-curry", "caz")];

  it("shows only that Recipe's Review photos, newest first, each with its reviewer", () => {
    const photos = [
      photo("p1", "r-amy", "2026-11-02T08:00:00Z"),
      photo("p2", "r-caz", "2026-11-05T08:00:00Z"),
      photo("p3", "r-ben", "2026-11-04T08:00:00Z"),
      photo("p4", "r-amy", "2026-11-03T08:00:00Z"),
    ];
    expect(reviewGallery(reviews, photos, "shakshuka").map((g) => [g.photo.id, g.review.userId])).toEqual([
      ["p3", "ben"],
      ["p4", "amy"],
      ["p1", "amy"],
    ]);
  });

  it("leaves out photos whose Review is gone", () => {
    expect(reviewGallery(reviews, [photo("p9", "r-deleted", "2026-11-02T08:00:00Z")], "shakshuka")).toEqual([]);
  });
});
