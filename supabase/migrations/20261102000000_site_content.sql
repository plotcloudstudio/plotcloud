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
