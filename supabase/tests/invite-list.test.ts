import { describe, expect, it } from "vitest";
import { signInAs, type Role } from "./members";

function newEmail() {
  return `invitee-${Date.now()}-${Math.random().toString(36).slice(2)}@test.recipe-hub.local`;
}

describe("Invite list", () => {
  it("an Admin can invite, change a role and remove an invite", async () => {
    const { client } = await signInAs("admin");
    const email = newEmail();
    expect((await client.from("members").insert({ email, role: "viewer" })).error).toBeNull();
    expect((await client.from("members").update({ role: "editor" }).eq("email", email)).error).toBeNull();
    expect((await client.from("members").select("role").eq("email", email)).data).toEqual([{ role: "editor" }]);
    expect((await client.from("members").delete().eq("email", email)).error).toBeNull();
    expect((await client.from("members").select("role").eq("email", email)).data).toEqual([]);
  });

  it.each<Role>(["viewer", "editor"])("a Member with role %s sees only themselves and can't invite", async (role) => {
    const me = await signInAs(role);
    await signInAs("viewer"); // someone else on the list
    const { data } = await me.client.from("members").select("email, role");
    expect(data).toEqual([{ email: me.email, role }]);

    const { error } = await me.client.from("members").insert({ email: newEmail(), role: "admin" });
    expect(error?.code).toBe("42501");
    await me.client.from("members").update({ role: "admin" }).eq("email", me.email);
    expect((await me.client.rpc("whoami")).data).toEqual([{ email: me.email, role }]);
  });
});
