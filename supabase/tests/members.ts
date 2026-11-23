import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Sign in to the local Supabase stack as different Members.
 *
 * scripts/test-db.sh exports the stack's API_URL, ANON_KEY and SERVICE_ROLE_KEY (from
 * `supabase status -o env`); vitest exposes them on import.meta.env.
 */
const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = import.meta.env;
if (!API_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error("No local Supabase stack: run the database tests with `npm run test:db`.");
}

export type Role = "admin" | "editor" | "viewer";

export interface SignedIn {
  client: SupabaseClient;
  email: string;
  userId: string;
}

function connect(key: string): SupabaseClient {
  return createClient(API_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Bypasses row-level security. Use it only to arrange data a test needs (for example a Recipe
 * Book that already exists), never to check what a Member could do.
 */
export const service = connect(SERVICE_ROLE_KEY);

/** Someone who hasn't signed in at all. */
export function anonymous(): SupabaseClient {
  return connect(ANON_KEY);
}

const PASSWORD = "test-password-123";
let count = 0;

function freshEmail(label: string): string {
  return `${label}-${Date.now()}-${++count}@test.recipe-hub.local`;
}

function check(what: string, error: unknown) {
  if (error) throw new Error(`${what}: ${JSON.stringify(error)}`);
}

/** Puts an email on the invite list with a role, and creates its account. */
async function invite(email: string, role: Role): Promise<string> {
  check("invite", (await service.from("members").insert({ email, role })).error);
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  check("create account", error);
  return data.user!.id;
}

/**
 * Signs in with a password. The app itself signs in with an emailed code; a password reaches the
 * same session (a JWT carrying the email), so the database's rules see the same person.
 */
async function signIn(email: string, userId: string): Promise<SignedIn> {
  const client = connect(ANON_KEY);
  check("sign in", (await client.auth.signInWithPassword({ email, password: PASSWORD })).error);
  return { client, email, userId };
}

/** A new Member with this role, signed in. Every call makes a different Member. */
export async function signInAs(role: Role): Promise<SignedIn> {
  const email = freshEmail(role);
  return signIn(email, await invite(email, role));
}

/**
 * A signed-in person who isn't on the invite list. Accounts can only be created for invited emails,
 * so this is someone who was invited, signed up, and then removed from the list.
 */
export async function signInNotInvited(): Promise<SignedIn> {
  const email = freshEmail("not-invited");
  const userId = await invite(email, "viewer");
  check("remove invite", (await service.from("members").delete().eq("email", email)).error);
  return signIn(email, userId);
}
