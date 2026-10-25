#!/usr/bin/env bash
# Local stand-in for a Supabase project, for tests: Postgres 16 with the PlotCloud migration, PostgREST, and the auth gateway
# (tests/backend/fake-supabase.mjs). Usage: tests/backend/local-backend.sh start | stop | reset
# Needs: PostgreSQL 16 server binaries, node, and PostgREST (downloaded once into tests/backend/.bin, or POSTGREST_BIN).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"; DATA="${PCPG_DATA:-/tmp/pc-pgdata}"; PGPORT="${PGPORT:-54329}"; RUN="${PCPG_RUN:-/tmp/pc-backend}"
SECRET="${JWT_SECRET:-local-test-secret-at-least-32-characters-long!!}"
as_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
PGRST="${POSTGREST_BIN:-$HERE/.bin/postgrest}"
fetch_pgrst() { [ -x "$PGRST" ] && return; mkdir -p "$HERE/.bin"; curl -sSL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz | tar xJ -C "$HERE/.bin"; }
stop() { [ -f "$RUN/gw.pid" ] && kill "$(cat "$RUN/gw.pid")" 2>/dev/null || true; [ -f "$RUN/pgrst.pid" ] && kill "$(cat "$RUN/pgrst.pid")" 2>/dev/null || true; rm -f "$RUN"/*.pid
  [ -d "$DATA" ] && as_pg "$PGBIN/pg_ctl" -D "$DATA" -m fast stop >/dev/null 2>&1 || true; }
case "${1:-start}" in
  stop) stop; exit 0;;
  reset) stop; rm -rf "$DATA";;
esac
fetch_pgrst; mkdir -p "$RUN"
if [ ! -f "$DATA/PG_VERSION" ]; then mkdir -p "$DATA"; [ "$(id -u)" = 0 ] && chown postgres "$DATA"; as_pg "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null; fi
as_pg "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PGPORT -k /tmp -c listen_addresses=127.0.0.1" -l "$DATA/log" status >/dev/null 2>&1 || as_pg "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PGPORT -k /tmp -c listen_addresses=127.0.0.1" -l "$DATA/log" -w start >/dev/null
P="psql -h /tmp -p $PGPORT -U postgres -v ON_ERROR_STOP=1 -q"
$P -tc "select 1 from pg_database where datname='plotcloud'" | grep -q 1 || $P -c "create database plotcloud"
$P -d plotcloud -f "$HERE/supabase-base.sql" -f "$ROOT/supabase/migrations/20261025000000_cloud_projects.sql" 2>&1 | grep -v NOTICE || true
cat > "$RUN/pgrst.conf" <<CONF
db-uri = "postgres://authenticator:authenticator@127.0.0.1:$PGPORT/plotcloud"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-port = 54330
server-host = "127.0.0.1"
CONF
"$PGRST" "$RUN/pgrst.conf" > "$RUN/pgrst.log" 2>&1 & echo $! > "$RUN/pgrst.pid"
JWT_SECRET="$SECRET" PGPORT="$PGPORT" node "$HERE/fake-supabase.mjs" > "$RUN/gw.log" 2>&1 & echo $! > "$RUN/gw.pid"
for i in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:54330/ 2>/dev/null && grep -q ANON_KEY "$RUN/gw.log" && break; sleep 0.25; done
grep ANON_KEY "$RUN/gw.log" > "$RUN/anon.env"; echo "Local backend: http://127.0.0.1:54321 ($(cat "$RUN/anon.env" | cut -c1-30)…)"
