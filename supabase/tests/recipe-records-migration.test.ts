import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { service, signInAs } from "./members";

/**
 * The migration to one record per Recipe carries the edits already saved in the shared block.
 *
 * This resets the local database to the migration just before it, saves a Recipe Book the old
 * way, then applies the remaining migrations. Like every test file it leaves the database fully
 * migrated (with different data), and other files set up their own rows.
 */
const migrations = readdirSync(fileURLToPath(new URL("../migrations", import.meta.url))).filter((f) => f.endsWith(".sql")).sort();
const mine = migrations.findIndex((f) => f.endsWith("_recipe_records.sql"));
const before = migrations[mine - 1].split("_")[0];

function supabase(...args: string[]) {
  execFileSync("npx", ["supabase", ...args], { stdio: "pipe" });
}

/** The API reloads its view of the schema shortly after a migration; wait until it sees the table. */
async function whenReady(table: string) {
  for (let i = 0; i < 60; i++) {
    const { error } = await service.from(table).select("*").limit(1);
    if (!error) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${table} never became available`);
}

const CATALOG = { productEdits: { rice: { key: "rice", name: "Rice 1 kg" } }, categories: ["Mains", "Soups"] };
const EDITED_ORIGINAL = { id: "r-1", name: "Spinach and feta pie", category: "Mains", lines: [{ id: "l1", text: "spinach" }] };
const ADDED = { id: "u-1", name: "Lentil soup", category: "Soups", lines: [] };
const RECIPE_EDITS = { "r-1": EDITED_ORIGINAL, "r-2": null, "u-1": ADDED };
const SAVED_AT = "2026-11-01T10:00:00+00:00";

let editorId: string;

beforeAll(async () => {
  supabase("db", "reset", "--version", before, "--no-seed");
  await whenReady("book_parts");
  editorId = (await signInAs("editor")).userId;
  const { error } = await service.from("book_parts").insert([
    { part: "catalog", body: CATALOG, updated_at: SAVED_AT, updated_by: editorId },
    { part: "recipes", body: { recipeEdits: RECIPE_EDITS }, updated_at: SAVED_AT, updated_by: editorId },
  ]);
  if (error) throw error;
  supabase("migration", "up");
  await whenReady("recipes");
}, 240_000);

describe("Moving recipe edits from the shared block to records", () => {
  it("makes one record per edited, added or removed Recipe, with nothing lost", async () => {
    const { client } = await signInAs("viewer");
    const { data, error } = await client.from("recipes").select("id, author_id, body, deleted").order("id");
    expect(error).toBeNull();
    expect(data).toEqual([
      { id: "r-1", author_id: null, body: EDITED_ORIGINAL, deleted: false },
      { id: "r-2", author_id: null, body: null, deleted: true },
      { id: "u-1", author_id: null, body: ADDED, deleted: false },
    ]);
  });

  it("keeps when and by whom the edits were saved", async () => {
    const { data } = await service.from("recipes").select("created_at, updated_at, updated_by").eq("id", "u-1").single();
    expect(Date.parse(data!.created_at)).toBe(Date.parse(SAVED_AT));
    expect(Date.parse(data!.updated_at)).toBe(Date.parse(SAVED_AT));
    expect(data!.updated_by).toBe(editorId);
  });

  it("leaves the Product catalogue edits where they are and retires the recipes block", async () => {
    const { client } = await signInAs("viewer");
    const { data } = await client.from("book_parts").select("part, body");
    expect(data).toEqual([{ part: "catalog", body: CATALOG }]);
  });
});
