-- Resources from the database and a richer About page (2026-11-17). Run after site_content.sql; safe to run again.
-- · a 'resource' content type: papers, tutorials and news published to the Resources page by a founder, with drafts, history and
--   the same founder-only editing as Blog and About (pc_site_edit); visitors read published items through pc_public_site_content
-- · About: a LinkedIn link per team member, testimonials and client logos, each list short and validated
-- · a public Storage bucket, site-files, for PDFs and images (25 MB, PDF/PNG/JPEG/WebP): anyone may read, only founders may write;
--   videos are linked from YouTube, Bilibili or Vimeo, not stored
begin;
alter table private.pc_site_content drop constraint if exists pc_site_content_kind_check;
alter table private.pc_site_content drop constraint if exists pc_site_content_check;
alter table private.pc_site_content drop constraint if exists pc_site_content_kind_ok;
alter table private.pc_site_content drop constraint if exists pc_site_content_about_id;
alter table private.pc_site_content add constraint pc_site_content_kind_ok check(kind in ('about','blog','resource'));
alter table private.pc_site_content add constraint pc_site_content_about_id check((kind='about' and id='about') or kind in ('blog','resource'));

create or replace function private.pc_validate_site_content(k text,c jsonb,publishing boolean) returns void
language plpgsql set search_path='' as $$
declare member jsonb; image text; link text; n integer;
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
   link:=coalesce(member->>'linkedin','');
   if link<>'' and link !~ '^https://([a-z0-9-]+\.)?linkedin\.com/' then raise exception 'A LinkedIn link must be an https://…linkedin.com/ address';end if;
  end loop;
  -- testimonials and client logos (2026-11-17): short lists; sample items stay tagged on the page
  if jsonb_typeof(coalesce(c->'testimonials','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(c->'testimonials','[]'::jsonb))>12 then raise exception 'Testimonials must be a list of at most 12';end if;
  for member in select value from jsonb_array_elements(coalesce(c->'testimonials','[]'::jsonb)) loop
   if jsonb_typeof(member)<>'object' or length(coalesce(member->>'quote',''))>600 or length(coalesce(member->>'name',''))>120 then raise exception 'Invalid testimonial';end if;
   if publishing and (length(trim(coalesce(member->>'quote','')))=0 or length(trim(coalesce(member->>'name','')))=0) then raise exception 'Each published testimonial needs a quote and a name';end if;
  end loop;
  if jsonb_typeof(coalesce(c->'clients','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(c->'clients','[]'::jsonb))>24 then raise exception 'Clients must be a list of at most 24';end if;
  for member in select value from jsonb_array_elements(coalesce(c->'clients','[]'::jsonb)) loop
   if jsonb_typeof(member)<>'object' or length(coalesce(member->>'name',''))>120 then raise exception 'Invalid client';end if;
   if publishing and length(trim(coalesce(member->>'name','')))=0 then raise exception 'Each published client needs a name';end if;
   image:=coalesce(member->>'logo','');
   if image<>'' and image !~ '^(https://|img/|/img/)' then raise exception 'Use an HTTPS logo URL or a site image';end if;
   link:=coalesce(member->>'url','');
   if link<>'' and link !~ '^https://' then raise exception 'A client link must be https';end if;
  end loop;
 elsif k='resource' then
  -- papers, tutorials and news for the Resources page (2026-11-17)
  if coalesce(c->>'type','paper') not in ('paper','tutorial','news') then raise exception 'Unknown resource type';end if;
  if length(coalesce(c->>'title',''))>180 or length(coalesce(c->>'summary',''))>600 or length(coalesce(c->>'body',''))>50000 or length(coalesce(c->>'authors',''))>300 then raise exception 'Resource text exceeds its limit';end if;
  if coalesce(c->>'date','')<>'' and c->>'date' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'The date must be YYYY-MM-DD';end if;
  link:=coalesce(c->>'link','');
  if link<>'' and link !~ '^https://' then raise exception 'The link must be https';end if;
  link:=coalesce(c->>'file','');
  if link<>'' and link !~ '^https://' then raise exception 'The file must be an https address (upload it, or paste a link)';end if;
  link:=coalesce(c->>'video','');
  if link<>'' and link !~ '^https://(www\.)?(youtube\.com/|youtu\.be/|youtube-nocookie\.com/|bilibili\.com/|player\.bilibili\.com/|vimeo\.com/|player\.vimeo\.com/)' then raise exception 'Videos are linked from YouTube, Bilibili or Vimeo';end if;
  if publishing and (length(trim(coalesce(c->>'title','')))=0 or length(trim(coalesce(c->>'summary','')))=0) then raise exception 'A title and summary are required before publishing';end if;
  if publishing and c->>'type'='tutorial' and coalesce(c->>'video','')='' and coalesce(c->>'file','')='' and length(trim(coalesce(c->>'body','')))=0 then raise exception 'A tutorial needs a video, a file or a text';end if;
  if publishing and c->>'type'='paper' and coalesce(c->>'file','')='' and coalesce(c->>'link','')='' then raise exception 'A paper needs its PDF or a link to it';end if;
 else raise exception 'Unknown content type';end if;
 image:=coalesce(c->>'image','');
 if image<>'' and image !~ '^(https://|img/|/img/)' then raise exception 'Use an HTTPS image URL or a site image';end if;
end $$;
revoke all on function private.pc_validate_site_content(text,jsonb,boolean) from public,anon,authenticated;

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
  if p_kind not in ('about','blog','resource') then raise exception 'Unknown content type';end if;
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

-- founders may write to the site-files bucket: a wrapper the storage policies can call (pc_can_edit_site itself is private)
create or replace function public.pc_can_upload_site_files() returns boolean
language sql stable security definer set search_path='' as $$ select private.pc_can_edit_site(); $$;
revoke all on function public.pc_can_upload_site_files() from public,anon;
grant execute on function public.pc_can_upload_site_files() to authenticated;

do $$ begin
 if exists (select 1 from pg_namespace where nspname='storage') then
  insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('site-files','site-files',true,26214400,array['application/pdf','image/png','image/jpeg','image/webp'])
   on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
  execute 'drop policy if exists "site-files public read" on storage.objects';
  execute 'create policy "site-files public read" on storage.objects for select to public using (bucket_id=''site-files'')';
  execute 'drop policy if exists "site-files founder insert" on storage.objects';
  execute 'create policy "site-files founder insert" on storage.objects for insert to authenticated with check (bucket_id=''site-files'' and public.pc_can_upload_site_files())';
  execute 'drop policy if exists "site-files founder update" on storage.objects';
  execute 'create policy "site-files founder update" on storage.objects for update to authenticated using (bucket_id=''site-files'' and public.pc_can_upload_site_files())';
  execute 'drop policy if exists "site-files founder delete" on storage.objects';
  execute 'create policy "site-files founder delete" on storage.objects for delete to authenticated using (bucket_id=''site-files'' and public.pc_can_upload_site_files())';
 end if;
end $$;
-- the Blog holds research notes only (2026-11-17): the two seeded studio notes are removed where they were never edited
delete from private.pc_site_content where id in ('compare','illustration') and kind='blog' and revision=1;
commit;
