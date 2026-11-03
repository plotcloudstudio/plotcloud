-- PlotCloud complete database setup: projects, accounts and month/year/permanent access.
-- Run as project owner in Supabase SQL Editor. No administrator is assigned automatically.
-- After confirming plotcloud@gmail.com, separately run appoint-admin.sql.

-- PlotCloud cloud accounts and projects (2026-10-25)
-- Run once in your Supabase project: Dashboard › SQL Editor › New query › paste this file › Run.
-- The website stays local-first: every project lives in the browser as before; when someone signs in, their projects, versions,
-- results and Account settings are copied here and kept in step across their devices. Each row belongs to one user, and Row Level
-- Security lets a signed-in user read and write only their own rows. The public (anon) key cannot read anything.

-- ---- one row per project: everything except the versions' models (those are below, written once)
create table if not exists public.cloud_projects (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,                                   -- the project's id in the browser
  name text not null default '',
  data jsonb not null,                                -- the project: draft model, runs (figures, pictures, fields), site, settings
  client_updated timestamptz,                         -- project.updated as the browser last saw it
  server_updated timestamptz not null default now(),  -- set by the database on every write (how devices notice a change)
  bytes integer generated always as (octet_length(data::text)) stored,
  primary key (owner, id),
  constraint cloud_projects_size check (octet_length(data::text) <= 25000000),
  constraint cloud_projects_id check (char_length(id) between 1 and 80)
);

-- ---- saved versions are snapshots: written once, never changed
create table if not exists public.cloud_versions (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id text not null,
  id text not null,
  n integer not null,
  note text not null default '',
  created timestamptz,
  model jsonb not null,
  primary key (owner, project_id, id),
  foreign key (owner, project_id) references public.cloud_projects (owner, id) on delete cascade,
  constraint cloud_versions_size check (octet_length(model::text) <= 25000000)
);

-- ---- the Account page's site and defaults, one row per user
create table if not exists public.cloud_accounts (
  owner uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  server_updated timestamptz not null default now()
);

create or replace function public.cloud_touch() returns trigger language plpgsql as $$
begin new.server_updated := now(); return new; end $$;
drop trigger if exists cloud_projects_touch on public.cloud_projects;
create trigger cloud_projects_touch before insert or update on public.cloud_projects for each row execute function public.cloud_touch();
drop trigger if exists cloud_accounts_touch on public.cloud_accounts;
create trigger cloud_accounts_touch before insert or update on public.cloud_accounts for each row execute function public.cloud_touch();

-- ---- Row Level Security: a signed-in user sees and changes only their own rows; nobody else (not the anon key) sees any
alter table public.cloud_projects enable row level security;
alter table public.cloud_versions enable row level security;
alter table public.cloud_accounts enable row level security;

drop policy if exists "own projects" on public.cloud_projects;
create policy "own projects" on public.cloud_projects for all to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
drop policy if exists "own versions: read" on public.cloud_versions;
create policy "own versions: read" on public.cloud_versions for select to authenticated using (owner = (select auth.uid()));
drop policy if exists "own versions: add" on public.cloud_versions;
create policy "own versions: add" on public.cloud_versions for insert to authenticated with check (owner = (select auth.uid()));
drop policy if exists "own versions: remove" on public.cloud_versions;
create policy "own versions: remove" on public.cloud_versions for delete to authenticated using (owner = (select auth.uid()));
-- (no update policy on versions: a saved version is never changed)
drop policy if exists "own account" on public.cloud_accounts;
create policy "own account" on public.cloud_accounts for all to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

revoke all on public.cloud_projects, public.cloud_versions, public.cloud_accounts from anon;
grant select, insert, update, delete on public.cloud_projects, public.cloud_accounts to authenticated;
grant select, insert, delete on public.cloud_versions to authenticated;

create index if not exists cloud_versions_project on public.cloud_versions (owner, project_id);


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


