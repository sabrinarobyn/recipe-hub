import { describe, expect, it } from "vitest";
import { anonymous, hearLive, signInAs, signInNotInvited, type Role, type SignedIn } from "./members";

/** A Member's Profile: display name and photo, one row per Member keyed by their user id. */
const PHOTO = "data:image/jpeg;base64,AAAA";

async function save(as: SignedIn, userId: string, profile: { display_name?: string | null; photo?: string | null }) {
  return as.client.from("profiles").upsert({ user_id: userId, ...profile });
}

async function read(as: SignedIn, userId: string) {
  return as.client.from("profiles").select("display_name, photo").eq("user_id", userId);
}

describe("Profiles", () => {
  it.each<Role>(["viewer", "editor", "admin"])("a Member with role %s can set and change their own", async (role) => {
    const me = await signInAs(role);
    expect((await save(me, me.userId, { display_name: "Sam" })).error).toBeNull();
    expect((await save(me, me.userId, { display_name: "Sam K", photo: PHOTO })).error).toBeNull();
    expect((await read(me, me.userId)).data).toEqual([{ display_name: "Sam K", photo: PHOTO }]);
  });

  it.each<Role>(["viewer", "editor", "admin"])("a Member with role %s can read every Member's name and photo", async (role) => {
    const member = await signInAs("viewer");
    expect((await save(member, member.userId, { display_name: "Thandi", photo: PHOTO })).error).toBeNull();
    const reader = await signInAs(role);
    const { data, error } = await read(reader, member.userId);
    expect(error).toBeNull();
    expect(data).toEqual([{ display_name: "Thandi", photo: PHOTO }]);
  });

  it.each<Role>(["viewer", "editor", "admin"])("a Member with role %s can't set or change someone else's", async (role) => {
    const member = await signInAs("viewer");
    expect((await save(member, member.userId, { display_name: "Thandi" })).error).toBeNull();
    const stranger = await signInAs("viewer");

    const other = await signInAs(role);
    expect((await save(other, member.userId, { display_name: "Not Thandi" })).error?.code).toBe("42501");
    expect((await save(other, stranger.userId, { display_name: "Made up" })).error?.code).toBe("42501");
    // Row-level security hides the row from update rather than raising an error.
    await other.client.from("profiles").update({ display_name: "Not Thandi" }).eq("user_id", member.userId);
    await other.client.from("profiles").delete().eq("user_id", member.userId);

    expect((await read(member, member.userId)).data).toEqual([{ display_name: "Thandi", photo: null }]);
    expect((await read(member, stranger.userId)).data).toEqual([]);
  });

  it.each<Role>(["viewer", "editor"])("a Member with role %s never sees another Member's email through Profiles", async (role) => {
    const member = await signInAs("viewer");
    expect((await save(member, member.userId, { display_name: "Thandi", photo: PHOTO })).error).toBeNull();

    const other = await signInAs(role);
    const { data, error } = await other.client.from("profiles").select("*").eq("user_id", member.userId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain(member.email);
    expect((await other.client.from("profiles").select("email")).error).not.toBeNull();
  });

  it("someone not on the invite list can't read Profiles or set their own", async () => {
    const member = await signInAs("viewer");
    expect((await save(member, member.userId, { display_name: "Thandi" })).error).toBeNull();

    const outsider = await signInNotInvited();
    expect((await outsider.client.from("profiles").select("user_id")).data).toEqual([]);
    expect((await save(outsider, outsider.userId, { display_name: "Outsider" })).error?.code).toBe("42501");
    expect((await anonymous().from("profiles").select("user_id")).data ?? []).toEqual([]);
  });

  it("a Member sees another Member's Profile change live", async () => {
    const member = await signInAs("viewer");
    expect((await save(member, member.userId, { display_name: "Thandi" })).error).toBeNull();
    const watcher = await signInAs("viewer");

    const seen = await hearLive<string>({
      client: watcher.client,
      listen: (on) =>
        watcher.client
          .channel(`profiles-${member.userId}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
            const row = payload.new as { user_id?: string; display_name?: string };
            // The earlier save ("Thandi") can still arrive first; wait for the change made here.
            if (row.user_id === member.userId && row.display_name === "Thandi M") on.heard(row.display_name);
          })
          .subscribe((status) => (status === "SUBSCRIBED" ? on.subscribed() : status !== "CLOSED" && on.failed(status))),
      change: () => save(member, member.userId, { display_name: "Thandi M" }),
    });
    expect(seen).toBe("Thandi M");
  });
});
