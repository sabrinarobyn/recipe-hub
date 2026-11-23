import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonymous, service, signInNotInvited } from "./members";

beforeAll(async () => {
  for (const r of [
    await service.from("book_parts").upsert({ part: "recipes", body: { recipeEdits: {} } }),
    await service.from("photos").upsert({ recipe_id: "r-1", data_url: "data:image/jpeg;base64,AAAA" }),
  ]) {
    if (r.error) throw r.error;
  }
});

async function readsNothing(client: SupabaseClient) {
  for (const table of ["members", "book_parts", "photos", "personal"]) {
    const { data, error } = await client.from(table).select("*");
    // Signed-out visitors may be refused outright; signed-in people see no rows.
    if (error) expect(error.code).toBe("42501");
    else expect(data, table).toEqual([]);
  }
}

describe("People who aren't invited", () => {
  it("can't create an account", async () => {
    const { error } = await anonymous().auth.signUp({
      email: `stranger-${Date.now()}@test.recipe-hub.local`,
      password: "test-password-123",
    });
    expect(error).not.toBeNull();
  });

  it("can read nothing when signed out", async () => {
    await readsNothing(anonymous());
  });

  it("can read nothing once removed from the invite list", async () => {
    const { client, userId } = await signInNotInvited();
    // Even a private data row they saved while invited is hidden.
    const { error } = await service.from("personal").upsert({ user_id: userId, body: { plan: {} } });
    if (error) throw error;
    await readsNothing(client);
  });

  it("can't change the Recipe Book, photos or their own private data once removed", async () => {
    const { client, userId } = await signInNotInvited();
    const writes = [
      await client.from("book_parts").upsert({ part: "recipes", body: { recipeEdits: { x: {} } } }),
      await client.from("photos").upsert({ recipe_id: "r-2", data_url: "data:image/jpeg;base64,BBBB" }),
      await client.from("personal").upsert({ user_id: userId, body: { plan: {} } }),
    ];
    for (const { error } of writes) expect(error?.code).toBe("42501");
  });

  it("can't change anything when signed out", async () => {
    const writes = [
      await anonymous().from("book_parts").upsert({ part: "recipes", body: {} }),
      await anonymous().from("photos").upsert({ recipe_id: "r-2", data_url: "data:image/jpeg;base64,BBBB" }),
    ];
    for (const { error } of writes) expect(error?.code).toBe("42501");
  });
});
