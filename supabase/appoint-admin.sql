-- Run in your own Supabase Dashboard > SQL Editor, as the database owner.
-- First connect the site, register plotcloud@gmail.com and confirm its email.
-- This is a deliberate owner operation, never an endpoint exposed to visitors.
begin;
do $$
declare owner_id uuid; matches integer;
begin
 select count(*) into matches from auth.users
 where lower(email)='plotcloud@gmail.com' and email_confirmed_at is not null;
 if matches<>1 then
  raise exception 'Register plotcloud@gmail.com through the connected website and confirm its email first. Expected exactly one confirmed account; found %.',matches;
 end if;
 select id into owner_id from auth.users
 where lower(email)='plotcloud@gmail.com' and email_confirmed_at is not null;
 insert into private.pc_admins(user_id) values(owner_id) on conflict do nothing;
end $$;
select u.email, u.email_confirmed_at, 'Administrator assigned' as status
from private.pc_admins a join auth.users u on u.id=a.user_id
where lower(u.email)='plotcloud@gmail.com';
commit;