-- Run as database owner after memberships.sql. Supports month, year and revocable permanent grants.
begin;
alter table private.pc_memberships add column if not exists access_type text not null default 'month';
alter table private.pc_memberships alter column expires_at drop not null;
alter table private.pc_memberships drop constraint if exists pc_memberships_check;
alter table private.pc_memberships drop constraint if exists pc_membership_duration;
alter table private.pc_memberships add constraint pc_membership_duration check (
 access_type in ('month','year','permanent') and
 ((access_type='permanent' and expires_at is null) or (access_type<>'permanent' and expires_at is not null and expires_at>starts_at))
);
alter table private.pc_access_audit add column if not exists access_type text not null default 'month';
create or replace function private.pc_access_status() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('active',coalesce(m.user_id is not null and m.revoked_at is null and m.starts_at<=now() and (m.access_type='permanent' or m.expires_at>now()),false),'startsAt',m.starts_at,'expiresAt',m.expires_at,'accessType',m.access_type,'serverNow',now(),'source','account')
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
 u.email_confirmed_at is not null as email_confirmed,m.starts_at,m.expires_at,m.revoked_at,m.access_type,
 coalesce(m.user_id is not null and m.revoked_at is null and m.starts_at<=now() and (m.access_type='permanent' or m.expires_at>now()),false) as active
 from auth.users u left join private.pc_memberships m on m.user_id=u.id
 where trim(p_query)='' or position(lower(trim(p_query)) in lower(coalesce(u.email,'')))>0 or position(lower(trim(p_query)) in lower(coalesce(u.raw_user_meta_data->>'name','')))>0
 order by u.created_at desc,u.id limit 25 offset p_offset
 )t;return result;
end $$;
create or replace function private.pc_admin_access(p_user_id uuid,p_action text,p_reference text,p_request_id uuid,p_duration text) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare m private.pc_memberships; prior private.pc_access_audit; start_time timestamptz; end_time timestamptz; duration text;
begin
 if not private.pc_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('grant','extend','revoke') or p_request_id is null or p_reference is null or length(trim(p_reference)) not between 3 and 160 then raise exception 'Action and a payment/authorization reference are required';end if;
 if p_duration is null or p_duration not in ('month','year','permanent') then raise exception 'Choose month, year or permanent';end if;
 perform 1 from auth.users where id=p_user_id for update;if not found then raise exception 'Account not found';end if;
 select * into prior from private.pc_access_audit where request_id=p_request_id;
 if found then
  if prior.actor_id<>auth.uid() or prior.user_id<>p_user_id or prior.action<>p_action or prior.reference<>trim(p_reference) or (p_action<>'revoke' and prior.access_type<>p_duration) then raise exception 'Request ID already used';end if;
  return jsonb_build_object('ok',true,'startsAt',prior.starts_at,'expiresAt',prior.expires_at,'accessType',prior.access_type,'repeated',true);
 end if;
 if p_action<>'revoke' and exists(select 1 from private.pc_access_audit where action in ('grant','extend') and lower(reference)=lower(trim(p_reference))) then raise exception 'This payment reference was already used';end if;
 if p_action<>'revoke' and not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then raise exception 'The customer must confirm their registration email first';end if;
 select * into m from private.pc_memberships where user_id=p_user_id;
 if p_action='revoke' then
  if m.user_id is null then raise exception 'No access to revoke';end if;
  update private.pc_memberships set revoked_at=now() where user_id=p_user_id;start_time=m.starts_at;end_time=m.expires_at;duration=m.access_type;
 else
  if p_action='grant' and m.user_id is not null and m.revoked_at is null and (m.access_type='permanent' or m.expires_at>now()) then raise exception 'Access is already active. Use Extend access.';end if;
  if p_action='extend' and m.revoked_at is null and m.access_type='permanent' then raise exception 'Permanent access does not expire. Revoke it before assigning time-limited access.';end if;
  start_time=case when p_action='extend' and m.revoked_at is null and m.expires_at>now() then m.starts_at else now() end;
  duration=p_duration;
  end_time=case when duration='permanent' then null else (case when p_action='extend' and m.revoked_at is null and m.expires_at>now() then m.expires_at else now() end)+case when duration='year' then interval '1 year' else interval '1 month' end end;
  insert into private.pc_memberships(user_id,starts_at,expires_at,revoked_at,access_type) values(p_user_id,start_time,end_time,null,duration)
  on conflict(user_id) do update set starts_at=excluded.starts_at,expires_at=excluded.expires_at,revoked_at=null,access_type=excluded.access_type;
 end if;
 insert into private.pc_access_audit(request_id,actor_id,user_id,action,reference,starts_at,expires_at,access_type) values(p_request_id,auth.uid(),p_user_id,p_action,trim(p_reference),start_time,end_time,duration);
 return jsonb_build_object('ok',true,'startsAt',start_time,'expiresAt',end_time,'accessType',duration,'revoked',p_action='revoke');
