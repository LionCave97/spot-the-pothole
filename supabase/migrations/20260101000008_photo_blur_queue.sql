-- Server-side photo blur queue (Vercel WASM route). Secrets stay in Vault / env — never in repo.

alter table public.reports
  add column if not exists photo_blur_attempt_count integer not null default 0,
  add column if not exists photo_blur_processing_at timestamptz,
  add column if not exists photo_blur_last_error text;

comment on column public.reports.photo_blur_attempt_count is
  'Blur worker attempts; after max, report stays pending for DEV-212 moderation.';
comment on column public.reports.photo_blur_processing_at is
  'Processing lock timestamp; stale locks can be reclaimed.';

create or replace function public.claim_photo_blur_report(
  p_report_id uuid,
  p_lock_interval interval default interval '10 minutes',
  p_max_attempts integer default 5
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reports;
begin
  update public.reports
  set
    photo_blur_processing_at = now(),
    photo_blur_attempt_count = photo_blur_attempt_count + 1
  where id = p_report_id
    and photo_moderation_status = 'pending'
    and published_photo_path is null
    and photo_blur_attempt_count < p_max_attempts
    and (
      photo_blur_processing_at is null
      or photo_blur_processing_at < now() - p_lock_interval
    )
  returning * into r;

  return r;
end;
$$;

revoke all on function public.claim_photo_blur_report(uuid, interval, integer) from public;
grant execute on function public.claim_photo_blur_report(uuid, interval, integer) to service_role;

-- Optional pg_net hook (disabled until URL + secret are set in Supabase Vault / DB settings).
-- Prefer Dashboard → Database Webhooks on storage.objects INSERT for bucket spot-photos-quarantine,
-- and a second webhook on public.reports INSERT when photo_path is set.
--
-- create extension if not exists pg_net with schema extensions;
-- alter database postgres set app.settings.blur_webhook_url = 'https://YOUR_DEPLOYMENT/api/internal/blur';
-- Vault secret blur_webhook_secret → read in trigger via supabase vault extension when enabled.
