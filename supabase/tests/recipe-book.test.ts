import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { service, signInAs, type Role } from "./members";

/** The Recipe Book is stored in two parts, as the app keeps it. */
const BOOK = [
  { part: "catalog", body: { productEdits: {}, categories: ["Mains"] } },
  { part: "recipes", body: { recipeEdits: { "r-1": { name: "Spinach pie" } } } },
];
const EDITED = { recipeEdits: { "r-1": { name: "Spinach and feta pie" } } };

const PHOTO = { recipe_id: "r-1", data_url: "data:image/jpeg;base64,AAAA" };

beforeEach(async () => {
  for (const r of [
    await service.from("book_parts").upsert(BOOK),
    await service.from("photos").delete().neq("recipe_id", ""),
    await service.from("photos").insert(PHOTO),
  ]) {
    if (r.error) throw r.error;
  }
});

async function readBook(client: SupabaseClient) {
  return client.from("book_parts").select("part, body").order("part");
}

async function readPhotos(client: SupabaseClient) {
  return client.from("photos").select("recipe_id, data_url").order("recipe_id");
}

/** What a fresh Viewer sees afterwards, so the check goes through the same rules as the app. */
async function bookAfterwards() {
  return (await readBook((await signInAs("viewer")).client)).data;
}

async function photosAfterwards() {
  return (await readPhotos((await signInAs("viewer")).client)).data;
}

describe("Recipe Book", () => {
  it.each<Role>(["viewer", "editor", "admin"])("a Member with role %s can read it", async (role) => {
    const { client } = await signInAs(role);
    const { data, error } = await readBook(client);
    expect(error).toBeNull();
    expect(data).toEqual(BOOK);
  });

  it("a Viewer can't change it", async () => {
    const { client } = await signInAs("viewer");
    const { error } = await client.from("book_parts").upsert({ part: "recipes", body: EDITED });
    expect(error?.code).toBe("42501");
    expect(await bookAfterwards()).toEqual(BOOK);
  });

  it.each<Role>(["editor", "admin"])("a Member with role %s can change it", async (role) => {
    const { client, userId } = await signInAs(role);
    const { error } = await client
      .from("book_parts")
      .upsert({ part: "recipes", body: EDITED, updated_by: userId });
    expect(error).toBeNull();
    expect(await bookAfterwards()).toEqual([BOOK[0], { part: "recipes", body: EDITED }]);
  });
});

describe("Recipe photos", () => {
  it.each<Role>(["viewer", "editor", "admin"])("a Member with role %s can see them", async (role) => {
    const { client } = await signInAs(role);
    const { data, error } = await readPhotos(client);
    expect(error).toBeNull();
    expect(data).toEqual([PHOTO]);
  });

  it("a Viewer can't add, replace or remove one", async () => {
    const { client } = await signInAs("viewer");
    const added = await client.from("photos").insert({ recipe_id: "r-2", data_url: "data:image/jpeg;base64,BBBB" });
    const replaced = await client.from("photos").update({ data_url: "data:image/jpeg;base64,CCCC" }).eq("recipe_id", "r-1");
    const removed = await client.from("photos").delete().eq("recipe_id", "r-1");
    expect(added.error?.code).toBe("42501");
    // Row-level security hides rows from update and delete rather than raising an error.
    expect(replaced.error).toBeNull();
    expect(removed.error).toBeNull();
    expect(await photosAfterwards()).toEqual([PHOTO]);
  });

  it.each<Role>(["editor", "admin"])("a Member with role %s can add, replace and remove one", async (role) => {
    const { client } = await signInAs(role);
    const added = { recipe_id: "r-2", data_url: "data:image/jpeg;base64,BBBB" };
    expect((await client.from("photos").upsert(added)).error).toBeNull();
    expect(await photosAfterwards()).toEqual([PHOTO, added]);

    const replaced = { recipe_id: "r-1", data_url: "data:image/jpeg;base64,CCCC" };
    expect((await client.from("photos").upsert(replaced)).error).toBeNull();
    expect((await client.from("photos").delete().eq("recipe_id", "r-2")).error).toBeNull();
    expect(await photosAfterwards()).toEqual([replaced]);
  });
});