end $$;
-- Preserve existing four-argument monthly clients without an ambiguous default overload.
create or replace function private.pc_admin_access(p_user_id uuid,p_action text,p_reference text,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.pc_admin_access(p_user_id,p_action,p_reference,p_request_id,'month')$$;
create or replace function public.pc_admin_access(p_user_id uuid,p_action text,p_reference text,p_request_id uuid,p_duration text) returns jsonb language sql security invoker set search_path='' as $$select private.pc_admin_access(p_user_id,p_action,p_reference,p_request_id,p_duration)$$;
create or replace function private.pc_admin_history(p_user_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.pc_is_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 select coalesce(jsonb_agg(t),'[]'::jsonb) into result from(select action,reference,created_at,starts_at,expires_at,access_type from private.pc_access_audit where user_id=p_user_id order by created_at desc limit 50)t;return result;
end $$;
revoke all on function private.pc_admin_access(uuid,text,text,uuid,text),public.pc_admin_access(uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function private.pc_admin_access(uuid,text,text,uuid,text),public.pc_admin_access(uuid,text,text,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;


-- Founder content management. Reuses the owner-controlled administrator list.
-- Anonymous readers receive published snapshots only; no browser role flag grants access.
begin;
create schema if not exists private;
create table if not exists private.pc_admins(user_id uuid primary key references auth.users(id) on delete cascade);
alter table private.pc_admins enable row level security;
revoke all on private.pc_admins from public,anon,authenticated;

create table if not exists private.pc_site_content(
 id text primary key check(id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
 kind text not null check(kind in ('about','blog')),
 draft jsonb not null check(jsonb_typeof(draft)='object'), published jsonb,
 revision integer not null default 1 check(revision>0), published_revision integer,
 updated_at timestamptz not null default now(), published_at timestamptz,
 updated_by uuid references auth.users(id),
 check((kind='about' and id='about') or kind='blog')
);
create table if not exists private.pc_site_content_history(
 id bigint generated always as identity primary key,
 content_id text not null references private.pc_site_content(id),
 revision integer not null, action text not null, snapshot jsonb not null,
 actor uuid references auth.users(id), created_at timestamptz not null default now(),
 unique(content_id,revision)
);
alter table private.pc_site_content enable row level security;
alter table private.pc_site_content_history enable row level security;
revoke all on private.pc_site_content,private.pc_site_content_history from public,anon,authenticated;

create or replace function private.pc_can_edit_site() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.pc_admins a join auth.users u on u.id=a.user_id
 where a.user_id=auth.uid() and u.email_confirmed_at is not null);
$$;
revoke all on function private.pc_can_edit_site() from public,anon,authenticated;

create or replace function private.pc_validate_site_content(k text,c jsonb,publishing boolean) returns void
language plpgsql set search_path='' as $$
declare member jsonb; image text;
begin
 if c is null or jsonb_typeof(c)<>'object' or octet_length(c::text)>1000000 then raise exception 'Content must be an object under 1 MB';end if;
 if k='blog' then
  if length(coalesce(c->>'title',''))>180 or length(coalesce(c->>'summary',''))>600 or length(coalesce(c->>'body',''))>50000 then raise exception 'Post text exceeds its limit';end if;
  if coalesce(c->>'category','studio') not in ('campus','release','studio') then raise exception 'Unknown blog category';end if;
  if publishing and (length(trim(coalesce(c->>'title','')))=0 or length(trim(coalesce(c->>'body','')))=0) then raise exception 'A title and body are required before publishing';end if;
  if publishing and c->>'category'='campus' and (length(trim(coalesce(c->>'university','')))=0 or coalesce(c->>'eventDate','') !~ '^\d{4}-\d{2}-\d{2}$') then raise exception 'Campus visits require a university and visit date';end if;
  if publishing and c->>'category'='release' and length(trim(coalesce(c->>'version','')))=0 then raise exception 'Product updates require a version label';end if;
 elsif k='about' then
  if length(coalesce(c->>'headline',''))>250 or length(coalesce(c->>'intro',''))>3000 or length(coalesce(c->>'story',''))>20000 then raise exception 'About text exceeds its limit';end if;
  if publishing and (length(trim(coalesce(c->>'headline','')))=0 or length(trim(coalesce(c->>'intro','')))=0) then raise exception 'A headline and introduction are required';end if;
  if jsonb_typeof(coalesce(c->'team','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(c->'team','[]'::jsonb))>30 then raise exception 'Team must be a list of at most 30 people';end if;
  for member in select value from jsonb_array_elements(coalesce(c->'team','[]'::jsonb)) loop
   if jsonb_typeof(member)<>'object' or length(coalesce(member->>'bio',''))>4000 then raise exception 'Invalid team member';end if;
   if publishing and length(trim(coalesce(member->>'name','')))=0 then raise exception 'Each published team member needs a name';end if;
   image:=coalesce(member->>'photo','');
   if image<>'' and image !~ '^(https://|img/|/img/)' then raise exception 'Use an HTTPS photo URL or a site image';end if;
  end loop;
 else raise exception 'Unknown content type';end if;
 image:=coalesce(c->>'image','');
 if image<>'' and image !~ '^(https://|img/|/img/)' then raise exception 'Use an HTTPS image URL or a site image';end if;
end $$;
revoke all on function private.pc_validate_site_content(text,jsonb,boolean) from public,anon,authenticated;

create or replace function public.pc_public_site_content() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'content',published,'publishedAt',published_at)
 order by published_at desc nulls last,id),'[]'::jsonb)
 from private.pc_site_content where published is not null;
$$;
revoke all on function public.pc_public_site_content() from public;
grant execute on function public.pc_public_site_content() to anon,authenticated;

create or replace function public.pc_site_edit(p_action text,p_id text default null,p_kind text default null,p_payload jsonb default null,p_expected integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row private.pc_site_content; result jsonb;
begin
 if not private.pc_can_edit_site() then raise exception 'Founder access required' using errcode='42501';end if;
 if p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(c) order by updated_at desc),'[]'::jsonb) into result from private.pc_site_content c;
  return result;
 end if;
 if p_id is null or p_id !~ '^[a-z0-9][a-z0-9-]{0,79}$' then raise exception 'Invalid content ID';end if;
 if p_action='history' then
  select coalesce(jsonb_agg(to_jsonb(h)),'[]'::jsonb) into result from
   (select revision,action,snapshot,created_at from private.pc_site_content_history where content_id=p_id order by revision desc limit 20) h;
  return result;
 end if;
 if p_action not in ('save','publish','unpublish') then raise exception 'Unknown content operation';end if;
 perform pg_advisory_xact_lock(hashtext('pc-site:'||p_id));
 select * into row from private.pc_site_content where id=p_id for update;
 if row.id is null then
  if p_action<>'save' or p_expected is distinct from 0 then raise exception 'Content not found or changed. Reload before saving.';end if;
  if p_kind not in ('about','blog') then raise exception 'Unknown content type';end if;
  perform private.pc_validate_site_content(p_kind,p_payload,false);
  insert into private.pc_site_content(id,kind,draft,updated_by) values(p_id,p_kind,p_payload,auth.uid()) returning * into row;
 else
  if p_expected is distinct from row.revision then raise exception 'This content changed in another session. Reload before saving.' using errcode='40001';end if;
  if p_action='save' then
   if p_kind is distinct from row.kind then raise exception 'Content type cannot change';end if;
   perform private.pc_validate_site_content(row.kind,p_payload,false);
   update private.pc_site_content set draft=p_payload,revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=p_id returning * into row;
  elsif p_action='publish' then
   perform private.pc_validate_site_content(row.kind,row.draft,true);
   update private.pc_site_content set published=draft,revision=revision+1,published_revision=revision+1,published_at=now(),updated_at=now(),updated_by=auth.uid() where id=p_id returning * into row;
  else
   if row.kind='about' then raise exception 'Publish an updated About page instead of unpublishing it';end if;
   update private.pc_site_content set published=null,published_revision=null,published_at=null,revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=p_id returning * into row;
  end if;
 end if;
 insert into private.pc_site_content_history(content_id,revision,action,snapshot,actor) values(row.id,row.revision,p_action,to_jsonb(row),auth.uid());
 return to_jsonb(row);
end $$;
revoke all on function public.pc_site_edit(text,text,text,jsonb,integer) from public,anon;
grant execute on function public.pc_site_edit(text,text,text,jsonb,integer) to authenticated;

-- Preserve the existing public About copy and two published studio notes.
insert into private.pc_site_content(id,kind,draft,published,published_revision) values('about','about',$pcseed${"headline":"Understand the building.\nImprove the next decision.","intro":"PlotCloud is a browser workspace for architects and architecture students exploring building performance in early design.","storyTitle":"Keep your existing workflow","story":"Use supported imports and exports alongside your CAD and modelling tools. PlotCloud supports design exploration; study methods and limitations remain part of the result.","teamIntro":"","team":[]}$pcseed$::jsonb,$pcseed${"headline":"Understand the building.\nImprove the next decision.","intro":"PlotCloud is a browser workspace for architects and architecture students exploring building performance in early design.","storyTitle":"Keep your existing workflow","story":"Use supported imports and exports alongside your CAD and modelling tools. PlotCloud supports design exploration; study methods and limitations remain part of the result.","teamIntro":"","team":[]}$pcseed$::jsonb,1) on conflict(id) do nothing;
insert into private.pc_site_content(id,kind,draft,published,published_revision) values('compare','blog',$pcseed${"title":"Compare a change against the same baseline","category":"studio","summary":"Keep the model version, site and study settings together when you compare design decisions.","body":"A useful comparison starts with one question: what did this design change do? Save the baseline, change one design variable and keep the site, orientation and study period consistent.\n\nIn PlotCloud, review the model version and study settings with each result. A change in weather, date or calculation settings can change the outcome too; record those differences before drawing a design conclusion.","image":"img/home/sunhours.webp","imageAlt":"Illustrative solar exposure study"}$pcseed$::jsonb,$pcseed${"title":"Compare a change against the same baseline","category":"studio","summary":"Keep the model version, site and study settings together when you compare design decisions.","body":"A useful comparison starts with one question: what did this design change do? Save the baseline, change one design variable and keep the site, orientation and study period consistent.\n\nIn PlotCloud, review the model version and study settings with each result. A change in weather, date or calculation settings can change the outcome too; record those differences before drawing a design conclusion.","image":"img/home/sunhours.webp","imageAlt":"Illustrative solar exposure study"}$pcseed$::jsonb,1) on conflict(id) do nothing;
insert into private.pc_site_content(id,kind,draft,published,published_revision) values('illustration','blog',$pcseed${"title":"Make an interior legible with one ink","category":"studio","summary":"Use a cutaway axonometric to explain rooms, openings and furniture.","body":"A cutaway axonometric can explain rooms, openings and furniture in one view. Strong cut edges establish the plan; fine lines describe the objects inside it.\n\nOpen Workspace in Perspective, choose Illustration in Display mode and select an ink colour. Frame the model and use Export model to save the Perspective view as a PNG. The drawing communicates spatial organisation; analysis overlays provide separate performance evidence.","image":"img/home/illustration-interior.webp","imageAlt":"Blue line interior cutaway illustration"}$pcseed$::jsonb,$pcseed${"title":"Make an interior legible with one ink","category":"studio","summary":"Use a cutaway axonometric to explain rooms, openings and furniture.","body":"A cutaway axonometric can explain rooms, openings and furniture in one view. Strong cut edges establish the plan; fine lines describe the objects inside it.\n\nOpen Workspace in Perspective, choose Illustration in Display mode and select an ink colour. Frame the model and use Export model to save the Perspective view as a PNG. The drawing communicates spatial organisation; analysis overlays provide separate performance evidence.","image":"img/home/illustration-interior.webp","imageAlt":"Blue line interior cutaway illustration"}$pcseed$::jsonb,1) on conflict(id) do nothing;
commit;
