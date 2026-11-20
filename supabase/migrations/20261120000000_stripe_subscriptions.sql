-- Stripe subscriptions (2026-11-20). Monthly access paid by card through Stripe, alongside the manual e-transfer grants.
-- The browser never writes access: only the stripe-webhook Edge Function (service role, Stripe signature checked) calls
-- pc_stripe_apply, and the browser keeps reading pc_access_status. A Stripe subscription keeps the membership running until the
-- end of the period Stripe has been paid for (plus one day for a late renewal); cancelling stops it at the end of that period.
-- Manual grants are left as they are: a longer manual period or permanent access is never shortened by Stripe.
-- Run as the database owner after the earlier membership migrations. It can be run again.
begin;
alter table private.pc_memberships add column if not exists source text not null default 'manual';
alter table private.pc_memberships drop constraint if exists pc_membership_source;
alter table private.pc_memberships add constraint pc_membership_source check (source in ('manual','stripe'));

create table if not exists private.pc_stripe_customers(
 user_id uuid primary key references auth.users(id) on delete cascade,
 customer_id text not null unique,
 subscription_id text,
 status text,
 current_period_end timestamptz,
 cancel_at_period_end boolean not null default false,
 updated_at timestamptz not null default now()
);
create table if not exists private.pc_stripe_events(
 event_id text primary key, type text not null, user_id uuid, received_at timestamptz not null default now()
);
alter table private.pc_stripe_customers enable row level security;
alter table private.pc_stripe_events enable row level security;
revoke all on private.pc_stripe_customers,private.pc_stripe_events from public,anon,authenticated;

-- the Stripe customer of a person (the checkout function creates one the first time)
create or replace function private.pc_stripe_customer(p_user_id uuid) returns text language sql stable security definer set search_path='' as $$
 select customer_id from private.pc_stripe_customers where user_id=p_user_id;
$$;
create or replace function private.pc_stripe_link(p_user_id uuid,p_customer text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_customer is null or p_customer !~ '^cus_[A-Za-z0-9]+$' then raise exception 'Invalid Stripe customer'; end if;
 insert into private.pc_stripe_customers(user_id,customer_id) values(p_user_id,p_customer)
 on conflict(user_id) do update set customer_id=excluded.customer_id,updated_at=now();
end $$;

-- one Stripe event: the subscription's state as Stripe reports it. Idempotent by event id.
create or replace function private.pc_stripe_apply(p_event_id text,p_type text,p_user_id uuid,p_customer text,p_subscription text,
 p_status text,p_period_end timestamptz,p_cancel_at_period_end boolean) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare m private.pc_memberships; uid uuid; paid boolean; new_end timestamptz;
begin
 if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9]+$' then raise exception 'Invalid Stripe event'; end if;
 if exists(select 1 from private.pc_stripe_events where event_id=p_event_id) then return jsonb_build_object('ok',true,'repeated',true); end if;
 uid=coalesce(p_user_id,(select user_id from private.pc_stripe_customers where customer_id=p_customer));
 if uid is null or not exists(select 1 from auth.users where id=uid) then raise exception 'No account for this Stripe customer'; end if;
 perform 1 from auth.users where id=uid for update;
 insert into private.pc_stripe_customers(user_id,customer_id,subscription_id,status,current_period_end,cancel_at_period_end,updated_at)
  values(uid,p_customer,p_subscription,p_status,p_period_end,coalesce(p_cancel_at_period_end,false),now())
 on conflict(user_id) do update set customer_id=coalesce(excluded.customer_id,private.pc_stripe_customers.customer_id),
  subscription_id=coalesce(excluded.subscription_id,private.pc_stripe_customers.subscription_id),status=excluded.status,
  current_period_end=coalesce(excluded.current_period_end,private.pc_stripe_customers.current_period_end),
  cancel_at_period_end=excluded.cancel_at_period_end,updated_at=now();
 paid = p_status in ('active','trialing') and p_period_end is not null and p_period_end>now();
 if paid then
  new_end=p_period_end+interval '1 day';
  select * into m from private.pc_memberships where user_id=uid;
  if m.user_id is null or m.revoked_at is not null or (m.access_type<>'permanent' and m.expires_at<=now()) then
   insert into private.pc_memberships(user_id,starts_at,expires_at,revoked_at,access_type,source) values(uid,now(),new_end,null,'month','stripe')
   on conflict(user_id) do update set starts_at=excluded.starts_at,expires_at=excluded.expires_at,revoked_at=null,access_type='month',source='stripe';
  elsif m.access_type<>'permanent' and m.expires_at<new_end then
   update private.pc_memberships set expires_at=new_end,source='stripe' where user_id=uid;
  end if;
  insert into private.pc_access_audit(request_id,actor_id,user_id,action,reference,starts_at,expires_at,access_type)
   select gen_random_uuid(),uid,uid,'extend','stripe:'||p_event_id,m2.starts_at,m2.expires_at,m2.access_type from private.pc_memberships m2 where m2.user_id=uid;
 end if;
 -- a cancelled or unpaid subscription is not cut short here: the membership already ends at the paid period's end
 insert into private.pc_stripe_events(event_id,type,user_id) values(p_event_id,p_type,uid);
 return jsonb_build_object('ok',true,'user',uid,'paid',paid);
