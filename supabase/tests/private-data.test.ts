import { describe, expect, it } from "vitest";
import { signInAs, type Role, type SignedIn } from "./members";

/** A Member's private data (Plan, Shopping Lists, store choice) is one `personal` row. */
function plan(recipeId: string) {
  return { plan: { "2026-11-23": { dinner: [{ recipeId, scale: 1 }] } }, shoppingLists: {} };
}

async function save(as: SignedIn, userId: string, body: object) {
  return as.client.from("personal").upsert({ user_id: userId, body });
}

async function read(as: SignedIn, userId: string) {
  return as.client.from("personal").select("body").eq("user_id", userId);
}

describe("Private data (Plan and Shopping Lists)", () => {
  it.each<Role>(["viewer", "editor", "admin"])("a Member with role %s can save and read their own", async (role) => {
    const me = await signInAs(role);
    expect((await save(me, me.userId, plan("r-1"))).error).toBeNull();
    expect((await save(me, me.userId, plan("r-2"))).error).toBeNull();
    expect((await read(me, me.userId)).data).toEqual([{ body: plan("r-2") }]);
  });

  it.each<Role>(["viewer", "editor", "admin"])("a Member with role %s can't read someone else's", async (role) => {
    const owner = await signInAs("viewer");
    expect((await save(owner, owner.userId, plan("r-1"))).error).toBeNull();

    const other = await signInAs(role);
    const { data, error } = await read(other, owner.userId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect((await other.client.from("personal").select("user_id")).data).toEqual([]);
  });

  it.each<Role>(["viewer", "editor", "admin"])("a Member with role %s can't change someone else's", async (role) => {
    const owner = await signInAs("viewer");
    expect((await save(owner, owner.userId, plan("r-1"))).error).toBeNull();

    const other = await signInAs(role);
    expect((await save(other, owner.userId, plan("r-9"))).error?.code).toBe("42501");
    expect((await other.client.from("personal").delete().eq("user_id", owner.userId)).error).toBeNull();
    expect((await read(owner, owner.userId)).data).toEqual([{ body: plan("r-1") }]);
  });
});
