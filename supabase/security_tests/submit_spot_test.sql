-- DEV-203: submit_spot duplicate merge / confirmation tests (fictional data only).

\set ON_ERROR_STOP on

create or replace function pg_temp.dev203_offset_m(
  p_base geography,
  p_distance_m double precision,
  p_bearing_deg double precision
)
returns geography
language sql
immutable
as $$
  select st_project(
    p_base,
    p_distance_m,
    radians(p_bearing_deg)
  );
$$;

-- ---------------------------------------------------------------------------
-- Privileges: service_role only
-- ---------------------------------------------------------------------------

do $$
begin
  if has_function_privilege(
    'authenticated',
    'public.submit_spot(uuid, double precision, double precision, text, text, public.photo_moderation_status, text, text, uuid, text, double precision)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must not EXECUTE submit_spot';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.submit_spot(uuid, double precision, double precision, text, text, public.photo_moderation_status, text, text, uuid, text, double precision)',
    'EXECUTE'
  ) then
    raise exception 'service_role must EXECUTE submit_spot';
  end if;

  if public.pothole_merge_radius_meters() <> 15 then
    raise exception 'expected default merge radius 15 m';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helpers: test users
-- ---------------------------------------------------------------------------

create or replace function pg_temp.dev203_test_user(p_id uuid, p_email text)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt('test-password', extensions.gen_salt('bf')),
    now(),
    now(),
    now()
  )
  on conflict (id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nearest open pothole within radius
-- ---------------------------------------------------------------------------

do $$
declare
  v_reporter_a uuid := '00000000-0000-4000-8000-0000000000d1';
  v_reporter_b uuid := '00000000-0000-4000-8000-0000000000d2';
  v_base geography := st_setsrid(st_makepoint(28.1000, -26.1000), 4326)::geography;
  v_near geography := pg_temp.dev203_offset_m(v_base, 12, 90);
  v_far geography := pg_temp.dev203_offset_m(v_base, 12, 0);
  v_spot geography := pg_temp.dev203_offset_m(v_base, 8, 90);
  v_near_id uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddd01';
  v_far_id uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddd02';
  v_row record;
  v_lat double precision;
  v_lng double precision;
begin
  perform pg_temp.dev203_test_user(v_reporter_a, 'dev203-a@example.invalid');
  perform pg_temp.dev203_test_user(v_reporter_b, 'dev203-b@example.invalid');

  insert into public.potholes (id, name, status, location, confirmation_count)
  values
    (v_near_id, 'DEV203 near', 'open', v_near, 0),
    (v_far_id, 'DEV203 far', 'open', v_far, 0);

  v_lat := st_y(v_spot::geometry);
  v_lng := st_x(v_spot::geometry);

  perform set_config('role', 'service_role', true);

  select *
  into v_row
  from public.submit_spot(
    v_reporter_b,
    v_lat,
    v_lng,
    'Spot near nearest',
    'demo/dev203-nearest.jpg',
    'pending'::public.photo_moderation_status,
    null
  );

  if not v_row.merged then
    raise exception 'expected merge into existing pothole';
  end if;

  if v_row.pothole_id <> v_near_id then
    raise exception 'expected nearest pothole %, got %', v_near_id, v_row.pothole_id;
  end if;

  perform set_config('role', 'postgres', true);
  delete from public.reports where pothole_id in (v_near_id, v_far_id);
  delete from public.confirmations where pothole_id in (v_near_id, v_far_id);
  delete from public.potholes where id in (v_near_id, v_far_id);
  delete from auth.users where id in (v_reporter_a, v_reporter_b);
end;
$$;

-- ---------------------------------------------------------------------------
-- Radius edge: 14 m merges, 16 m does not
-- ---------------------------------------------------------------------------

do $$
declare
  v_reporter uuid := '00000000-0000-4000-8000-0000000000d3';
  v_base geography := st_setsrid(st_makepoint(28.1100, -26.1100), 4326)::geography;
  v_at_14m geography := pg_temp.dev203_offset_m(v_base, 14, 90);
  v_at_16m geography := pg_temp.dev203_offset_m(v_base, 16, 90);
  v_existing_14 uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddd14';
  v_existing_16 uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddd16';
  v_row record;
  v_lat double precision;
  v_lng double precision;
  v_count integer;
begin
  perform pg_temp.dev203_test_user(v_reporter, 'dev203-edge@example.invalid');

  insert into public.potholes (id, name, status, location, confirmation_count)
  values
    (v_existing_14, 'DEV203 at 14m', 'open', v_at_14m, 0);

  v_lat := st_y(v_base::geometry);
  v_lng := st_x(v_base::geometry);

  perform set_config('role', 'service_role', true);

  select *
  into v_row
  from public.submit_spot(
    v_reporter,
    v_lat,
    v_lng,
    '14m edge spot',
    'demo/dev203-14m.jpg',
    'pending'::public.photo_moderation_status,
    null
  );

  if not v_row.merged or v_row.pothole_id <> v_existing_14 then
    raise exception '14 m spot should merge into existing pothole';
  end if;

  delete from public.reports where pothole_id = v_existing_14;
  delete from public.potholes where id = v_existing_14;

  insert into public.potholes (id, name, status, location, confirmation_count)
  values (v_existing_16, 'DEV203 at 16m', 'open', v_at_16m, 0);

  select *
  into v_row
  from public.submit_spot(
    v_reporter,
    v_lat,
    v_lng,
    '16m edge spot',
    'demo/dev203-16m.jpg',
    'pending'::public.photo_moderation_status,
    null
  );

  if v_row.merged then
    raise exception '16 m spot should not merge';
  end if;

  select count(*)
  into v_count
  from public.potholes p
  where st_dwithin(
    p.location,
    v_base,
    1
  )
  and p.id in (v_row.pothole_id, v_existing_16);

  if v_count <> 2 then
    raise exception 'expected new pothole plus distant existing, count=%', v_count;
  end if;

  perform set_config('role', 'postgres', true);
  delete from public.reports where pothole_id in (v_row.pothole_id, v_existing_16);
  delete from public.potholes where id in (v_row.pothole_id, v_existing_16);
  delete from auth.users where id = v_reporter;
end;
$$;

-- ---------------------------------------------------------------------------
-- Double confirm: second submit is idempotent (one confirmation row)
-- ---------------------------------------------------------------------------

do $$
declare
  v_reporter uuid := '00000000-0000-4000-8000-000000000004';
  v_confirmer uuid := '00000000-0000-4000-8000-000000000005';
  v_pothole uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
  v_base geography := st_setsrid(st_makepoint(28.1200, -26.1200), 4326)::geography;
  v_row record;
  v_lat double precision;
  v_lng double precision;
  v_conf_count integer;
begin
  perform pg_temp.dev203_test_user(v_reporter, 'dev203-reporter@example.invalid');
  perform pg_temp.dev203_test_user(v_confirmer, 'dev203-confirmer@example.invalid');

  insert into public.potholes (id, name, status, location, confirmation_count)
  values (v_pothole, 'DEV203 double confirm', 'open', v_base, 0);

  insert into public.reports (pothole_id, reporter_id, photo_path, location)
  values (
    v_pothole,
    v_reporter,
    'demo/dev203-original.jpg',
    v_base
  );

  v_lat := st_y(v_base::geometry);
  v_lng := st_x(v_base::geometry);

  perform set_config('role', 'service_role', true);

  select *
  into v_row
  from public.submit_spot(
    v_confirmer,
    v_lat,
    v_lng,
    'First confirm spot',
    'demo/dev203-confirm1.jpg',
    'pending'::public.photo_moderation_status,
    null
  );

  if not v_row.merged or v_row.confirmation_id is null then
    raise exception 'first nearby spot should create confirmation';
  end if;

  select *
  into v_row
  from public.submit_spot(
    v_confirmer,
    v_lat,
    v_lng,
    'Second confirm spot',
    'demo/dev203-confirm2.jpg',
    'pending'::public.photo_moderation_status,
    null
  );

  select count(*)
  into v_conf_count
  from public.confirmations c
  where c.pothole_id = v_pothole
    and c.confirmer_id = v_confirmer;

  if v_conf_count <> 1 then
    raise exception 'double confirm must keep a single confirmation row, got %', v_conf_count;
  end if;

  select confirmation_count
  into v_conf_count
  from public.potholes
  where id = v_pothole;

  if v_conf_count <> 1 then
    raise exception 'confirmation_count should remain 1 after double confirm, got %', v_conf_count;
  end if;

  perform set_config('role', 'postgres', true);
  delete from public.reports where pothole_id = v_pothole;
  delete from public.confirmations where pothole_id = v_pothole;
  delete from public.potholes where id = v_pothole;
  delete from auth.users where id in (v_reporter, v_confirmer);
end;
$$;

-- ---------------------------------------------------------------------------
-- Concurrent pair: two spots at the same empty coordinate → one pothole
-- ---------------------------------------------------------------------------

do $$
declare
  v_user_a uuid := '00000000-0000-4000-8000-0000000000e1';
  v_user_b uuid := '00000000-0000-4000-8000-0000000000e2';
  v_base geography := st_setsrid(st_makepoint(28.1300, -26.1300), 4326)::geography;
  v_row_a record;
  v_row_b record;
  v_lat double precision;
  v_lng double precision;
  v_pothole_count integer;
begin
  perform pg_temp.dev203_test_user(v_user_a, 'dev203-conc-a@example.invalid');
  perform pg_temp.dev203_test_user(v_user_b, 'dev203-conc-b@example.invalid');

  v_lat := st_y(v_base::geometry);
  v_lng := st_x(v_base::geometry);

  perform set_config('role', 'service_role', true);

  select *
  into v_row_a
  from public.submit_spot(
    v_user_a,
    v_lat,
    v_lng,
    'Concurrent A',
    'demo/dev203-conc-a.jpg',
    'pending'::public.photo_moderation_status,
    null
  );

  select *
  into v_row_b
  from public.submit_spot(
    v_user_b,
    v_lat,
    v_lng,
    'Concurrent B',
    'demo/dev203-conc-b.jpg',
    'pending'::public.photo_moderation_status,
    null
  );

  if v_row_a.merged then
    raise exception 'first concurrent spot should create a new pothole';
  end if;

  if not v_row_b.merged or v_row_b.pothole_id <> v_row_a.pothole_id then
    raise exception 'second concurrent spot should merge into the first pothole';
  end if;

  select count(distinct p.id)
  into v_pothole_count
  from public.potholes p
  where st_dwithin(p.location, v_base, 1);

  if v_pothole_count <> 1 then
    raise exception 'expected exactly one pothole at concurrent coordinate, got %', v_pothole_count;
  end if;

  perform set_config('role', 'postgres', true);
  delete from public.reports where pothole_id = v_row_a.pothole_id;
  delete from public.confirmations where pothole_id = v_row_a.pothole_id;
  delete from public.potholes where id = v_row_a.pothole_id;
  delete from auth.users where id in (v_user_a, v_user_b);
end;
$$;

do $$
begin
  raise notice 'DEV-203 submit_spot_test.sql passed';
end;
$$;
