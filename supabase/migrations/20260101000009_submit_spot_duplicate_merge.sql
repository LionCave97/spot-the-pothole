-- DEV-203: Atomic submit_spot with ~15 m duplicate merge / confirmation.
-- Keep in sync with shared/constants.ts POTHOL_MERGE_RADIUS_METERS (default 15).

create or replace function public.pothole_merge_radius_meters()
returns double precision
language sql
immutable
set search_path = public
as $$
  select 15::double precision;
$$;

comment on function public.pothole_merge_radius_meters() is
  'Default duplicate-merge radius (m). Mirror shared/constants.ts POTHOL_MERGE_RADIUS_METERS.';

-- Nearest open root pothole within radius (read-only helper).
create or replace function public.find_nearby_pothole(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision default null
)
returns uuid
language sql
stable
set search_path = public, extensions
as $$
  select p.id
  from public.potholes p
  where p.status = 'open'::public.pothole_status
    and p.parent_pothole_id is null
    and st_dwithin(
      p.location,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      coalesce(p_radius_m, public.pothole_merge_radius_meters())
    )
  order by st_distance(
    p.location,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  )
  limit 1;
$$;

create or replace function public.submit_spot(
  p_reporter_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_name text,
  p_photo_path text,
  p_photo_moderation_status public.photo_moderation_status,
  p_published_photo_path text,
  p_road_ref text default null,
  p_ward_id uuid default null,
  p_authority text default null,
  p_radius_m double precision default null
)
returns table (
  pothole_id uuid,
  report_id uuid,
  merged boolean,
  confirmation_id uuid,
  confirmation_count integer,
  points_awarded integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_radius double precision;
  v_point geography;
  v_existing uuid;
  v_pothole_id uuid;
  v_report_id uuid;
  v_merged boolean := false;
  v_conf_id uuid;
  v_conf_count integer;
  v_points integer := 0;
  v_lock_key bigint;
begin
  v_radius := coalesce(p_radius_m, public.pothole_merge_radius_meters());
  v_point := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;

  v_lock_key := hashtext(st_geohash(v_point::geometry, 8));
  perform pg_advisory_xact_lock(v_lock_key);

  select p.id
  into v_existing
  from public.potholes p
  where p.status = 'open'::public.pothole_status
    and p.parent_pothole_id is null
    and st_dwithin(p.location, v_point, v_radius)
  order by st_distance(p.location, v_point)
  limit 1
  for update;

  if v_existing is not null then
    v_merged := true;
    v_pothole_id := v_existing;

    select c.id
    into v_conf_id
    from public.confirmations c
    where c.pothole_id = v_pothole_id
      and c.confirmer_id = p_reporter_id;

    if v_conf_id is not null then
      select p.confirmation_count
      into v_conf_count
      from public.potholes p
      where p.id = v_pothole_id;
    elsif exists (
      select 1
      from public.reports r
      where r.pothole_id = v_pothole_id
        and r.reporter_id = p_reporter_id
    ) then
      v_conf_id := null;
      select p.confirmation_count
      into v_conf_count
      from public.potholes p
      where p.id = v_pothole_id;
    else
      select rc.confirmation_id, rc.confirmation_count, rc.points_awarded
      into v_conf_id, v_conf_count, v_points
      from public.record_confirmation(
        v_pothole_id,
        p_reporter_id,
        p_lat,
        p_lng
      ) rc;
    end if;

    insert into public.reports (
      pothole_id,
      reporter_id,
      photo_path,
      photo_moderation_status,
      published_photo_path,
      location
    )
    values (
      v_pothole_id,
      p_reporter_id,
      p_photo_path,
      p_photo_moderation_status,
      p_published_photo_path,
      v_point
    )
    returning id into v_report_id;
  else
    insert into public.potholes (
      name,
      status,
      location,
      road_ref,
      authority,
      ward_id,
      photo_path
    )
    values (
      p_name,
      'open'::public.pothole_status,
      v_point,
      p_road_ref,
      p_authority,
      p_ward_id,
      p_published_photo_path
    )
    returning id into v_pothole_id;

    insert into public.reports (
      pothole_id,
      reporter_id,
      photo_path,
      photo_moderation_status,
      published_photo_path,
      location
    )
    values (
      v_pothole_id,
      p_reporter_id,
      p_photo_path,
      p_photo_moderation_status,
      p_published_photo_path,
      v_point
    )
    returning id into v_report_id;

    insert into public.timeline_events (pothole_id, event_type, payload, actor_id)
    values (
      v_pothole_id,
      'spot_reported',
      jsonb_build_object('report_id', v_report_id),
      p_reporter_id
    );

    v_conf_count := 0;
    v_merged := false;
  end if;

  pothole_id := v_pothole_id;
  report_id := v_report_id;
  merged := v_merged;
  confirmation_id := v_conf_id;
  confirmation_count := coalesce(v_conf_count, 0);
  points_awarded := coalesce(v_points, 0);
  return next;
end;
$$;

revoke all on function public.submit_spot(
  uuid,
  double precision,
  double precision,
  text,
  text,
  public.photo_moderation_status,
  text,
  text,
  uuid,
  text,
  double precision
) from public, anon, authenticated;

grant execute on function public.submit_spot(
  uuid,
  double precision,
  double precision,
  text,
  text,
  public.photo_moderation_status,
  text,
  text,
  uuid,
  text,
  double precision
) to service_role;
