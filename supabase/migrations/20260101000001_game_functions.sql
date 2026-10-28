-- Game logic: ward lookup, duplicate merge, points after 2 confirmations

create or replace function public.lookup_ward_and_authority(p_lat double precision, p_lng double precision)
returns table (
  ward_id uuid,
  ward_name text,
  authority text
)
language sql
stable
as $$
  select
    w.id,
    w.name,
    case
      when w.mdb_code like 'JHB%' then 'City of Johannesburg Roads'
      when w.mdb_code like 'CPT%' then 'City of Cape Town Transport'
      when w.mdb_code like 'EKU%' then 'Ekurhuleni Metropolitan Municipality'
      else 'Provincial / municipal roads (stub lookup)'
    end as authority
  from public.wards w
  where st_covers(
    w.boundary,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  )
  order by st_area(w.boundary::geometry) asc
  limit 1;
$$;

create or replace function public.find_nearby_pothole(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision default 15
)
returns uuid
language sql
stable
as $$
  select p.id
  from public.potholes p
  where st_dwithin(
    p.location,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    p_radius_m
  )
  and p.parent_pothole_id is null
  order by st_distance(
    p.location,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  )
  limit 1;
$$;

create or replace function public.merge_report_into_pothole(
  p_report_id uuid,
  p_radius_m double precision default 15
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports%rowtype;
  v_existing uuid;
  v_target uuid;
  v_lat double precision;
  v_lng double precision;
begin
  select * into v_report from public.reports where id = p_report_id;
  if not found then
    raise exception 'report not found';
  end if;

  v_lat := st_y(v_report.location::geometry);
  v_lng := st_x(v_report.location::geometry);

  v_existing := public.find_nearby_pothole(v_lat, v_lng, p_radius_m);

  if v_existing is not null and v_existing <> v_report.pothole_id then
    update public.reports set pothole_id = v_existing where id = p_report_id;
    update public.potholes
      set parent_pothole_id = v_existing,
          updated_at = now()
      where id = v_report.pothole_id;

    insert into public.timeline_events (pothole_id, event_type, payload, actor_id)
    values (
      v_existing,
      'merged_duplicate',
      jsonb_build_object('merged_pothole_id', v_report.pothole_id, 'report_id', p_report_id),
      v_report.reporter_id
    );

    v_target := v_existing;
  else
    v_target := v_report.pothole_id;
  end if;

  return v_target;
end;
$$;

-- Award reporter points only once pothole reaches 2 confirmations (excludes self-confirm).
create or replace function public.maybe_award_spot_points(p_pothole_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_reporter uuid;
  v_awarded integer := 0;
begin
  select confirmation_count into v_count from public.potholes where id = p_pothole_id;
  if v_count < 2 then
    return 0;
  end if;

  select reporter_id into v_reporter
  from public.reports
  where pothole_id = p_pothole_id
  order by created_at asc
  limit 1;

  if v_reporter is null then
    return 0;
  end if;

  if exists (
    select 1 from public.timeline_events
    where pothole_id = p_pothole_id
      and event_type = 'points_awarded_spot'
  ) then
    return 0;
  end if;

  update public.profiles
    set points = points + 10,
        updated_at = now()
  where id = v_reporter;

  insert into public.timeline_events (pothole_id, event_type, payload, actor_id)
  values (
    p_pothole_id,
    'points_awarded_spot',
    jsonb_build_object('points', 10, 'reporter_id', v_reporter),
    v_reporter
  );

  v_awarded := 10;
  return v_awarded;
end;
$$;

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
set search_path = public
as $$
declare
  v_conf_id uuid;
  v_count integer;
  v_points integer;
begin
  if not st_dwithin(
    (select location from public.potholes where id = p_pothole_id),
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    15
  ) then
    raise exception 'confirmer must be within 15m of pothole';
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
