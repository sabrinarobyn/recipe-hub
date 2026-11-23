import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { service, signInAs, type Role, type SignedIn } from "./members";
import { recordChanges } from "../../src/lib/recipeRecords";
import { loadRecipeRecords, writeRecipeRecords } from "../../src/lib/supabase";

/**
 * Authors: any Member adds Recipes and changes their own; Editors and Admins change any Recipe.
 * Each test makes its own Members, so the Recipes by "someone else" belong to a Viewer made here.
 */
const ORIGINAL = { id: "a-orig", body: { id: "a-orig", name: "Spinach pie" }, deleted: false };
const ORIGINAL_PHOTO = { recipe_id: "a-orig", data_url: "data:image/jpeg;base64,AAAA" };
const PHOTO = "data:image/jpeg;base64,BBBB";

let someone: SignedIn;
/** A Recipe another Viewer added. */
let theirs: { id: string; body: object; deleted: boolean; author_id: string };

beforeEach(async () => {
  someone = await signInAs("viewer");
  theirs = { id: "a-theirs", body: { id: "a-theirs", name: "Lentil soup" }, deleted: false, author_id: someone.userId };
  for (const r of [
    await service.from("photos").delete().like("recipe_id", "a-%"),
    await service.from("recipes").delete().like("id", "a-%"),
    await service.from("recipes").insert([ORIGINAL, theirs]),
    await service.from("photos").insert(ORIGINAL_PHOTO),
    await service.from("products").delete().like("key", "a_%"),
  ]) {
    if (r.error) throw r.error;
  }
});

async function recipe(id: string) {
  return (await service.from("recipes").select("id, body, deleted, author_id").eq("id", id).maybeSingle()).data;
}

async function photo(id: string) {
  return (await service.from("photos").select("data_url").eq("recipe_id", id).maybeSingle()).data?.data_url ?? null;
}

/** A Viewer adds a Recipe the way the app saves one. */
async function addMine(viewer: SignedIn, id = "a-mine") {
  const body = { id, name: "Toast" };
  await writeRecipeRecords(viewer.client, viewer.userId, recordChanges({}, { [id]: body } as never, new Set(["a-orig"])));
  return body;
}

describe("A Viewer as Author", () => {
  it("adds a Recipe and is recorded as its Author", async () => {
    const viewer = await signInAs("viewer");
    const body = await addMine(viewer);
    expect(await recipe("a-mine")).toEqual({ id: "a-mine", body, deleted: false, author_id: viewer.userId });
    const read = await loadRecipeRecords(viewer.client);
    expect(read.find((r) => r.id === "a-mine")?.author_id).toBe(viewer.userId);
  });

  it("can't add a Recipe as someone else", async () => {
    const viewer = await signInAs("viewer");
    const asSomeone = await viewer.client.from("recipes").insert({ id: "a-forged", body: { id: "a-forged" }, author_id: someone.userId });
    expect(asSomeone.error?.code).toBe("42501");
    expect(await recipe("a-forged")).toBeNull();
  });

  it("is the Author of a Recipe they add without naming one", async () => {
    const viewer = await signInAs("viewer");
    expect((await viewer.client.from("recipes").insert({ id: "a-mine", body: { id: "a-mine" } })).error).toBeNull();
    expect((await recipe("a-mine"))?.author_id).toBe(viewer.userId);
  });

  it("edits, marks removed and deletes their own Recipe", async () => {
    const viewer = await signInAs("viewer");
    await addMine(viewer);
    const edited = { id: "a-mine", body: { id: "a-mine", name: "Cheese toast" }, deleted: false };
    expect((await viewer.client.from("recipes").upsert(edited)).error).toBeNull();
    expect(await recipe("a-mine")).toEqual({ ...edited, author_id: viewer.userId });

    expect((await viewer.client.from("recipes").upsert({ id: "a-mine", body: null, deleted: true })).error).toBeNull();
    expect((await recipe("a-mine"))?.deleted).toBe(true);

    expect((await viewer.client.from("recipes").delete().eq("id", "a-mine")).error).toBeNull();
    expect(await recipe("a-mine")).toBeNull();
  });

  it("can't give their Recipe to another Member", async () => {
    const viewer = await signInAs("viewer");
    await addMine(viewer);
    const { error } = await viewer.client.from("recipes").update({ author_id: someone.userId }).eq("id", "a-mine");
    expect(error?.code).toBe("42501");
    expect((await recipe("a-mine"))?.author_id).toBe(viewer.userId);
  });

  it("can't change or delete another Member's Recipe or an original one", async () => {
    const viewer = await signInAs("viewer");
    for (const id of ["a-theirs", "a-orig"]) {
      const before = await recipe(id);
      // Row-level security hides rows from update and delete rather than raising an error.
      expect((await viewer.client.from("recipes").update({ body: { id, name: "Mine now" } }).eq("id", id)).error).toBeNull();
      expect((await viewer.client.from("recipes").delete().eq("id", id)).error).toBeNull();
      // Upserting over it is refused outright.
      expect((await viewer.client.from("recipes").upsert({ id, body: null, deleted: true })).error?.code).toBe("42501");
      expect(await recipe(id)).toEqual(before);
    }
  });

  it("sets and removes the Main Photo of their own Recipe", async () => {
    const viewer = await signInAs("viewer");
    await addMine(viewer);
    expect((await viewer.client.from("photos").upsert({ recipe_id: "a-mine", data_url: PHOTO })).error).toBeNull();
    expect(await photo("a-mine")).toBe(PHOTO);
    expect((await viewer.client.from("photos").delete().eq("recipe_id", "a-mine")).error).toBeNull();
    expect(await photo("a-mine")).toBeNull();
  });

  it("can't set the Main Photo of another Member's Recipe or an original one", async () => {
    const viewer = await signInAs("viewer");
    expect((await viewer.client.from("photos").insert({ recipe_id: "a-theirs", data_url: PHOTO })).error?.code).toBe("42501");
    expect((await viewer.client.from("photos").update({ data_url: PHOTO }).eq("recipe_id", "a-orig")).error).toBeNull();
    expect((await viewer.client.from("photos").delete().eq("recipe_id", "a-orig")).error).toBeNull();
    expect(await photo("a-theirs")).toBeNull();
    expect(await photo("a-orig")).toBe(ORIGINAL_PHOTO.data_url);
  });

  it("keeps their Recipes after being taken off the invite list, but can't change them any more", async () => {
    const viewer = await signInAs("viewer");
    await addMine(viewer);
    expect((await service.from("members").delete().eq("email", viewer.email)).error).toBeNull();
    expect((await viewer.client.from("recipes").update({ body: { id: "a-mine", name: "Gone" } }).eq("id", "a-mine")).error).toBeNull();
    expect(await recipe("a-mine")).toEqual({ id: "a-mine", body: { id: "a-mine", name: "Toast" }, deleted: false, author_id: viewer.userId });
  });
});

