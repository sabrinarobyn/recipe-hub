import type { SupabaseClient } from "@supabase/supabase-js";
import type { Book, Personal, RemoteStore } from "./storage";
import { normalize, pickPersonal, stableStringify } from "./storage";

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

/* ---------- the app's data ---------- */

type Part = "catalog" | "recipes";
const catalogBody = (b: Book) => ({ productEdits: b.productEdits, categories: b.categories });
const recipesBody = (b: Book) => ({ recipeEdits: b.recipeEdits });

function bookFromParts(parts: Partial<Record<Part, Record<string, unknown>>>): Book {
  const c = parts.catalog ?? {};
  const r = parts.recipes ?? {};
  return {
    productEdits: (c.productEdits as Book["productEdits"]) ?? {},
    categories: Array.isArray(c.categories) ? (c.categories as string[]) : [],
    recipeEdits: (r.recipeEdits as Book["recipeEdits"]) ?? {},
  };
}

export async function connectSupabase(account: Account): Promise<RemoteStore> {
  const sb = await getClient();
  const canEdit = account.role === "admin" || account.role === "editor";
  const parts: Partial<Record<Part, Record<string, unknown>>> = {};
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

  function savePart(part: Part, body: Record<string, unknown>) {
    parts[part] = body;
    return write(part, stableStringify(body), () =>
      sb.from("book_parts").upsert({ part, body, updated_at: new Date().toISOString(), updated_by: account.userId }),
    );
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
      const { data, error } = await sb.from("book_parts").select("part, body");
      if (error) throw error;
      if (!data.length) return null;
      for (const row of data as { part: Part; body: Record<string, unknown> }[]) {
        parts[row.part] = row.body;
        written[row.part] = stableStringify(row.body);
      }
      return bookFromParts(parts);
    },
    async saveBook(b) {
      await Promise.all([savePart("catalog", catalogBody(b)), savePart("recipes", recipesBody(b))]);
    },
    onBook(cb) {
      const channel = sb
        .channel("book")
        .on("postgres_changes", { event: "*", schema: "public", table: "book_parts" }, (payload) => {
          const row = payload.new as { part?: Part; body?: Record<string, unknown> };
          if (!row?.part || !row.body) return;
          const json = stableStringify(row.body);
          // Unchanged means it's our own write coming back.
          if (written[row.part] === json) return;
          written[row.part] = json;
          parts[row.part] = row.body;
          cb(bookFromParts(parts));
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
