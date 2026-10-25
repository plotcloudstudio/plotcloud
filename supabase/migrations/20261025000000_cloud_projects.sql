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
