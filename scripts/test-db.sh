#!/usr/bin/env bash
# Runs the database tests (supabase/tests) against a local Supabase stack with the repo's migrations.
#
#   npm run test:db               # all database tests
#   npm run test:db -- photos     # extra arguments go to vitest (here: only files matching "photos")
#
# Needs Docker. If no local stack is running, this starts one (only the services the tests use) and
# stops it afterwards. If one is already running, it is reset to the migrations (its data is wiped)
# and left running.
set -euo pipefail
cd "$(dirname "$0")/.."

started=0
if ! npx supabase status >/dev/null 2>&1; then
  npx supabase start -x studio,logflare,mailpit,postgres-meta,vector,imgproxy,edge-runtime,supavisor
  started=1
else
  npx supabase db reset
fi
stop() { if [ "$started" = 1 ]; then npx supabase stop --no-backup; fi; }
trap stop EXIT

# API_URL, ANON_KEY, SERVICE_ROLE_KEY and friends, for the tests to read from the environment.
set -a
eval "$(npx supabase status -o env)"
set +a

npx vitest run --config vitest.db.config.ts "$@"
