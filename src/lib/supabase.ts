import type { SupabaseClient } from "@supabase/supabase-js";
import type { Book, Personal, RemoteStore } from "./storage";
import { normalize, pickPersonal, stableStringify } from "./storage";
import type { Profile } from "./profiles";
import type { Review } from "./kitchen";
import { editsFromRecords, recordChanges, type RecipeEdits, type RecipeRecord } from "./recipeRecords";

/**
 * Supabase hosting: invite-only accounts, one shared recipe book, private plans.
 * Only used when the build has VITE_SUPABASE_URL and VITE_SUPABASE_KEY; without
 * them this module is never loaded and the app keeps its browser/artifact storage.
 */
export const supabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_KEY);

export type Role = "admin" | "editor" | "viewer";
export interface Account {
  email: string;
  /** null when signed in but no longer on the invite list. */
  role: Role | null;
  userId: string;
}
export interface Member {
  email: string;
  role: Role;
  added_at: string;
}

let clientPromise: Promise<SupabaseClient> | null = null;

export function getClient(): Promise<SupabaseClient> {
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_KEY) {
    return Promise.reject(new Error("Supabase isn't configured"));
  }
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_KEY!, {
      // Implicit flow: the sign-in link works even when it opens in a different
      // browser from the one that asked for it (e.g. a phone's mail app).
      auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
  );
  return clientPromise;
}

export async function sendSignInLink(email: string): Promise<"sent" | "not-invited" | "rate-limited" | "error"> {
  const sb = await getClient();
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname },
  });
  if (!error) return "sent";
  // The database refuses accounts for emails that aren't on the members list.
  if (/database error|not_invited/i.test(error.message)) return "not-invited";
  if (error.status === 429 || /rate limit/i.test(error.message)) return "rate-limited";
  return "error";
}

/** Sign in with the 6-digit code from the email. */
export async function verifySignInCode(email: string, code: string): Promise<"ok" | "wrong" | "error"> {
  const sb = await getClient();
  const { error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.replace(/\s/g, ""), type: "email" });
  if (!error) return "ok";
  // Supabase answers "Token has expired or is invalid" for both cases.
  if (error.status === 400 || error.status === 403 || /expired|invalid|token/i.test(error.message)) return "wrong";
  return "error";
}

export async function signOut(): Promise<void> {
  const sb = await getClient();
  await sb.auth.signOut();
}

/** The signed-in account and its role, or null when signed out. */
export async function currentAccount(): Promise<Account | null> {
  const sb = await getClient();
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (!user?.email) return null;
  const { data: rows, error } = await sb.rpc("whoami");
  if (error) throw error;
  const row = (rows as { email: string; role: Role }[] | null)?.[0];
  return { email: user.email, role: row?.role ?? null, userId: user.id };
}

export async function onAuthChange(cb: () => void): Promise<() => void> {
  const sb = await getClient();
  const { data } = sb.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") cb();
  });
  return () => data.subscription.unsubscribe();
}

/* ---------- invite list (admins) ---------- */

export async function listMembers(): Promise<Member[]> {
  const sb = await getClient();
  const { data, error } = await sb.from("members").select("email, role, added_at").order("added_at");
  if (error) throw error;
  return data as Member[];
}

export async function saveMember(email: string, role: Role): Promise<void> {
  const sb = await getClient();
  const { error } = await sb.from("members").upsert({ email: email.trim().toLowerCase(), role });
  if (error) throw error;
}

export async function removeMember(email: string): Promise<void> {
  const sb = await getClient();
  const { error } = await sb.from("members").delete().eq("email", email);
  if (error) throw error;
}

/* ---------- Profiles: every Member's name and photo, never their email ---------- */

type ProfileRow = { user_id: string; display_name: string | null; photo: string | null; name_asked_at: string | null };
const PROFILE_COLUMNS = "user_id, display_name, photo, name_asked_at";

function profileFromRow(r: ProfileRow): Profile {
  return { userId: r.user_id, displayName: r.display_name, photo: r.photo, nameAskedAt: r.name_asked_at };
}

export async function loadProfiles(): Promise<Record<string, Profile>> {
  const sb = await getClient();
  const { data, error } = await sb.from("profiles").select(PROFILE_COLUMNS);
  if (error) throw error;
  return Object.fromEntries((data as ProfileRow[]).map((r) => [r.user_id, profileFromRow(r)]));
}

