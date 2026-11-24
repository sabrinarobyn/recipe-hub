import { describe, expect, it } from "vitest";
import { anonymous, hearLive, service, signInAs, signInNotInvited, type Role, type SignedIn } from "./members";
import { deleteReview, loadReviews, onReviews, saveReview } from "../../src/lib/supabase";
import type { Review } from "../../src/lib/kitchen";

/**
 * Reviews: one per Member and Recipe, 1 to 5 stars and an optional comment. Each test reviews its
 * own Recipe id, so tests sharing the database don't see each other's Reviews.
 */
let n = 0;
const freshRecipe = () => `review-test-${Date.now()}-${++n}`;

async function reviewsOf(as: SignedIn, recipeId: string): Promise<Review[]> {
  return (await loadReviews(as.client)).filter((r) => r.recipeId === recipeId);
}

/** What a fresh Viewer sees afterwards, through the same rules as the app. */
async function reviewsAfterwards(recipeId: string) {
  const reviews = await reviewsOf(await signInAs("viewer"), recipeId);
  return reviews.map((r) => ({ userId: r.userId, stars: r.stars, comment: r.comment }));
}

describe("Reviews", () => {
  it.each<Role>(["viewer", "editor", "admin"])("a Member with role %s can add, change and delete their own", async (role) => {
    const me = await signInAs(role);
    // An original spreadsheet Recipe has no record; it can still be reviewed.
    const recipeId = freshRecipe();

    const added = await saveReview(me.client, me.userId, { recipeId, stars: 4, comment: "Needed more salt" });
    expect(added).toMatchObject({ recipeId, userId: me.userId, stars: 4, comment: "Needed more salt" });
    expect(await reviewsAfterwards(recipeId)).toEqual([{ userId: me.userId, stars: 4, comment: "Needed more salt" }]);

    // A second Review replaces the first rather than adding another.
    const changed = await saveReview(me.client, me.userId, { recipeId, stars: 5, comment: null });
    expect(changed.id).toBe(added.id);
    expect(changed.createdAt).toBe(added.createdAt);
    expect(await reviewsAfterwards(recipeId)).toEqual([{ userId: me.userId, stars: 5, comment: null }]);

    await deleteReview(me.client, added.id);
    expect(await reviewsAfterwards(recipeId)).toEqual([]);
  });

  it("stars outside 1 to 5 are refused", async () => {
    const me = await signInAs("viewer");
    const recipeId = freshRecipe();
    for (const stars of [0, 6, -1, 2.5]) {
      await expect(saveReview(me.client, me.userId, { recipeId, stars, comment: null })).rejects.toBeTruthy();
    }
    expect(await reviewsAfterwards(recipeId)).toEqual([]);
    await saveReview(me.client, me.userId, { recipeId, stars: 1, comment: null });
    await expect(saveReview(me.client, me.userId, { recipeId, stars: 9, comment: null })).rejects.toBeTruthy();
    expect(await reviewsAfterwards(recipeId)).toEqual([{ userId: me.userId, stars: 1, comment: null }]);
  });

  it.each<Role>(["viewer", "editor", "admin"])("a Member with role %s can't write a Review as someone else", async (role) => {
    const owner = await signInAs("viewer");
    const recipeId = freshRecipe();
    const review = await saveReview(owner.client, owner.userId, { recipeId, stars: 4, comment: "Lovely" });
    const other = await signInAs(role);

    // Not as another Member, on a Recipe they reviewed or one they didn't.
    await expect(saveReview(other.client, owner.userId, { recipeId, stars: 1, comment: "Not mine" })).rejects.toMatchObject({ code: "42501" });
    await expect(saveReview(other.client, owner.userId, { recipeId: freshRecipe(), stars: 1, comment: null })).rejects.toMatchObject({ code: "42501" });
    // Row-level security hides the row from update rather than raising an error.
    await other.client.from("reviews").update({ stars: 1, comment: "Changed" }).eq("id", review.id);
    await other.client.from("reviews").update({ user_id: other.userId }).eq("id", review.id);

    expect(await reviewsAfterwards(recipeId)).toEqual([{ userId: owner.userId, stars: 4, comment: "Lovely" }]);
  });

  it("a Viewer can't delete someone else's Review", async () => {
    const owner = await signInAs("viewer");
    const recipeId = freshRecipe();
    const review = await saveReview(owner.client, owner.userId, { recipeId, stars: 4, comment: null });
    const other = await signInAs("viewer");
    await deleteReview(other.client, review.id);
    expect(await reviewsAfterwards(recipeId)).toEqual([{ userId: owner.userId, stars: 4, comment: null }]);
  });

  it.each<Role>(["editor", "admin"])("a Member with role %s can delete any Review", async (role) => {
    const owner = await signInAs("viewer");
    const recipeId = freshRecipe();
    const review = await saveReview(owner.client, owner.userId, { recipeId, stars: 2, comment: "Rude words" });
    const curator = await signInAs(role);
    await deleteReview(curator.client, review.id);
    expect(await reviewsAfterwards(recipeId)).toEqual([]);
  });

  it.each<Role>(["viewer", "editor", "admin"])("a Member with role %s can read every Member's Reviews", async (role) => {
    const recipeId = freshRecipe();
    const amy = await signInAs("viewer");
    const ben = await signInAs("editor");
    await saveReview(amy.client, amy.userId, { recipeId, stars: 5, comment: "Kids loved it" });
    await saveReview(ben.client, ben.userId, { recipeId, stars: 3, comment: null });

    const reader = await signInAs(role);
    const reviews = await reviewsOf(reader, recipeId);
    expect(reviews.map((r) => [r.userId, r.stars, r.comment]).sort()).toEqual(
      [
        [amy.userId, 5, "Kids loved it"],
        [ben.userId, 3, null],
      ].sort(),
    );
  });

  it("someone not on the invite list can't read Reviews or write one", async () => {
    const recipeId = freshRecipe();
    const amy = await signInAs("viewer");
    await saveReview(amy.client, amy.userId, { recipeId, stars: 5, comment: null });

    const outsider = await signInNotInvited();
    expect(await reviewsOf(outsider, recipeId)).toEqual([]);
    await expect(saveReview(outsider.client, outsider.userId, { recipeId, stars: 1, comment: null })).rejects.toMatchObject({ code: "42501" });
    expect((await anonymous().from("reviews").select("id")).data ?? []).toEqual([]);
    expect(await reviewsAfterwards(recipeId)).toEqual([{ userId: amy.userId, stars: 5, comment: null }]);
  });

  it("a Member's Reviews stay after they're taken off the invite list, but they can't change them any more", async () => {
    const recipeId = freshRecipe();
    const amy = await signInAs("viewer");
    const review = await saveReview(amy.client, amy.userId, { recipeId, stars: 4, comment: "Lovely" });
    expect((await service.from("members").delete().eq("email", amy.email)).error).toBeNull();

    expect(await reviewsAfterwards(recipeId)).toEqual([{ userId: amy.userId, stars: 4, comment: "Lovely" }]);
    await expect(saveReview(amy.client, amy.userId, { recipeId, stars: 1, comment: null })).rejects.toMatchObject({ code: "42501" });
    await deleteReview(amy.client, review.id);
    expect(await reviewsAfterwards(recipeId)).toEqual([{ userId: amy.userId, stars: 4, comment: "Lovely" }]);
  });

  it("a Member sees another Member's Review arrive and go, live", async () => {
    const recipeId = freshRecipe();
    const amy = await signInAs("viewer");
    const ben = await signInAs("editor");
    const events: string[] = [];
    let reviewId: string | undefined;

    await hearLive<void>({
      client: ben.client,
      listen: (on) =>
        void onReviews(
          ben.client,
          (change) => {
            if (change.kind === "saved" && change.review.recipeId === recipeId && !reviewId) {
              on.stopChanging();
              events.push(`saved ${change.review.stars}`);
              reviewId = change.review.id;
              void deleteReview(amy.client, reviewId);
            } else if (change.kind === "deleted" && reviewId && change.id === reviewId) {
              events.push("deleted");
              on.heard();
            }
          },
          on.subscribed,
        ),
      change: () => saveReview(amy.client, amy.userId, { recipeId, stars: 4, comment: null }),
    });
    expect(events).toEqual(["saved 4", "deleted"]);
  });
});
