-- The resource library (2026-11-17): library items of the Resources page (a category, file types, compatibility, free or for
-- members); members' files in a private bucket read only by founders and people with active access. Safe to run again.
begin;
create or replace function private.pc_validate_site_content(k text,c jsonb,publishing boolean) returns void
language plpgsql set search_path='' as $$
declare member jsonb; image text; link text; n integer;
begin
 if c is null or jsonb_typeof(c)<>'object' or octet_length(c::text)>1000000 then raise exception 'Content must be an object under 1 MB';end if;
 if k='blog' then
  if length(coalesce(c->>'title',''))>180 or length(coalesce(c->>'summary',''))>600 or length(coalesce(c->>'body',''))>50000 then raise exception 'Post text exceeds its limit';end if;
  if coalesce(c->>'category','studio') not in ('research','event','campus','release','studio') then raise exception 'Unknown blog category';end if;
  if publishing and c->>'category'='event' and (length(trim(coalesce(c->>'location','')))=0 or coalesce(c->>'eventDate','') !~ '^\d{4}-\d{2}-\d{2}$') then raise exception 'Events require a date and a place';end if;
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
  if coalesce(c->>'type','paper') not in ('paper','tutorial','news','library') then raise exception 'Unknown resource type';end if;
  if length(coalesce(c->>'title',''))>180 or length(coalesce(c->>'summary',''))>600 or length(coalesce(c->>'body',''))>50000 or length(coalesce(c->>'authors',''))>300 then raise exception 'Resource text exceeds its limit';end if;
  if coalesce(c->>'date','')<>'' and c->>'date' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'The date must be YYYY-MM-DD';end if;
  link:=coalesce(c->>'link','');
  if link<>'' and link !~ '^https://' then raise exception 'The link must be https';end if;
  link:=coalesce(c->>'file','');
  if link<>'' and link !~ '^https://' and not (c->>'type'='library' and coalesce(c->>'access','free')='members' and link ~ '^library-files/[A-Za-z0-9][A-Za-z0-9/_.-]{0,250}$') then raise exception 'The file must be an https address (upload it, or paste a link)';end if;
  link:=coalesce(c->>'video','');
  if link<>'' and link !~ '^https://(www\.)?(youtube\.com/|youtu\.be/|youtube-nocookie\.com/|bilibili\.com/|player\.bilibili\.com/|vimeo\.com/|player\.vimeo\.com/)' then raise exception 'Videos are linked from YouTube, Bilibili or Vimeo';end if;
  if publishing and (length(trim(coalesce(c->>'title','')))=0 or length(trim(coalesce(c->>'summary','')))=0) then raise exception 'A title and summary are required before publishing';end if;
  if publishing and c->>'type'='tutorial' and coalesce(c->>'video','')='' and coalesce(c->>'file','')='' and length(trim(coalesce(c->>'body','')))=0 then raise exception 'A tutorial needs a video, a file or a text';end if;
  if publishing and c->>'type'='paper' and coalesce(c->>'file','')='' and coalesce(c->>'link','')='' then raise exception 'A paper needs its PDF or a link to it';end if;
  -- library files (2026-11-17): a category of the resource library, free or for members; a members' file lives in the private bucket
  if c->>'type'='library' then
   if coalesce(c->>'category','') not in ('portfolio','cad','rhino','revit','gh','models','diagrams','site','pres') then raise exception 'Choose a library category';end if;
   if coalesce(c->>'access','free') not in ('free','members') then raise exception 'Access is free or members only';end if;
   if length(coalesce(c->>'formats',''))>120 or length(coalesce(c->>'compatibility',''))>160 or length(coalesce(c->>'size',''))>20 or length(coalesce(c->>'license',''))>300 then raise exception 'Library details exceed their limit';end if;
   if coalesce(c->>'access','free')='members' and coalesce(c->>'file','')<>'' and c->>'file' !~ '^library-files/' then raise exception 'A members-only file must be uploaded to the private library';end if;
   if coalesce(c->>'access','free')='free' and coalesce(c->>'file','') ~ '^library-files/' then raise exception 'A free file must be public: upload it as a free file, or set the item to members only';end if;
   if publishing and coalesce(c->>'file','')='' then raise exception 'A library item needs its file before publishing';end if;
  end if;
 else raise exception 'Unknown content type';end if;
 image:=coalesce(c->>'image','');
 if image<>'' and image !~ '^(https://|img/|/img/)' then raise exception 'Use an HTTPS image URL or a site image';end if;
end $$;
revoke all on function private.pc_validate_site_content(text,jsonb,boolean) from public,anon,authenticated;
-- the private library bucket: founders upload; founders and people with active access read (a short-lived signed link)
create or replace function public.pc_can_read_library() returns boolean
language sql stable security definer set search_path='' as $$
 select private.pc_can_edit_site() or coalesce((private.pc_access_status()->>'active')::boolean,false);
$$;
revoke all on function public.pc_can_read_library() from public,anon;
grant execute on function public.pc_can_read_library() to authenticated;
do $$ begin
 if exists (select 1 from pg_namespace where nspname='storage') then
  -- free library files are public: the site-files bucket takes any file type up to 50 MB (only founders write it)
  update storage.buckets set file_size_limit=52428800,allowed_mime_types=null where id='site-files';
  insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('library-files','library-files',false,52428800,null)
   on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=null;
  execute 'drop policy if exists "library-files read" on storage.objects';
  execute 'create policy "library-files read" on storage.objects for select to authenticated using (bucket_id=''library-files'' and public.pc_can_read_library())';
  execute 'drop policy if exists "library-files founder insert" on storage.objects';
  execute 'create policy "library-files founder insert" on storage.objects for insert to authenticated with check (bucket_id=''library-files'' and public.pc_can_upload_site_files())';
  execute 'drop policy if exists "library-files founder update" on storage.objects';
  execute 'create policy "library-files founder update" on storage.objects for update to authenticated using (bucket_id=''library-files'' and public.pc_can_upload_site_files())';
  execute 'drop policy if exists "library-files founder delete" on storage.objects';
  execute 'create policy "library-files founder delete" on storage.objects for delete to authenticated using (bucket_id=''library-files'' and public.pc_can_upload_site_files())';
 end if;
end $$;
commit;
