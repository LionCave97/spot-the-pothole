-- Photo moderation: quarantine path on report until server publishes to spot-photos.

create type public.photo_moderation_status as enum ('pending', 'published', 'rejected');

alter table public.reports
  add column if not exists photo_moderation_status public.photo_moderation_status not null default 'pending',
  add column if not exists published_photo_path text;

comment on column public.reports.photo_path is
  'Storage path (within spot-photos-quarantine) until moderation publishes to spot-photos.';

comment on column public.reports.published_photo_path is
  'Path in public spot-photos bucket after server blur/moderation approval.';
