-- DEV-212: Moderator photo queue, audit log, mask quarantine paths from public views.

alter table public.profiles
  add column if not exists is_moderator boolean not null default false;

comment on column public.profiles.is_moderator is
  'Human moderators only; set via service role / SQL — never self-granted.';

alter table public.reports
  add column if not exists rejection_reason text;

create type public.photo_moderation_decision as enum ('approved', 'rejected');

create table public.photo_moderation_audit_log (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  moderator_id uuid not null references public.profiles (id) on delete restrict,
  decision public.photo_moderation_decision not null,
  rejection_reason text,
  extra_blur_regions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index photo_moderation_audit_log_report_id_idx
  on public.photo_moderation_audit_log (report_id, created_at desc);

alter table public.photo_moderation_audit_log enable row level security;

-- Moderators may read audit history; writes are service-role only (server routes).
create policy "Moderators read photo moderation audit"
  on public.photo_moderation_audit_log for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_moderator
    )
  );

revoke insert, update, delete on public.photo_moderation_audit_log from anon, authenticated;

create or replace function public.is_moderator(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.is_moderator
      from public.profiles p
      where p.id = p_user_id
    ),
    false
  );
$$;

revoke all on function public.is_moderator(uuid) from public;
grant execute on function public.is_moderator(uuid) to authenticated, service_role;

-- Prevent users from granting themselves moderator via profile update.
drop policy if exists "Users update own profile safe fields" on public.profiles;

create policy "Users update own profile safe fields"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and points = (
      select p.points from public.profiles p where p.id = auth.uid()
    )
    and is_moderator = (
      select p.is_moderator from public.profiles p where p.id = auth.uid()
    )
  );

-- Hide quarantine storage paths from public report reads; expose published path only when live.
drop view if exists public.reports_public;

create view public.reports_public
with (security_invoker = false)
as
select
  r.id,
  r.pothole_id,
  case
    when r.photo_moderation_status = 'published'::public.photo_moderation_status
      then r.published_photo_path
    else null::text
  end as photo_path,
  r.photo_moderation_status,
  st_y(r.location::geometry) as lat,
  st_x(r.location::geometry) as lng
from public.reports r;

grant select on public.reports_public to anon, authenticated;
