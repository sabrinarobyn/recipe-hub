import { defineConfig } from "vitest/config";

/** Database tests: run against a local Supabase stack by `npm run test:db` (scripts/test-db.sh). */
export default defineConfig({
  test: {
    environment: "node",
    include: ["supabase/tests/**/*.test.ts"],
    // Every file shares one database (the Recipe Book has fixed rows), so run files one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
