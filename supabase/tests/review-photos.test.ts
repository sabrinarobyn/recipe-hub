import { describe, expect, it } from "vitest";
import { anonymous, hearLive, service, signInAs, signInNotInvited, type Role, type SignedIn } from "./members";
import { addReviewPhoto, deleteReview, deleteReviewPhoto, loadReviewPhotos, onReviewPhotos, saveReview } from "../../src/lib/supabase";

/**
 * Review photos: a Member attaches small JPEG data URLs to their own Review. Each test reviews its
 * own Recipe, so tests sharing the database don't see each other's photos.
 */
let n = 0;
const freshRecipe = () => `review-photo-test-${Date.now()}-${++n}`;
const jpeg = (tag: string) => `data:image/jpeg;base64,${btoa(tag)}`;

async function reviewOf(as: SignedIn) {
  return saveReview(as.client, as.userId, { recipeId: freshRecipe(), stars: 4, comment: null });
}

/** The photos of a Review as a fresh Viewer sees them, through the same rules as the app. */
async function photosAfterwards(reviewId: string): Promise<string[]> {
  const viewer = await signInAs("viewer");
  return (await loadReviewPhotos(viewer.client))
    .filter((p) => p.reviewId === reviewId)
    .map((p) => p.dataUrl)
    .sort();
}

describe("Review photos", () => {
  it.each<Role>(["viewer", "editor", "admin"])("a Member with role %s can add photos to their own Review", async (role) => {
    const me = await signInAs(role);
    const review = await reviewOf(me);
    const added = await addReviewPhoto(me.client, review.id, jpeg("plated"));
    expect(added).toMatchObject({ reviewId: review.id, dataUrl: jpeg("plated") });
    await addReviewPhoto(me.client, review.id, jpeg("leftovers"));
    expect(await photosAfterwards(review.id)).toEqual([jpeg("leftovers"), jpeg("plated")].sort());
  });

  it.each<Role>(["viewer", "editor", "admin"])("a Member with role %s can't add photos to someone else's Review", async (role) => {
    const reviewer = await signInAs("viewer");
    const review = await reviewOf(reviewer);
    const other = await signInAs(role);
    await expect(addReviewPhoto(other.client, review.id, jpeg("not mine"))).rejects.toMatchObject({ code: "42501" });
    expect(await photosAfterwards(review.id)).toEqual([]);
  });

  it("someone not on the invite list can't add or read Review photos", async () => {
    const reviewer = await signInAs("viewer");
    const review = await reviewOf(reviewer);
    await addReviewPhoto(reviewer.client, review.id, jpeg("plated"));
    const outsider = await signInNotInvited();
    expect((await loadReviewPhotos(outsider.client)).filter((p) => p.reviewId === review.id)).toEqual([]);
    expect((await anonymous().from("review_photos").select("id")).data ?? []).toEqual([]);
  });

  it("an over-size image, or something that isn't an image, is refused", async () => {
    const me = await signInAs("viewer");
    const review = await reviewOf(me);
    const prefix = "data:image/jpeg;base64,";
    await expect(addReviewPhoto(me.client, review.id, prefix + "A".repeat(400_001 - prefix.length))).rejects.toBeTruthy();
    await expect(addReviewPhoto(me.client, review.id, "https://example.com/cake.jpg")).rejects.toBeTruthy();
    // Right at the limit is fine.
    await addReviewPhoto(me.client, review.id, prefix + "A".repeat(400_000 - prefix.length));
    expect(await photosAfterwards(review.id)).toHaveLength(1);
  });

  it("the reviewer can remove their own photos", async () => {
    const me = await signInAs("viewer");
    const review = await reviewOf(me);
    const photo = await addReviewPhoto(me.client, review.id, jpeg("blurry"));
    await addReviewPhoto(me.client, review.id, jpeg("sharp"));
    await deleteReviewPhoto(me.client, photo.id);
    expect(await photosAfterwards(review.id)).toEqual([jpeg("sharp")]);
  });

  it("a Viewer can't delete someone else's Review photo", async () => {
    const reviewer = await signInAs("viewer");
    const review = await reviewOf(reviewer);
    const photo = await addReviewPhoto(reviewer.client, review.id, jpeg("plated"));
    await deleteReviewPhoto((await signInAs("viewer")).client, photo.id);
    expect(await photosAfterwards(review.id)).toEqual([jpeg("plated")]);
  });

  it.each<Role>(["editor", "admin"])("a Member with role %s can delete any Review photo", async (role) => {
    const reviewer = await signInAs("viewer");
    const review = await reviewOf(reviewer);
    const photo = await addReviewPhoto(reviewer.client, review.id, jpeg("off-topic"));
    await deleteReviewPhoto((await signInAs(role)).client, photo.id);
    expect(await photosAfterwards(review.id)).toEqual([]);
  });

  it.each<Role>(["viewer", "editor", "admin"])("a Member with role %s can read every Member's Review photos", async (role) => {
    const amy = await signInAs("viewer");
    const ben = await signInAs("editor");
    const amys = await reviewOf(amy);
    const bens = await reviewOf(ben);
    await addReviewPhoto(amy.client, amys.id, jpeg("amy"));
    await addReviewPhoto(ben.client, bens.id, jpeg("ben"));
    const reader = await signInAs(role);
    const seen = (await loadReviewPhotos(reader.client)).filter((p) => p.reviewId === amys.id || p.reviewId === bens.id);
    expect(seen.map((p) => [p.reviewId, p.dataUrl]).sort()).toEqual(
      [
        [amys.id, jpeg("amy")],
        [bens.id, jpeg("ben")],
      ].sort(),
    );
  });

  it("deleting a Review removes its photos, and re-reviewing keeps them", async () => {
    const me = await signInAs("viewer");
    const review = await reviewOf(me);
    await addReviewPhoto(me.client, review.id, jpeg("plated"));
    // Changing the Review's stars keeps the same Review, so its photos stay.
    await saveReview(me.client, me.userId, { recipeId: review.recipeId, stars: 2, comment: "Second try" });
    expect(await photosAfterwards(review.id)).toEqual([jpeg("plated")]);
    await deleteReview(me.client, review.id);
    expect(await photosAfterwards(review.id)).toEqual([]);
    expect((await service.from("review_photos").select("id").eq("review_id", review.id)).data).toEqual([]);
  });

  it("a Member sees another Member's Review photo arrive and go, live", async () => {
    const amy = await signInAs("viewer");
    const ben = await signInAs("editor");
    const review = await reviewOf(amy);
    const events: string[] = [];
    let photoId: string | undefined;

    await hearLive<void>({
      client: ben.client,
      listen: (on) =>
        void onReviewPhotos(
          ben.client,
          (change) => {
            if (change.kind === "added" && change.photo.reviewId === review.id && !photoId) {
              on.stopChanging();
              events.push("added");
              photoId = change.photo.id;
              void deleteReviewPhoto(amy.client, photoId);
            } else if (change.kind === "deleted" && photoId && change.id === photoId) {
              events.push("deleted");
              on.heard();
            }
          },
          on.subscribed,
        ),
      change: () => addReviewPhoto(amy.client, review.id, jpeg("live")),
    });
    expect(events).toEqual(["added", "deleted"]);
  });
});
