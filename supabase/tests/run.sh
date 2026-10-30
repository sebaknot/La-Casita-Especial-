#!/usr/bin/env bash
# Applies every migration to a throwaway database and runs the RLS/seed checks.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
db="casita_test_$$"
psql() { command psql -X -q -v ON_ERROR_STOP=1 "$@"; }
createdb "$db"
trap 'dropdb "$db"' EXIT
psql -d "$db" -f "$here/auth_stub.sql"
for f in "$here"/../migrations/*.sql; do psql -d "$db" -f "$f"; done
psql -d "$db" -f "$here/grants.sql"
psql -d "$db" -f "$here/rls_test.sql"