end $$;

-- service-role wrappers (PostgREST exposes the public schema only); no grant to anon or authenticated
create or replace function public.pc_stripe_customer(p_user_id uuid) returns text language sql security invoker set search_path='' as $$select private.pc_stripe_customer(p_user_id)$$;
create or replace function public.pc_stripe_link(p_user_id uuid,p_customer text) returns void language sql security invoker set search_path='' as $$select private.pc_stripe_link(p_user_id,p_customer)$$;
create or replace function public.pc_stripe_apply(p_event_id text,p_type text,p_user_id uuid,p_customer text,p_subscription text,p_status text,p_period_end timestamptz,p_cancel_at_period_end boolean) returns jsonb
 language sql security invoker set search_path='' as $$select private.pc_stripe_apply(p_event_id,p_type,p_user_id,p_customer,p_subscription,p_status,p_period_end,p_cancel_at_period_end)$$;
revoke all on function private.pc_stripe_customer(uuid),private.pc_stripe_link(uuid,text),private.pc_stripe_apply(text,text,uuid,text,text,text,timestamptz,boolean) from public,anon,authenticated;
revoke all on function public.pc_stripe_customer(uuid),public.pc_stripe_link(uuid,text),public.pc_stripe_apply(text,text,uuid,text,text,text,timestamptz,boolean) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.pc_stripe_customer(uuid),private.pc_stripe_link(uuid,text),private.pc_stripe_apply(text,text,uuid,text,text,text,timestamptz,boolean) to service_role;
grant execute on function public.pc_stripe_customer(uuid),public.pc_stripe_link(uuid,text),public.pc_stripe_apply(text,text,uuid,text,text,text,timestamptz,boolean) to service_role;

-- the status the browser reads: as before, plus where the access comes from and the subscription's state
create or replace function private.pc_access_status() returns jsonb language sql stable security definer set search_path='' as $$
 select (case when private.pc_is_admin()
  then jsonb_build_object('active',true,'startsAt',null,'expiresAt',null,'accessType','permanent','serverNow',now(),'source','account','founder',true)
  else (select jsonb_build_object('active',coalesce(m.user_id is not null and m.revoked_at is null and m.starts_at<=now() and (m.access_type='permanent' or m.expires_at>now()),false),'startsAt',m.starts_at,'expiresAt',m.expires_at,'accessType',m.access_type,'serverNow',now(),'source','account','paidBy',coalesce(m.source,'manual'))
   from (select 1) x left join private.pc_memberships m on m.user_id=auth.uid()) end)
  || coalesce((select jsonb_build_object('subscription',jsonb_build_object('status',s.status,'periodEnd',s.current_period_end,'cancelAtPeriodEnd',s.cancel_at_period_end))
   from private.pc_stripe_customers s where s.user_id=auth.uid() and s.subscription_id is not null),'{}'::jsonb);
$$;
revoke all on function private.pc_access_status() from public,anon,authenticated;
grant execute on function private.pc_access_status() to authenticated;
notify pgrst,'reload schema';
commit;
