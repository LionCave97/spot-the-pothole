-- DEV-202: quarantine + public spot photo buckets (server publishes via service role).

-- Private quarantine: client uploads on-device-blurred JPEGs; no public reads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'spot-photos-quarantine',
  'spot-photos-quarantine',
  false,
  1572864,
  array['image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public bucket: only service role writes after moderation/server blur pipeline.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'spot-photos',
  'spot-photos',
  true,
  1572864,
  array['image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users upload own spot photos" on storage.objects;
drop policy if exists "Users update own spot photos" on storage.objects;
drop policy if exists "Spot photos are publicly readable" on storage.objects;

create policy "Users upload own quarantine spot photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'spot-photos-quarantine'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users read own quarantine spot photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'spot-photos-quarantine'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Published spot photos are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'spot-photos');

-- No authenticated insert/update/select on spot-photos — server uses service role (see DEV-209 hardening).
