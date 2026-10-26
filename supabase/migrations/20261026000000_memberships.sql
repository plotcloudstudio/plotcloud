-- Run after cloud_projects.sql as the database owner. No automatic admin by email or user metadata.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create table if not exists private.pc_admins(user_id uuid primary key references auth.users(id) on delete cascade);
create table if not exists private.pc_memberships(
 user_id uuid primary key references auth.users(id) on delete cascade,
 starts_at timestamptz not null, expires_at timestamptz not null,
 revoked_at timestamptz, check(expires_at>starts_at)
);
create table if not exists private.pc_access_audit(
 request_id uuid primary key, actor_id uuid not null references auth.users(id),
 user_id uuid not null references auth.users(id), action text not null check(action in ('grant','extend','revoke')),
 reference text not null, created_at timestamptz not null default now(),
 starts_at timestamptz, expires_at timestamptz
);
create unique index if not exists pc_unique_payment_reference on private.pc_access_audit(lower(reference)) where action in ('grant','extend');
alter table private.pc_admins enable row level security;
alter table private.pc_memberships enable row level security;
alter table private.pc_access_audit enable row level security;
revoke all on private.pc_admins,private.pc_memberships,private.pc_access_audit from public,anon,authenticated;
create or replace function private.pc_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.pc_admins a where a.user_id=auth.uid());
$$;
create or replace function private.pc_access_status() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('active',coalesce(m.revoked_at is null and m.starts_at<=now() and m.expires_at>now(),false),'startsAt',m.starts_at,'expiresAt',m.expires_at,'serverNow',now(),'source','account')
 from (select 1) x left join private.pc_memberships m on m.user_id=auth.uid();
$$;
create or replace function private.pc_admin_search(p_query text default '',p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.pc_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if length(p_query)>200 or p_offset<0 or p_offset>100000 then raise exception 'Invalid search'; end if;
 select coalesce(jsonb_agg(t),'[]'::jsonb) into result from (
 select u.id,u.email,coalesce(u.raw_user_meta_data->>'name','') as name,u.created_at as registered_at,
 u.email_confirmed_at is not null as email_confirmed,m.starts_at,m.expires_at,m.revoked_at,
 coalesce(m.revoked_at is null and m.starts_at<=now() and m.expires_at>now(),false) as active
 from auth.users u left join private.pc_memberships m on m.user_id=u.id
 where trim(p_query)='' or position(lower(trim(p_query)) in lower(coalesce(u.email,'')))>0 or position(lower(trim(p_query)) in lower(coalesce(u.raw_user_meta_data->>'name','')))>0
 order by u.created_at desc,u.id limit 25 offset p_offset
 )t;
 return result;
end $$;
create or replace function private.pc_admin_access(p_user_id uuid,p_action text,p_reference text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare m private.pc_memberships; prior private.pc_access_audit; start_time timestamptz; end_time timestamptz;
begin
 if not private.pc_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('grant','extend','revoke') or p_request_id is null or p_reference is null or length(trim(p_reference)) not between 3 and 160 then raise exception 'Action and a payment/support reference are required'; end if;
 -- Serialize all changes for this account. Repeated requests cannot add extra months.
 perform 1 from auth.users where id=p_user_id for update;
 if not found then raise exception 'Account not found'; end if;
 select * into prior from private.pc_access_audit where request_id=p_request_id;
 if found then
  if prior.actor_id<>auth.uid() or prior.user_id<>p_user_id or prior.action<>p_action or prior.reference<>trim(p_reference) then raise exception 'Request ID already used'; end if;
  return jsonb_build_object('ok',true,'expiresAt',prior.expires_at,'repeated',true);
 end if;
 if p_action<>'revoke' and exists(select 1 from private.pc_access_audit where action in ('grant','extend') and lower(reference)=lower(trim(p_reference))) then raise exception 'This payment reference was already used';end if;
 if p_action<>'revoke' and not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then raise exception 'The customer must confirm their registration email first'; end if;
 select * into m from private.pc_memberships where user_id=p_user_id;
 if p_action='revoke' then
  if m.user_id is null then raise exception 'No access to revoke'; end if;
  update private.pc_memberships set revoked_at=now() where user_id=p_user_id;
  start_time=m.starts_at;end_time=m.expires_at;
 else
  if p_action='grant' and m.revoked_at is null and m.expires_at>now() then raise exception 'Access is already active. Use Extend 1 month.'; end if;
  start_time=case when p_action='extend' and m.revoked_at is null and m.expires_at>now() then m.starts_at else now() end;
  end_time=(case when p_action='extend' and m.revoked_at is null and m.expires_at>now() then m.expires_at else now() end)+interval '1 month';
  insert into private.pc_memberships(user_id,starts_at,expires_at,revoked_at) values(p_user_id,start_time,end_time,null)
  on conflict(user_id) do update set starts_at=excluded.starts_at,expires_at=excluded.expires_at,revoked_at=null;
 end if;
 insert into private.pc_access_audit(request_id,actor_id,user_id,action,reference,starts_at,expires_at) values(p_request_id,auth.uid(),p_user_id,p_action,trim(p_reference),start_time,end_time);
 return jsonb_build_object('ok',true,'startsAt',start_time,'expiresAt',end_time,'revoked',p_action='revoke');
end $$;
create or replace function private.pc_admin_history(p_user_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.pc_is_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 select coalesce(jsonb_agg(t),'[]'::jsonb) into result from(select action,reference,created_at,starts_at,expires_at from private.pc_access_audit where user_id=p_user_id order by created_at desc limit 50)t;
 return result;
end $$;
-- Only invoker wrappers are exposed by PostgREST; every private operation checks the signed-in actor.
create or replace function public.pc_is_admin() returns boolean language sql security invoker set search_path='' as $$select private.pc_is_admin()$$;
create or replace function public.pc_access_status() returns jsonb language sql security invoker set search_path='' as $$select private.pc_access_status()$$;
create or replace function public.pc_admin_search(p_query text default '',p_offset integer default 0) returns jsonb language sql security invoker set search_path='' as $$select private.pc_admin_search(p_query,p_offset)$$;
create or replace function public.pc_admin_access(p_user_id uuid,p_action text,p_reference text,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.pc_admin_access(p_user_id,p_action,p_reference,p_request_id)$$;
create or replace function public.pc_admin_history(p_user_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.pc_admin_history(p_user_id)$$;
revoke all on function private.pc_is_admin(),private.pc_access_status(),private.pc_admin_search(text,integer),private.pc_admin_access(uuid,text,text,uuid),private.pc_admin_history(uuid) from public,anon,authenticated;
revoke all on function public.pc_is_admin(),public.pc_access_status(),public.pc_admin_search(text,integer),public.pc_admin_access(uuid,text,text,uuid),public.pc_admin_history(uuid) from public,anon,authenticated;
grant execute on function private.pc_is_admin(),private.pc_access_status(),private.pc_admin_search(text,integer),private.pc_admin_access(uuid,text,text,uuid),private.pc_admin_history(uuid) to authenticated;
grant execute on function public.pc_is_admin(),public.pc_access_status(),public.pc_admin_search(text,integer),public.pc_admin_access(uuid,text,text,uuid),public.pc_admin_history(uuid) to authenticated;
commit;
