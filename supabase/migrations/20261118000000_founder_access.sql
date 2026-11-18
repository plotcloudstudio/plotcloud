-- Founder access (2026-11-18): an administrator (a row in private.pc_admins, the founder) has every study on every project,
-- as permanent access. Decided on the server, like every membership: the browser only reads pc_access_status. Everyone else is
-- unchanged (their membership row, or no access).
create or replace function private.pc_access_status() returns jsonb language sql stable security definer set search_path='' as $$
 select case when private.pc_is_admin()
  then jsonb_build_object('active',true,'startsAt',null,'expiresAt',null,'accessType','permanent','serverNow',now(),'source','account','founder',true)
  else (select jsonb_build_object('active',coalesce(m.user_id is not null and m.revoked_at is null and m.starts_at<=now() and (m.access_type='permanent' or m.expires_at>now()),false),'startsAt',m.starts_at,'expiresAt',m.expires_at,'accessType',m.access_type,'serverNow',now(),'source','account')
   from (select 1) x left join private.pc_memberships m on m.user_id=auth.uid()) end;
$$;
revoke all on function private.pc_access_status() from public,anon,authenticated;
grant execute on function private.pc_access_status() to authenticated;
