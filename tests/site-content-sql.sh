#!/usr/bin/env bash
# The founder content database on a real PostgreSQL 16 (2026-11-17): the complete setup file applied twice (it must be rerunnable),
# then, acting as a founder and as a visitor through the same functions PostgREST exposes: a paper is saved, refused until it has
# its PDF or link, published and read back; a tutorial with a video from an unlisted host is refused; the About page's LinkedIn,
# testimonials and clients round-trip; a non-founder is refused; the two retired studio notes are gone; the owner appointment SQL.
# Needs the PostgreSQL 16 server binaries (PGBIN) and psql. Usage: tests/site-content-sql.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"; DATA="${PCPG_DATA:-/tmp/pc-sqltest-pgdata}"; PGPORT="${PGPORT:-54339}"
as_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
stop() { [ -d "$DATA" ] && as_pg "$PGBIN/pg_ctl" -D "$DATA" -m fast stop >/dev/null 2>&1 || true; }
trap stop EXIT
stop; rm -rf "$DATA"; mkdir -p "$DATA"; [ "$(id -u)" = 0 ] && chown postgres "$DATA"
as_pg "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
as_pg "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PGPORT -k /tmp -c listen_addresses=127.0.0.1" -l "$DATA/log" -w start >/dev/null
P="psql -h /tmp -p $PGPORT -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "create database plotcloud" >/dev/null
$P -d plotcloud -f "$HERE/backend/supabase-base.sql" 2>&1 | grep -v NOTICE || true
$P -d plotcloud -c "alter table auth.users add column if not exists email_confirmed_at timestamptz" >/dev/null   # as on Supabase; the test base file has no such column
# the file the founder pastes, twice
$P -d plotcloud -f "$ROOT/supabase/setup-plotcloud.sql" 2>&1 | grep -v NOTICE || true
$P -d plotcloud -f "$ROOT/supabase/setup-plotcloud.sql" 2>&1 | grep -v NOTICE || true
D="psql -h /tmp -p $PGPORT -U postgres -d plotcloud -tA -v ON_ERROR_STOP=1 -q"
OWNER=11111111-1111-4111-8111-111111111111; USER2=22222222-2222-4222-8222-222222222222
$D -c "insert into auth.users (id,email,encrypted_password,email_confirmed_at) values ('$OWNER','owner@test.invalid','x',now()),('$USER2','user@test.invalid','x',now()); insert into private.pc_admins values ('$OWNER');"
# run a statement as a signed-in person (role authenticated, the JWT claims PostgREST would set) or as a visitor (anon)
as_user() { local uid="$1"; shift; $D -c "begin; set local role authenticated; select set_config('request.jwt.claims','{\"sub\":\"$uid\",\"role\":\"authenticated\"}',true); $* ; commit;" | sed -n '2p'; }
as_anon() { $D -c "begin; set local role anon; $* ; commit;" | sed -n '1p'; }
fails() { local who="$1" uid="$2" sql="$3" want="$4"; local out; if [ "$who" = anon ]; then out=$(as_anon "$sql" 2>&1 || true); else out=$(as_user "$uid" "$sql" 2>&1 || true); fi; echo "$out" | grep -q "$want" || { echo "FAIL expected '$want' from: $sql"; echo "$out" | head -3; exit 1; }; }
pass() { echo "PASS $1"; }

