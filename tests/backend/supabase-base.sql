-- For local tests only: the parts of a hosted Supabase database the PlotCloud migration relies on (roles, auth.users, auth.uid()).
-- On Supabase these already exist; do not run this file there.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit password 'authenticator'; end if;
end $$;
grant anon, authenticated to authenticator;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text unique not null, encrypted_password text not null, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
-- as Supabase: the user id from the request's JWT claims (PostgREST sets request.jwt.claims)
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
