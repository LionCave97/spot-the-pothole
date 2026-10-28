-- DEV-202: spot photo storage bucket with user-scoped write paths.

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

create policy "Authenticated users upload own spot photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'spot-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users update own spot photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'spot-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'spot-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Spot photos are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'spot-photos');
