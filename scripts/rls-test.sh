#!/usr/bin/env bash
# RLS + RPC test for the Live-Raum migrations.
#
#   scripts/rls-test.sh                 # throwaway Postgres 17 in Docker + a small Supabase auth shim
#   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres scripts/rls-test.sh
#                                       # against `supabase start` (migrations already applied)
#
# The test runs in one transaction and rolls back, so it leaves no data behind.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -n "${DATABASE_URL:-}" ]]; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
  exit
fi

name=ai4s-rls-test
docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --name "$name" -e POSTGRES_PASSWORD=postgres postgres:17-alpine >/dev/null
trap 'docker rm -f "$name" >/dev/null' EXIT
until docker exec "$name" pg_isready -U postgres -q; do sleep 0.5; done
sleep 1
run() { docker exec -i "$name" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
run < supabase/tests/shim.sql
for f in supabase/migrations/*.sql; do
  echo "applying $f"
  run < "$f"
done
run < supabase/tests/rls.test.sql
