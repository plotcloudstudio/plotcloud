#!/usr/bin/env bash
# Stripe subscriptions in the database (2026-11-20): a throwaway PostgreSQL 16 with the membership migrations and the Stripe one.
# Checks: a paid subscription opens access until the paid period's end (+1 day); a renewal extends it; the same event twice changes
# nothing; a cancelled subscription keeps access to the period's end; a manual permanent grant is never shortened; a longer manual
# period is kept; the browser's roles cannot call the Stripe functions; pc_access_status reports the subscription.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"; PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
DATA="$(mktemp -d /tmp/pc-stripe-pg.XXXX)"; PORT="${PGPORT_STRIPE:-54339}"
as_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$DATA"
as_pg "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
as_pg "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=''" -l "$DATA/log" -w start >/dev/null
trap 'as_pg "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1; rm -rf "$DATA"' EXIT
P="psql -h /tmp -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -X"
$P -c "create database t" >/dev/null
$P -d t >/dev/null <<'SQL'
do $$ begin if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end $$;
SQL
$P -d t -f "$HERE/supabase-base.sql" >/dev/null
$P -d t -c "alter table auth.users add column if not exists email_confirmed_at timestamptz" >/dev/null
for f in 20261026000000_memberships 20261027000000_membership_durations 20261118000000_founder_access 20261120000000_stripe_subscriptions 20261120000000_stripe_subscriptions; do
  $P -d t -f "$ROOT/supabase/migrations/$f.sql" 2>&1 | grep -v -E 'NOTICE|^$' || true; done
$P -d t <<'SQL'
\set QUIET on
insert into auth.users(id,email,encrypted_password,email_confirmed_at) values
 ('00000000-0000-0000-0000-00000000000a','a@x.test','x',now()),('00000000-0000-0000-0000-00000000000b','b@x.test','x',now()),
 ('00000000-0000-0000-0000-00000000000c','c@x.test','x',now());
create or replace function pg_temp.ok(c boolean,msg text) returns void language plpgsql as $$ begin if not coalesce(c,false) then raise exception 'FAIL %',msg; end if; raise notice 'PASS %',msg; end $$;
create or replace function pg_temp.st(u text) returns jsonb language plpgsql as $$ declare r jsonb; begin perform set_config('request.jwt.claims',json_build_object('sub',u)::text,true); set local role authenticated; r=public.pc_access_status(); reset role; return r; end $$;
set client_min_messages=notice;
-- A subscribes: customer linked by the checkout function, then the webhook reports an active subscription for 30 days
set role service_role;
select public.pc_stripe_link('00000000-0000-0000-0000-00000000000a','cus_A1');
select public.pc_stripe_apply('evt_1','checkout.session.completed','00000000-0000-0000-0000-00000000000a','cus_A1','sub_A1','active',now()+interval '30 days',false);
reset role;
select pg_temp.ok((pg_temp.st('00000000-0000-0000-0000-00000000000a')->>'active')::boolean,'a paid subscription opens access');
select pg_temp.ok((pg_temp.st('00000000-0000-0000-0000-00000000000a')->>'paidBy')='stripe' and (pg_temp.st('00000000-0000-0000-0000-00000000000a')->'subscription'->>'status')='active','the status says it is paid by Stripe and the subscription is active');
select pg_temp.ok(abs(extract(epoch from ((pg_temp.st('00000000-0000-0000-0000-00000000000a')->>'expiresAt')::timestamptz-(now()+interval '31 days'))))<5,'access runs to the paid period''s end plus one day');
-- the same event again changes nothing; the renewal extends
set role service_role;
select pg_temp.ok((public.pc_stripe_apply('evt_1','checkout.session.completed','00000000-0000-0000-0000-00000000000a','cus_A1','sub_A1','active',now()+interval '90 days',false)->>'repeated')::boolean,'the same Stripe event twice is applied once');
select public.pc_stripe_apply('evt_2','invoice.paid',null,'cus_A1','sub_A1','active',now()+interval '60 days',false);
reset role;
select pg_temp.ok(abs(extract(epoch from ((pg_temp.st('00000000-0000-0000-0000-00000000000a')->>'expiresAt')::timestamptz-(now()+interval '61 days'))))<5,'a renewal (found by the customer id) extends access');
-- cancelled at the period's end: access stays until then
set role service_role;
select public.pc_stripe_apply('evt_3','customer.subscription.deleted',null,'cus_A1','sub_A1','canceled',now()+interval '60 days',true);
reset role;
select pg_temp.ok((pg_temp.st('00000000-0000-0000-0000-00000000000a')->>'active')::boolean and (pg_temp.st('00000000-0000-0000-0000-00000000000a')->'subscription'->>'status')='canceled','a cancelled subscription keeps access to the end of the paid period');
update private.pc_memberships set expires_at=now()-interval '1 minute', starts_at=now()-interval '2 days' where user_id='00000000-0000-0000-0000-00000000000a';
select pg_temp.ok(not (pg_temp.st('00000000-0000-0000-0000-00000000000a')->>'active')::boolean,'after the period, no access');
-- B has permanent manual access; C has a manual year. Stripe never shortens them.
insert into private.pc_memberships(user_id,starts_at,expires_at,access_type,source) values('00000000-0000-0000-0000-00000000000b',now(),null,'permanent','manual'),('00000000-0000-0000-0000-00000000000c',now(),now()+interval '365 days','year','manual');
set role service_role;
select public.pc_stripe_apply('evt_4','invoice.paid','00000000-0000-0000-0000-00000000000b','cus_B1','sub_B1','active',now()+interval '30 days',false);
select public.pc_stripe_apply('evt_5','invoice.paid','00000000-0000-0000-0000-00000000000c','cus_C1','sub_C1','active',now()+interval '30 days',false);
reset role;
select pg_temp.ok((select access_type='permanent' and expires_at is null and source='manual' from private.pc_memberships where user_id='00000000-0000-0000-0000-00000000000b'),'permanent manual access is not changed');
select pg_temp.ok((select expires_at>now()+interval '360 days' and source='manual' from private.pc_memberships where user_id='00000000-0000-0000-0000-00000000000c'),'a longer manual period is kept');
-- the browser's roles cannot reach the Stripe functions
do $$ begin set local role authenticated; begin perform public.pc_stripe_apply('evt_9','x','00000000-0000-0000-0000-00000000000a','cus_A1','sub','active',now()+interval '300 days',false); raise exception 'FAIL authenticated could call pc_stripe_apply'; exception when insufficient_privilege then raise notice 'PASS a signed-in browser cannot call pc_stripe_apply'; end; end $$;
do $$ begin set local role anon; begin perform public.pc_stripe_link('00000000-0000-0000-0000-00000000000a','cus_X'); raise exception 'FAIL anon could call pc_stripe_link'; exception when insufficient_privilege then raise notice 'PASS an anonymous browser cannot call pc_stripe_link'; end; end $$;
select pg_temp.ok((select count(*)=4 from private.pc_access_audit where reference like 'stripe:evt_%'),'each paid event is in the audit trail once');
SQL
echo "stripe-sql: all checks passed"