# the retired studio notes are gone; the About seed stays
[ "$($D -c "select count(*) from private.pc_site_content where id in ('compare','illustration')")" = 0 ] && pass "the two studio notes are not seeded"
[ "$($D -c "select count(*) from private.pc_site_content where id='about'")" = 1 ] && pass "the About page is seeded once (setup ran twice)"
# a visitor reads published content only; a non-founder cannot edit
fails anon - "select public.pc_site_edit('list')" "permission denied"
fails user $USER2 "select public.pc_site_edit('list')" "Founder access required"
pass "visitors and non-founders cannot edit"
# a paper: saved as a draft, refused for publishing without its PDF or link, then published and read by a visitor
R=$(as_user $OWNER "select public.pc_site_edit('save','res-paper','resource','{\"type\":\"paper\",\"title\":\"A test paper\",\"summary\":\"Summary.\",\"authors\":\"A. Author\",\"date\":\"2026-11-17\"}'::jsonb,0)")
echo "$R" | grep -q '"revision": 1' || { echo "FAIL save: $R"; exit 1; }
fails user $OWNER "select public.pc_site_edit('publish','res-paper',null,null,1)" "needs its PDF or a link"
as_user $OWNER "select public.pc_site_edit('save','res-paper','resource','{\"type\":\"paper\",\"title\":\"A test paper\",\"summary\":\"Summary.\",\"authors\":\"A. Author\",\"date\":\"2026-11-17\",\"file\":\"https://cgxszynizkbiblfiaowf.supabase.co/storage/v1/object/public/site-files/2026/x-paper.pdf\"}'::jsonb,1)" >/dev/null
as_user $OWNER "select public.pc_site_edit('publish','res-paper',null,null,2)" >/dev/null
PUB=$(as_anon "select public.pc_public_site_content()")
echo "$PUB" | grep -q '"id": "res-paper"' && echo "$PUB" | grep -q '"kind": "resource"' || { echo "FAIL visitor read: $PUB" | cut -c1-300; exit 1; }
echo "$PUB" | grep -q '"draft"' && { echo "FAIL drafts leak"; exit 1; }
pass "a paper: draft, refused without its PDF, published, read by a visitor"
# validation: a video from an unlisted host, a bad date, an http link
fails user $OWNER "select public.pc_site_edit('save','res-tut','resource','{\"type\":\"tutorial\",\"title\":\"T\",\"summary\":\"S\",\"video\":\"https://example.com/v\"}'::jsonb,0)" "YouTube, Bilibili or Vimeo"
fails user $OWNER "select public.pc_site_edit('save','res-tut','resource','{\"type\":\"tutorial\",\"title\":\"T\",\"summary\":\"S\",\"date\":\"17/11/2026\"}'::jsonb,0)" "YYYY-MM-DD"
fails user $OWNER "select public.pc_site_edit('save','res-tut','resource','{\"type\":\"news\",\"title\":\"T\",\"summary\":\"S\",\"link\":\"http://x.test\"}'::jsonb,0)" "must be https"
as_user $OWNER "select public.pc_site_edit('save','res-tut','resource','{\"type\":\"tutorial\",\"title\":\"Tutorial\",\"summary\":\"S\",\"video\":\"https://www.youtube.com/watch?v=abc123\"}'::jsonb,0)" >/dev/null
as_user $OWNER "select public.pc_site_edit('publish','res-tut',null,null,1)" >/dev/null
as_user $OWNER "select public.pc_site_edit('unpublish','res-tut',null,null,2)" >/dev/null
as_anon "select public.pc_public_site_content()" | grep -q '"res-tut"' && { echo "FAIL unpublish"; exit 1; }
pass "a tutorial: video host, date and link validated; published, then unpublished"
# About: LinkedIn, testimonials and clients
ABOUT=$(as_user $OWNER "select public.pc_site_edit('list')" | python3 -c "import sys,json;d=json.load(sys.stdin);a=[x for x in d if x['id']=='about'][0];print(a['revision'])")
fails user $OWNER "select public.pc_site_edit('save','about','about','{\"headline\":\"H\",\"intro\":\"I\",\"team\":[{\"name\":\"N\",\"linkedin\":\"https://example.com/me\"}]}'::jsonb,$ABOUT)" "linkedin.com"
as_user $OWNER "select public.pc_site_edit('save','about','about','{\"headline\":\"H\",\"intro\":\"I\",\"team\":[{\"name\":\"Founder\",\"role\":\"Founder\",\"linkedin\":\"https://www.linkedin.com/in/founder\",\"sample\":false}],\"testimonials\":[{\"quote\":\"Q\",\"name\":\"N\",\"sample\":true}],\"clients\":[{\"name\":\"C\",\"url\":\"https://c.test\",\"sample\":true}]}'::jsonb,$ABOUT)" >/dev/null
as_user $OWNER "select public.pc_site_edit('publish','about',null,null,$((ABOUT+1)))" >/dev/null
as_anon "select public.pc_public_site_content()" | python3 -c "
import sys,json;d=json.load(sys.stdin);a=[x for x in d if x['id']=='about'][0]['content']
assert a['team'][0]['linkedin'].startswith('https://www.linkedin.com/') and len(a['testimonials'])==1 and len(a['clients'])==1, a
print('PASS About: LinkedIn, a testimonial and a client published')"
# the storage policy wrapper exists for founders only
[ "$(as_user $OWNER "select public.pc_can_upload_site_files()")" = t ] && [ "$(as_user $USER2 "select public.pc_can_upload_site_files()")" = f ] && pass "site-files upload right: founder yes, others no"
# the owner appointment (supabase/appoint-admin.sql): refused until plotcloudstudio@gmail.com is registered and confirmed, then appointed
$P -d plotcloud -f "$ROOT/supabase/appoint-admin.sql" >/dev/null 2>&1 && { echo "FAIL appointment ran without the account"; exit 1; }
OWNER2=33333333-3333-4333-8333-333333333333
$D -c "insert into auth.users (id,email,encrypted_password,email_confirmed_at) values ('$OWNER2','plotcloudstudio@gmail.com','x',now())"
$P -d plotcloud -f "$ROOT/supabase/appoint-admin.sql" >/dev/null
[ "$($D -c "select count(*) from private.pc_admins where user_id='$OWNER2'")" = 1 ] && [ "$(as_user $OWNER2 "select public.pc_can_upload_site_files()")" = t ] && pass "appoint-admin.sql: refused before plotcloudstudio@gmail.com exists, then appoints it"
echo "ALL PASS"
