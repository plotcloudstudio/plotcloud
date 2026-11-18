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
# a small stand-in for Supabase Storage (buckets and objects with row level security), so the bucket policies are applied and tried
$P -d plotcloud -c "create schema if not exists storage; create table if not exists storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table if not exists storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security; grant usage on schema storage to anon,authenticated; grant select,insert,update,delete on storage.objects to anon,authenticated;" >/dev/null
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
# Blog: an event needs its date and place; then published
fails user $OWNER "select public.pc_site_edit('save','post-kind','blog','{\"title\":\"T\",\"category\":\"talk\",\"body\":\"B\"}'::jsonb,0)" "Unknown blog category"
as_user $OWNER "select public.pc_site_edit('save','post-ev','blog','{\"title\":\"A talk\",\"category\":\"event\",\"body\":\"B\"}'::jsonb,0)" >/dev/null
fails user $OWNER "select public.pc_site_edit('publish','post-ev',null,null,1)" "Events require a date and a place"
as_user $OWNER "select public.pc_site_edit('save','post-ev','blog','{\"title\":\"A talk\",\"category\":\"event\",\"body\":\"B\",\"eventDate\":\"2026-12-03\",\"location\":\"Toronto\"}'::jsonb,1)" >/dev/null
as_user $OWNER "select public.pc_site_edit('publish','post-ev',null,null,2)" >/dev/null
as_anon "select public.pc_public_site_content()" | grep -q '"post-ev"' && pass "Blog: an event needs its date and place, then publishes"
# the resource library (2026-11-17): free and members-only items; the private bucket is read by founders and members only
fails user $OWNER "select public.pc_site_edit('save','lib-x','resource','{\"type\":\"library\",\"title\":\"T\",\"summary\":\"S\",\"category\":\"music\"}'::jsonb,0)" "Choose a library category"
fails user $OWNER "select public.pc_site_edit('save','lib-x','resource','{\"type\":\"library\",\"title\":\"T\",\"summary\":\"S\",\"category\":\"cad\",\"access\":\"members\",\"file\":\"https://x.test/a.zip\"}'::jsonb,0)" "must be uploaded to the private library"
fails user $OWNER "select public.pc_site_edit('save','lib-x','resource','{\"type\":\"library\",\"title\":\"T\",\"summary\":\"S\",\"category\":\"cad\",\"access\":\"free\",\"file\":\"library-files/2026/a.zip\"}'::jsonb,0)" "must be an https address"
as_user $OWNER "select public.pc_site_edit('save','lib-1','resource','{\"type\":\"library\",\"title\":\"Detail set\",\"summary\":\"S\",\"category\":\"cad\",\"access\":\"members\",\"formats\":\"dwg, pdf\"}'::jsonb,0)" >/dev/null
fails user $OWNER "select public.pc_site_edit('publish','lib-1',null,null,1)" "needs its file before publishing"
as_user $OWNER "select public.pc_site_edit('save','lib-1','resource','{\"type\":\"library\",\"title\":\"Detail set\",\"summary\":\"S\",\"category\":\"cad\",\"access\":\"members\",\"formats\":\"dwg, pdf\",\"file\":\"library-files/2026/abc-details.zip\"}'::jsonb,1)" >/dev/null
as_user $OWNER "select public.pc_site_edit('publish','lib-1',null,null,2)" >/dev/null
as_anon "select public.pc_public_site_content()" | grep -q '"lib-1"' && pass "library: category, access and file rules; a members-only item published"
[ "$($D -c "select public from storage.buckets where id='library-files'")" = f ] || { echo "FAIL the library bucket must be private"; exit 1; }
$D -c "insert into storage.objects(bucket_id,name) values ('library-files','2026/abc-details.zip'),('site-files','2026/free.pdf')" >/dev/null
MEMBER=44444444-4444-4444-8444-444444444444
$D -c "insert into auth.users (id,email,encrypted_password,email_confirmed_at) values ('$MEMBER','member@test.invalid','x',now()); insert into private.pc_memberships(user_id,starts_at,expires_at,access_type) values ('$MEMBER',now()-interval '1 day',now()+interval '30 days','month')" >/dev/null
seen() { if [ "$1" = anon ]; then as_anon "select count(*) from storage.objects where bucket_id='library-files'"; else as_user "$1" "select count(*) from storage.objects where bucket_id='library-files'"; fi; }
[ "$(seen $MEMBER)" = 1 ] && [ "$(seen $OWNER)" = 1 ] && [ "$(seen $USER2)" = 0 ] && [ "$(seen anon)" = 0 ] || { echo "FAIL library read: member $(seen $MEMBER) founder $(seen $OWNER) other $(seen $USER2) visitor $(seen anon)"; exit 1; }
$D -c "update private.pc_memberships set expires_at=now()-interval '1 minute', starts_at=now()-interval '31 days' where user_id='$MEMBER'" >/dev/null
[ "$(seen $MEMBER)" = 0 ] || { echo "FAIL an expired member still reads the library"; exit 1; }
[ "$(as_anon "select count(*) from storage.objects where bucket_id='site-files'")" = 1 ] || { echo "FAIL public site files"; exit 1; }
pass "library bucket: private; a member and the founder read it, another user, a visitor and an expired member do not; site files stay public"
fails user $USER2 "insert into storage.objects(bucket_id,name) values ('library-files','x/evil.zip')" "row-level security"
pass "only founders upload to the library"
echo "ALL PASS"
