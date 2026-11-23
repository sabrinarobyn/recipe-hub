import { describe, expect, it } from "vitest";
import { anonymous, signInAs, signInNotInvited, type Role, type SignedIn } from "./members";

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
    const author = await signInAs("viewer");
    expect((await save(author, author.userId, { display_name: "Thandi", photo: PHOTO })).error).toBeNull();
    const reader = await signInAs(role);
    const { data, error } = await read(reader, author.userId);
    expect(error).toBeNull();
    expect(data).toEqual([{ display_name: "Thandi", photo: PHOTO }]);
  });

  it.each<Role>(["viewer", "editor", "admin"])("a Member with role %s can't set or change someone else's", async (role) => {
    const owner = await signInAs("viewer");
    expect((await save(owner, owner.userId, { display_name: "Thandi" })).error).toBeNull();
    const stranger = await signInAs("viewer");

    const other = await signInAs(role);
    expect((await save(other, owner.userId, { display_name: "Not Thandi" })).error?.code).toBe("42501");
    expect((await save(other, stranger.userId, { display_name: "Made up" })).error?.code).toBe("42501");
    // Row-level security hides the row from update rather than raising an error.
    await other.client.from("profiles").update({ display_name: "Not Thandi" }).eq("user_id", owner.userId);
    await other.client.from("profiles").delete().eq("user_id", owner.userId);

    expect((await read(owner, owner.userId)).data).toEqual([{ display_name: "Thandi", photo: null }]);
    expect((await read(owner, stranger.userId)).data).toEqual([]);
  });

  it.each<Role>(["viewer", "editor"])("a Member with role %s never sees another Member's email through Profiles", async (role) => {
    const owner = await signInAs("viewer");
    expect((await save(owner, owner.userId, { display_name: "Thandi", photo: PHOTO })).error).toBeNull();

    const other = await signInAs(role);
    const { data, error } = await other.client.from("profiles").select("*").eq("user_id", owner.userId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain(owner.email);
    expect((await other.client.from("profiles").select("email")).error).not.toBeNull();
  });

  it("someone not on the invite list can't read Profiles or set their own", async () => {
    const owner = await signInAs("viewer");
    expect((await save(owner, owner.userId, { display_name: "Thandi" })).error).toBeNull();

    const outsider = await signInNotInvited();
    expect((await outsider.client.from("profiles").select("user_id")).data).toEqual([]);
    expect((await save(outsider, outsider.userId, { display_name: "Outsider" })).error?.code).toBe("42501");
    expect((await anonymous().from("profiles").select("user_id")).data ?? []).toEqual([]);
  });

  it("a Member sees another Member's Profile change live", async () => {
    const owner = await signInAs("viewer");
    expect((await save(owner, owner.userId, { display_name: "Thandi" })).error).toBeNull();
    const watcher = await signInAs("viewer");

    // Realtime can take a moment to start streaming after it says SUBSCRIBED, so keep saving until it arrives.
    let timer: ReturnType<typeof setInterval> | undefined;
    const seen = new Promise<unknown>((resolve) => {
      watcher.client
        .channel(`profiles-${owner.userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
          const row = payload.new as { user_id?: string; display_name?: string };
          if (row.user_id === owner.userId) resolve(row.display_name);
        })
        .subscribe((status) => {
          if (status !== "SUBSCRIBED") return;
          const change = () => void save(owner, owner.userId, { display_name: "Thandi M" });
          change();
          timer = setInterval(change, 1000);
        });
    });
    try {
      expect(await seen).toBe("Thandi M");
    } finally {
      clearInterval(timer);
      await watcher.client.removeAllChannels();
    }
  });
});