describe.each<Role>(["editor", "admin"])("A Member with role %s", (role) => {
  it("edits, marks removed and deletes any Recipe, keeping its Author", async () => {
    const { client } = await signInAs(role);
    const edited = { id: "a-theirs", body: { id: "a-theirs", name: "Red lentil soup" }, deleted: false };
    expect((await client.from("recipes").upsert(edited)).error).toBeNull();
    expect(await recipe("a-theirs")).toEqual({ ...edited, author_id: someone.userId });
    expect((await client.from("recipes").upsert({ id: "a-orig", body: null, deleted: true })).error).toBeNull();
    expect((await recipe("a-orig"))?.deleted).toBe(true);
    expect((await client.from("recipes").delete().eq("id", "a-theirs")).error).toBeNull();
    expect(await recipe("a-theirs")).toBeNull();
  });

  it("sets the Main Photo of any Recipe", async () => {
    const { client } = await signInAs(role);
    expect((await client.from("photos").upsert({ recipe_id: "a-theirs", data_url: PHOTO })).error).toBeNull();
    expect(await photo("a-theirs")).toBe(PHOTO);
  });

  it("is the Author of a Recipe they add in the app", async () => {
    const member = await signInAs(role);
    await addMine(member);
    expect((await recipe("a-mine"))?.author_id).toBe(member.userId);
  });
});

describe("Products added while writing a Recipe", () => {
  const product = (key: string) => ({ key, name: "Smoked paprika", packSize: 50, unit: "g", today: 30, regular: 30 });
  const read = async (client: SupabaseClient, key: string) =>
    (await client.from("products").select("key, body, author_id").eq("key", key).maybeSingle()).data;

  it.each<Role>(["viewer", "editor", "admin"])("a Member with role %s can add a new one as themselves", async (role) => {
    const member = await signInAs(role);
    const { error } = await member.client.from("products").insert({ key: "a_paprika", body: product("a_paprika"), author_id: member.userId });
    expect(error).toBeNull();
    const other = await signInAs("viewer");
    expect(await read(other.client, "a_paprika")).toEqual({ key: "a_paprika", body: product("a_paprika"), author_id: member.userId });
  });

  it("a Viewer can't add one as someone else", async () => {
    const viewer = await signInAs("viewer");
    const { error } = await viewer.client.from("products").insert({ key: "a_forged", body: product("a_forged"), author_id: someone.userId });
    expect(error?.code).toBe("42501");
  });

  it("nobody can change a Product once it's added (Editors change Products in the catalogue)", async () => {
    const viewer = await signInAs("viewer");
    expect((await viewer.client.from("products").insert({ key: "a_paprika", body: product("a_paprika"), author_id: viewer.userId })).error).toBeNull();
    const cheaper = { ...product("a_paprika"), today: 1 };
    expect((await viewer.client.from("products").update({ body: cheaper }).eq("key", "a_paprika")).error).toBeNull();
    expect((await viewer.client.from("products").upsert({ key: "a_paprika", body: cheaper, author_id: viewer.userId })).error).not.toBeNull();
    expect((await viewer.client.from("products").delete().eq("key", "a_paprika")).error).toBeNull();
    expect((await read(service, "a_paprika"))?.body).toEqual(product("a_paprika"));
  });
});