/** Saves the signed-in Member's own Profile (the database refuses anyone else's). */
export async function saveProfile(profile: Profile): Promise<void> {
  const sb = await getClient();
  const { error } = await sb.from("profiles").upsert({
    user_id: profile.userId,
    display_name: profile.displayName?.trim() || null,
    photo: profile.photo,
    name_asked_at: profile.nameAskedAt,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Live Profile changes from every device and Member. */
export async function onProfiles(cb: (profile: Profile) => void): Promise<() => void> {
  const sb = await getClient();
  const channel = sb
    .channel("profiles")
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
      const row = payload.new as ProfileRow;
      if (row?.user_id) cb(profileFromRow(row));
    })
    .subscribe();
  return () => void sb.removeChannel(channel);
}

/* ---------- Reviews: one per Member and Recipe, read by every Member ---------- */

type ReviewRow = { id: string; recipe_id: string; user_id: string; stars: number; comment: string | null; created_at: string; updated_at: string };
const REVIEW_COLUMNS = "id, recipe_id, user_id, stars, comment, created_at, updated_at";

function reviewFromRow(r: ReviewRow): Review {
  return { id: r.id, recipeId: r.recipe_id, userId: r.user_id, stars: r.stars, comment: r.comment, createdAt: r.created_at, updatedAt: r.updated_at };
}

/** What a Member writes in their Review. */
export interface ReviewDraft {
  recipeId: string;
  stars: number;
  comment: string | null;
}

/** A Review written or changed, or one deleted (by its id). */
export type ReviewChange = { kind: "saved"; review: Review } | { kind: "deleted"; id: string };

/** Every Review of every Recipe. */
export async function loadReviews(sb: SupabaseClient): Promise<Review[]> {
  const { data, error } = await sb.from("reviews").select(REVIEW_COLUMNS);
  if (error) throw error;
  return (data as ReviewRow[]).map(reviewFromRow);
}

/**
 * Writes the signed-in Member's Review of a Recipe. A Member has one Review per Recipe, so this
 * replaces theirs if they already have one (keeping its id and when it was first written).
 */
export async function saveReview(sb: SupabaseClient, userId: string, draft: ReviewDraft): Promise<Review> {
  const { data, error } = await sb
    .from("reviews")
    .upsert(
      { recipe_id: draft.recipeId, user_id: userId, stars: draft.stars, comment: draft.comment?.trim() || null },
      { onConflict: "recipe_id,user_id" },
    )
    .select(REVIEW_COLUMNS)
    .single();
  if (error) throw error;
  return reviewFromRow(data as ReviewRow);
}

/** Deletes a Review: the reviewer's own, or any Review for Editors and Admins (others are left as they are). */
export async function deleteReview(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("reviews").delete().eq("id", id);
  if (error) throw error;
}

/** Live Review changes from every Member. `onSubscribed` runs once the channel is listening. */
export function onReviews(sb: SupabaseClient, cb: (change: ReviewChange) => void, onSubscribed?: () => void): () => void {
  const channel = sb
    .channel(`reviews-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, (payload) => {
      if (payload.eventType === "DELETE") {
        const id = (payload.old as { id?: string }).id;
        if (id) cb({ kind: "deleted", id });
      } else {
        const row = payload.new as ReviewRow;
        if (row?.id) cb({ kind: "saved", review: reviewFromRow(row) });
      }
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") onSubscribed?.();
    });
  return () => void sb.removeChannel(channel);
}

/* ---------- the app's data ---------- */

/**
 * The Recipe Book is stored in two places:
 * - the shared `book_parts` 'catalog' block: Product catalogue edits and categories;
 * - the `recipes` table: one record per Recipe (see lib/recipeRecords).
 */
const catalogBody = (b: Book) => ({ productEdits: b.productEdits, categories: b.categories });

function bookFrom(catalog: Record<string, unknown> | undefined, recipeEdits: RecipeEdits): Book {
  const c = catalog ?? {};
  return {
    productEdits: (c.productEdits as Book["productEdits"]) ?? {},
    categories: Array.isArray(c.categories) ? (c.categories as string[]) : [],
    recipeEdits,
  };
}

/** Every Recipe record, as the app reads them. */
export async function loadRecipeRecords(sb: SupabaseClient): Promise<RecipeRecord[]> {
  const { data, error } = await sb.from("recipes").select("id, body, deleted");
  if (error) throw error;
  return data as RecipeRecord[];
}

/**
 * Saves Recipe records and removes others. Saving leaves a record's Author as it is; `updated_by`
 * is the Member saving. Removing a record brings back the original Recipe ("Undo my changes").
 */
export async function writeRecipeRecords(
  sb: SupabaseClient,
  userId: string,
  { save, remove }: { save: RecipeRecord[]; remove: string[] },
): Promise<void> {
  if (save.length) {
    const { error } = await sb.from("recipes").upsert(save.map((r) => ({ ...r, updated_by: userId })));
    if (error) throw error;
  }
  if (remove.length) {
    const { error } = await sb.from("recipes").delete().in("id", remove);
    if (error) throw error;
  }
}

export async function connectSupabase(account: Account): Promise<RemoteStore> {
  const sb = await getClient();
  const canEdit = account.role === "admin" || account.role === "editor";
  let catalog: Record<string, unknown> | undefined;
  /** The recipe records as last saved or heard about, as edits. */
  let stored: RecipeEdits = {};
  let recipeQueue: Promise<void> = Promise.resolve();
  const written: Record<string, string> = {};
  const queue: Record<string, Promise<void>> = {};

  /** Save unless unchanged; one write at a time per row. */
  function write(name: string, json: string, run: () => PromiseLike<{ error: unknown }>): Promise<void> {
    if (written[name] === json) return Promise.resolve();
    written[name] = json;
    const next = (queue[name] ?? Promise.resolve()).then(async () => {
      const { error } = await run();
      if (error) throw error;
    });
    queue[name] = next.catch(() => {
      delete written[name];
    });
    return next;
  }

  function saveCatalog(body: Record<string, unknown>) {
    catalog = body;
    return write("catalog", stableStringify(body), () =>
      sb.from("book_parts").upsert({ part: "catalog", body, updated_at: new Date().toISOString(), updated_by: account.userId }),
    );
  }

  /** Save only the Recipes that changed; one write at a time. */
  function saveRecipes(edits: RecipeEdits): Promise<void> {
    const before = stored;
    const changes = recordChanges(before, edits);
    if (!changes.save.length && !changes.remove.length) return Promise.resolve();
    stored = edits;
    const next = recipeQueue.then(() => writeRecipeRecords(sb, account.userId, changes));
    recipeQueue = next.catch(() => {
      // Forget these Recipes were saved, so the next save tries them again.
      const retry = { ...stored };
      for (const id of [...changes.save.map((r) => r.id), ...changes.remove]) {
        if (id in before) retry[id] = before[id];
        else delete retry[id];
      }
      stored = retry;
    });
    return next;
  }

  async function loadPhotos(): Promise<Record<string, string>> {
    const { data, error } = await sb.from("photos").select("recipe_id, data_url");
    if (error) throw error;
    return Object.fromEntries((data as { recipe_id: string; data_url: string }[]).map((r) => [r.recipe_id, r.data_url]));
  }

  return {
    canEditBook: canEdit,
    isOwner: account.role === "admin",
    async loadBook() {
      const [parts, records] = await Promise.all([
        sb.from("book_parts").select("body").eq("part", "catalog").maybeSingle(),
        loadRecipeRecords(sb),
      ]);
      if (parts.error) throw parts.error;
      if (!parts.data && !records.length) return null;
      if (parts.data) {
        catalog = parts.data.body as Record<string, unknown>;
        written.catalog = stableStringify(catalog);
      }
      stored = editsFromRecords(records);
      return bookFrom(catalog, stored);
    },
    async saveBook(b) {
      await Promise.all([saveCatalog(catalogBody(b)), saveRecipes(b.recipeEdits)]);
    },
    onBook(cb) {
      const channel = sb
        .channel("book")
        .on("postgres_changes", { event: "*", schema: "public", table: "book_parts" }, (payload) => {
          const row = payload.new as { part?: string; body?: Record<string, unknown> };
          if (row?.part !== "catalog" || !row.body) return;
          const json = stableStringify(row.body);
          // Unchanged means it's our own write coming back.
          if (written.catalog === json) return;
          written.catalog = json;
          catalog = row.body;
          cb(bookFrom(catalog, stored));
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "recipes" }, (payload) => {
          const next = { ...stored };
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id?: string }).id;
            if (!id || !(id in next)) return;
            delete next[id];
          } else {
            const record = payload.new as RecipeRecord;
            const edit = editsFromRecords([record])[record.id];
            // Unchanged means it's our own write coming back.
            if (record.id in next && stableStringify(next[record.id]) === stableStringify(edit)) return;
            next[record.id] = edit;
          }
          stored = next;
          cb(bookFrom(catalog, stored));
        })
        .subscribe();
      return () => void sb.removeChannel(channel);
    },
    async loadPersonal() {
      const { data, error } = await sb.from("personal").select("body").eq("user_id", account.userId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const d = normalize({ v: 1, ...(data.body as object) });
      if (!d) return null;
      const p = pickPersonal(d);
      written.personal = stableStringify(p);
      return p;
    },
    savePersonal(p: Personal) {
      return write("personal", stableStringify(p), () =>
        sb.from("personal").upsert({ user_id: account.userId, body: p, updated_at: new Date().toISOString() }),
      );
    },
    loadPhotos,
    setPhoto(recipeId, dataUrl) {
      const name = `photo:${recipeId}`;
      const next = (queue[name] ?? Promise.resolve()).then(async () => {
        const { error } = dataUrl
          ? await sb.from("photos").upsert({ recipe_id: recipeId, data_url: dataUrl, updated_at: new Date().toISOString() })
          : await sb.from("photos").delete().eq("recipe_id", recipeId);
        if (error) throw error;
      });
      queue[name] = next.catch(() => {});
      return next;
    },
    onPhotos(cb) {
      let current: Record<string, string> | null = null;
      const load = async () => {
        current = await loadPhotos();
        return current;
      };
      const channel = sb
        .channel("photos")
        .on("postgres_changes", { event: "*", schema: "public", table: "photos" }, async (payload) => {
          const map = { ...(current ?? (await load())) };
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { recipe_id?: string }).recipe_id;
            if (id) delete map[id];
          } else {
            const row = payload.new as { recipe_id: string; data_url: string };
            map[row.recipe_id] = row.data_url;
          }
          current = map;
          cb(map);
        })
        .subscribe();
      return () => void sb.removeChannel(channel);
    },
    async loadLegacy() {
      return { data: null, photos: {} };
    },
  };
}
