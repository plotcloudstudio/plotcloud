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
