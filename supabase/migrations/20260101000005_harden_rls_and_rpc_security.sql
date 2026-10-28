-- DEV-209: Harden RLS, RPC execute privileges, and public read masking.
-- Storage buckets (spot-photos / quarantine) are in PR #2 migrations 000003–000004.

-- ---------------------------------------------------------------------------
-- Signup: non-PII default username
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_username text;
begin
  v_username := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  if v_username is null then
    v_username := 'user_' || substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 12);
  end if;

  insert into public.profiles (id, username, is_anonymous)
  values (
    new.id,
    v_username,
    coalesce((new.raw_user_meta_data ->> 'is_anonymous')::boolean, false)
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Game RPC: block self-confirmation; keep proximity check
-- ---------------------------------------------------------------------------

create or replace function public.record_confirmation(
  p_pothole_id uuid,
  p_confirmer_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns table (
  confirmation_id uuid,
  confirmation_count integer,
  points_awarded integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_conf_id uuid;
  v_count integer;
  v_points integer;
  v_pothole_location geography;
begin
  select location into v_pothole_location
  from public.potholes
  where id = p_pothole_id;

  if v_pothole_location is null then
    raise exception 'pothole not found';
  end if;

  if not st_dwithin(
    v_pothole_location,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    15
  ) then
    raise exception 'confirmer must be within 15m of pothole';
  end if;

  if exists (
    select 1
    from public.reports r
    where r.pothole_id = p_pothole_id
      and r.reporter_id = p_confirmer_id
  ) then
    raise exception 'cannot confirm your own report';
  end if;

  insert into public.confirmations (pothole_id, confirmer_id, location)
  values (
    p_pothole_id,
    p_confirmer_id,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  )
  returning id into v_conf_id;

  update public.potholes
    set confirmation_count = confirmation_count + 1,
        updated_at = now()
  where id = p_pothole_id
  returning public.potholes.confirmation_count into v_count;

  insert into public.timeline_events (pothole_id, event_type, payload, actor_id)
  values (
    p_pothole_id,
    'confirmation',
    jsonb_build_object('confirmation_id', v_conf_id),
    p_confirmer_id
  );

  v_points := public.maybe_award_spot_points(p_pothole_id);

  confirmation_id := v_conf_id;
  confirmation_count := v_count;
  points_awarded := v_points;
  return next;
end;
$$;

-- Ensure fixed search_path on existing definer helpers
alter function public.merge_report_into_pothole(uuid, double precision)
  set search_path = public, extensions;

alter function public.maybe_award_spot_points(uuid)
  set search_path = public, extensions;

alter function public.lookup_ward_and_authority(double precision, double precision)
  set search_path = public, extensions;

alter function public.find_nearby_pothole(double precision, double precision, double precision)
  set search_path = public, extensions;

-- Server-only SECURITY DEFINER RPCs
revoke all on function public.record_confirmation(uuid, uuid, double precision, double precision)
  from public, anon, authenticated;

revoke all on function public.merge_report_into_pothole(uuid, double precision)
  from public, anon, authenticated;

revoke all on function public.maybe_award_spot_points(uuid)
  from public, anon, authenticated;

grant execute on function public.record_confirmation(uuid, uuid, double precision, double precision)
  to service_role;

grant execute on function public.merge_report_into_pothole(uuid, double precision)
  to service_role;

grant execute on function public.maybe_award_spot_points(uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Drop unsafe RLS policies
-- ---------------------------------------------------------------------------

drop policy if exists "Profiles readable by everyone" on public.profiles;
drop policy if exists "Reports are readable by everyone" on public.reports;
drop policy if exists "Confirmations are readable by everyone" on public.confirmations;
drop policy if exists "Timeline readable by everyone" on public.timeline_events;
drop policy if exists "User badges readable by everyone" on public.user_badges;
drop policy if exists "Comments readable by everyone" on public.comments;
drop policy if exists "Likes readable by everyone" on public.likes;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Authenticated users insert potholes" on public.potholes;
drop policy if exists "Authenticated users update potholes" on public.potholes;
drop policy if exists "Authenticated users insert confirmations" on public.confirmations;
drop policy if exists "Authenticated users insert reports" on public.reports;

-- ---------------------------------------------------------------------------
-- Tightened RLS
-- ---------------------------------------------------------------------------

create policy "Users read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users update own profile safe fields"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and points = (
      select p.points from public.profiles p where p.id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Public views: exact pothole/spot geometry; mask people (no route history).
-- Pothole/report/confirmation coordinates stay exact for map + 15 m merge.
-- Spot/confirmation views omit user keys and timestamps (no per-user timelines).
-- ---------------------------------------------------------------------------

create or replace view public.profiles_public
with (security_invoker = false)
as
select
  case when p.is_anonymous then null::uuid else p.id end as id,
  case when p.is_anonymous then 'Anonymous'::text else p.username end as username,
  p.is_anonymous,
  p.points
from public.profiles p;

create or replace view public.reports_public
with (security_invoker = false)
as
select
  r.id,
  r.pothole_id,
  r.photo_path,
  st_y(r.location::geometry) as lat,
  st_x(r.location::geometry) as lng
from public.reports r;

create or replace view public.confirmations_public
with (security_invoker = false)
as
select
  c.id,
  c.pothole_id,
  st_y(c.location::geometry) as lat,
  st_x(c.location::geometry) as lng
from public.confirmations c;

create or replace view public.comments_public
with (security_invoker = false)
as
select
  c.id,
  c.pothole_id,
  case
    when pr.is_anonymous then null::uuid
    else c.author_id
  end as author_id,
  case
    when pr.is_anonymous then 'Anonymous'::text
    else pr.username
  end as author_username,
  c.body,
  c.created_at
from public.comments c
left join public.profiles pr on pr.id = c.author_id;

create or replace view public.likes_public
with (security_invoker = false)
as
select
  l.id,
  l.pothole_id,
  case when pr.is_anonymous then null::uuid else l.user_id end as user_id,
  l.created_at
from public.likes l
left join public.profiles pr on pr.id = l.user_id;

create or replace view public.timeline_events_public
with (security_invoker = false)
as
select
  t.id,
  t.pothole_id,
  t.event_type,
  case
    when pr.is_anonymous then t.payload - 'reporter_id' - 'actor_id' - 'confirmation_id'
    else t.payload - 'reporter_id'
  end as payload,
  case when pr.is_anonymous then null::uuid else t.actor_id end as actor_id,
  case when pr.is_anonymous then 'Anonymous'::text else pr.username end as actor_username,
  t.created_at
from public.timeline_events t
left join public.profiles pr on pr.id = t.actor_id;

create or replace view public.user_badges_public
with (security_invoker = false)
as
select
  case when pr.is_anonymous then null::uuid else ub.user_id end as user_id,
  case when pr.is_anonymous then 'Anonymous'::text else pr.username end as username,
  ub.badge_id
from public.user_badges ub
left join public.profiles pr on pr.id = ub.user_id;

grant select on public.profiles_public to anon, authenticated;
grant select on public.reports_public to anon, authenticated;
grant select on public.confirmations_public to anon, authenticated;
grant select on public.comments_public to anon, authenticated;
grant select on public.likes_public to anon, authenticated;
grant select on public.timeline_events_public to anon, authenticated;
grant select on public.user_badges_public to anon, authenticated;

-- Block direct SELECT on sensitive base tables; clients use *_public views.
revoke select on public.reports from anon, authenticated;
revoke select on public.confirmations from anon, authenticated;
revoke select on public.comments from anon, authenticated;
revoke select on public.likes from anon, authenticated;
revoke select on public.timeline_events from anon, authenticated;
revoke select on public.user_badges from anon, authenticated;
revoke select on public.profiles from anon, authenticated;

grant select on public.profiles to authenticated;
