-- Hardening (2026-11-17), from the Supabase security advisor: cloud_touch runs with a fixed, empty search path, so a table or
-- function of the same name in another schema can never be picked up instead of pg_catalog's now(). Safe to run again.
alter function public.cloud_touch() set search_path = '';
