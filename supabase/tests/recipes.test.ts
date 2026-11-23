import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { service, signInAs, type Role } from "./members";
import { editsFromRecords, recordChanges, type RecipeEdits } from "../../src/lib/recipeRecords";
import { loadRecipeRecords, writeRecipeRecords } from "../../src/lib/supabase";

/** One record per Recipe: an edited original, a removed original, and one added in the app. */
const EDITED = { id: "r-1", body: { id: "r-1", name: "Spinach pie" }, deleted: false };
const REMOVED = { id: "r-2", body: null, deleted: true };
const ADDED = { id: "u-1", body: { id: "u-1", name: "Lentil soup" }, deleted: false };
const RECORDS = [EDITED, REMOVED, ADDED];

beforeEach(async () => {
  for (const r of [
    await service.from("recipes").delete().neq("id", ""),
    await service.from("recipes").insert(RECORDS),
  ]) {
    if (r.error) throw r.error;
  }
});

function readRecipes(client: SupabaseClient) {
  return client.from("recipes").select("id, body, deleted").order("id");
}

/** What a fresh Viewer sees afterwards, so the check goes through the same rules as the app. */
async function recipesAfterwards() {
  return (await readRecipes((await signInAs("viewer")).client)).data;
}

describe("Recipe records", () => {
  it.each<Role>(["viewer", "editor", "admin"])("a Member with role %s can read them", async (role) => {
    const { client } = await signInAs(role);
    const { data, error } = await readRecipes(client);
    expect(error).toBeNull();
    expect(data).toEqual(RECORDS);
  });

  it("each record has no Author yet, and timestamps", async () => {
    const { client } = await signInAs("viewer");
    const { data } = await client.from("recipes").select("author_id, created_at, updated_at").eq("id", "r-1").single();
    expect(data?.author_id).toBeNull();
    expect(Date.parse(data?.created_at)).not.toBeNaN();
    expect(Date.parse(data?.updated_at)).not.toBeNaN();
  });

  it("a Viewer can't change or remove one they didn't author (recipe-authors.test.ts covers their own)", async () => {
    const { client } = await signInAs("viewer");
    const changed = await client.from("recipes").update({ body: { id: "r-1", name: "Mine now" } }).eq("id", "r-1");
    const removed = await client.from("recipes").delete().eq("id", "u-1");
    // Row-level security hides rows from update and delete rather than raising an error.
    expect(changed.error).toBeNull();
    expect(removed.error).toBeNull();
    expect(await recipesAfterwards()).toEqual(RECORDS);
  });

  it.each<Role>(["editor", "admin"])("a Member with role %s can add, change, mark removed and undo one", async (role) => {
    const { client, userId } = await signInAs(role);
    const added = { id: "u-2", body: { id: "u-2", name: "Toast" }, deleted: false };
    expect((await client.from("recipes").insert({ ...added, updated_by: userId })).error).toBeNull();
    const changed = { ...EDITED, body: { id: "r-1", name: "Spinach and feta pie" } };
    expect((await client.from("recipes").upsert(changed)).error).toBeNull();
    const markedRemoved = { id: "u-1", body: null, deleted: true };
    expect((await client.from("recipes").upsert(markedRemoved)).error).toBeNull();
    // "Undo my changes" on a removed original: its record goes, so the original shows again.
    expect((await client.from("recipes").delete().eq("id", "r-2")).error).toBeNull();
    expect(await recipesAfterwards()).toEqual([changed, markedRemoved, added]);
  });

  it("a record without a body must be marked removed", async () => {
    const { client } = await signInAs("editor");
    const { error } = await client.from("recipes").insert({ id: "u-3", body: null, deleted: false });
    expect(error).not.toBeNull();
  });

  it("changing a record moves its updated time on", async () => {
    const before = (await service.from("recipes").select("updated_at").eq("id", "r-1").single()).data!.updated_at;
    const { client } = await signInAs("editor");
    expect((await client.from("recipes").update({ body: { id: "r-1", name: "Pie" } }).eq("id", "r-1")).error).toBeNull();
    const after = (await service.from("recipes").select("updated_at").eq("id", "r-1").single()).data!.updated_at;
    expect(Date.parse(after)).toBeGreaterThan(Date.parse(before));
  });

  it("the app's edits round-trip through the records", async () => {
    const [editor, author] = await Promise.all([signInAs("editor"), signInAs("viewer")]);
    // Saving leaves a record's Author as it is.
    await service.from("recipes").update({ author_id: author.userId }).eq("id", "u-1");
    const before = editsFromRecords(await loadRecipeRecords(editor.client));
    const after = { ...before, "r-1": null, "u-1": { ...before["u-1"]!, name: "Red lentil soup" } } as RecipeEdits;
    delete after["r-2"];
    await writeRecipeRecords(editor.client, editor.userId, recordChanges(before, after));

    const viewer = await signInAs("viewer");
    expect(editsFromRecords(await loadRecipeRecords(viewer.client))).toEqual(after);
    const { data } = await service.from("recipes").select("author_id, updated_by").eq("id", "u-1").single();
    expect(data).toEqual({ author_id: author.userId, updated_by: editor.userId });
  });

  it("changes reach other Members live", async () => {
    const [viewer, editor] = await Promise.all([signInAs("viewer"), signInAs("editor")]);
    let saves = 0;
    let done = false;
    const received = new Promise<{ id: string; body: unknown }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no live update")), 20_000);
      const channel = viewer.client
        .channel("recipes-test")
        .on("postgres_changes", { event: "*", schema: "public", table: "recipes" }, (payload) => {
          clearTimeout(timer);
          done = true;
          void viewer.client.removeChannel(channel);
          resolve(payload.new as { id: string; body: unknown });
        })
        .subscribe(async (status) => {
          if (status !== "SUBSCRIBED") return;
          // A fresh local stack takes a moment to start sending changes after subscribing,
          // so the Editor keeps saving until the Viewer hears about it.
          while (!done) {
            const { error } = await editor.client
              .from("recipes")
              .upsert({ id: "u-9", body: { id: "u-9", name: `Live ${++saves}` }, deleted: false });
            if (error) return reject(error);
            await new Promise((r) => setTimeout(r, 500));
          }
        });
    });
    const row = await received;
    expect(row.id).toBe("u-9");
    expect(row.body).toEqual({ id: "u-9", name: expect.stringMatching(/^Live \d+$/) });
  });
});
