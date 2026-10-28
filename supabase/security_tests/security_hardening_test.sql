-- Security regression checks for DEV-209 (run after supabase db reset).
-- Fictional data only; no secrets.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Privileges: anon/authenticated must not execute server-only RPCs
-- ---------------------------------------------------------------------------

do $$
begin
  if has_function_privilege(
    'anon',
    'public.record_confirmation(uuid, uuid, double precision, double precision)',
    'EXECUTE'
  ) then
    raise exception 'anon must not EXECUTE record_confirmation';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.merge_report_into_pothole(uuid, double precision)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must not EXECUTE merge_report_into_pothole';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.record_confirmation(uuid, uuid, double precision, double precision)',
    'EXECUTE'
  ) then
    raise exception 'service_role must EXECUTE record_confirmation';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Direct SELECT revoked on sensitive tables (use *_public views)
-- ---------------------------------------------------------------------------

do $$
begin
  if has_table_privilege('anon', 'public.reports', 'SELECT') then
    raise exception 'anon must not SELECT public.reports';
  end if;

  if has_table_privilege('anon', 'public.profiles', 'SELECT') then
    raise exception 'anon must not SELECT public.profiles';
  end if;

  if not has_table_privilege('anon', 'public.reports_public', 'SELECT') then
    raise exception 'anon must SELECT public.reports_public';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Unsafe RLS policies removed
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'potholes'
      and policyname = 'Authenticated users update potholes'
  ) then
    raise exception 'pothole update policy should be dropped';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reports'
      and policyname = 'Authenticated users insert reports'
  ) then
    raise exception 'direct report insert policy should be dropped';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'confirmations'
      and policyname = 'Authenticated users insert confirmations'
  ) then
    raise exception 'direct confirmation insert policy should be dropped';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public spot/confirmation views: no per-user route history (requirement 1)
-- ---------------------------------------------------------------------------

do $$
declare
  v_bad_cols text[];
begin
  select array_agg(column_name order by column_name)
  into v_bad_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'reports_public'
    and column_name = any (array[
      'reporter_id',
      'reporter_username',
      'confirmer_id',
      'created_at',
      'reported_at'
    ]);

  if v_bad_cols is not null then
    raise exception 'reports_public exposes route/history columns: %', v_bad_cols;
  end if;

  select array_agg(column_name order by column_name)
  into v_bad_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'confirmations_public'
    and column_name = any (array[
      'confirmer_id',
      'confirmer_username',
      'reporter_id',
      'created_at',
      'confirmed_at'
    ]);

  if v_bad_cols is not null then
    raise exception 'confirmations_public exposes route/history columns: %', v_bad_cols;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Anonymous spots never linked to a profile in public views (requirement 2)
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid := '00000000-0000-4000-8000-0000000000a1';
  v_pothole uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
  v_lat double precision;
  v_lng double precision;
  v_view_lat double precision;
  v_view_lng double precision;
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_user,
    'authenticated',
    'authenticated',
    'anon-spot-test@example.invalid',
    extensions.crypt('test-password', extensions.gen_salt('bf')),
    now(),
    '{"username":"hidden_spotter","is_anonymous":true}'::jsonb,
    now(),
    now()
  )
  on conflict (id) do nothing;

  update public.profiles
    set username = 'hidden_spotter',
        is_anonymous = true
  where id = v_user;

  insert into public.reports (pothole_id, reporter_id, photo_path, location)
  values (
    v_pothole,
    v_user,
    'demo/anonymous-spot.jpg',
    st_setsrid(st_makepoint(28.0471, -26.2002), 4326)::geography
  )
  returning
    st_y(location::geometry),
    st_x(location::geometry)
  into v_lat, v_lng;

  perform set_config('role', 'anon', true);

  select rp.lat, rp.lng
  into v_view_lat, v_view_lng
  from public.reports_public rp
  where rp.photo_path = 'demo/anonymous-spot.jpg'
  limit 1;

  if v_view_lat is null then
    raise exception 'expected anonymous spot in reports_public';
  end if;

  if v_view_lat <> v_lat or v_view_lng <> v_lng then
    raise exception 'reports_public must keep exact spot coordinates';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reports_public'
      and column_name ~* '(reporter|confirmer|user|author|profile|username|_id$)'
      and column_name not in ('id', 'pothole_id')
  ) then
    raise exception 'reports_public must not expose profile linkage columns';
  end if;

  perform set_config('role', 'postgres', true);
  delete from public.reports where reporter_id = v_user and pothole_id = v_pothole;
  delete from auth.users where id = v_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- Masking: anonymous profile hides id/username in profiles_public
-- ---------------------------------------------------------------------------

do $$
declare
  v_id uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccc03';
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    'anon-mask-test@example.invalid',
    extensions.crypt('test-password', extensions.gen_salt('bf')),
    now(),
    '{"username":"secret_anon_user","is_anonymous":true}'::jsonb,
    now(),
    now()
  )
  on conflict (id) do nothing;

  update public.profiles
    set username = 'secret_anon_user',
        is_anonymous = true,
        points = 42
  where id = v_id;

  perform set_config('role', 'anon', true);

  if exists (
    select 1
    from public.profiles_public
    where username = 'secret_anon_user'
       or id = v_id
  ) then
    raise exception 'anonymous profile leaked identity in profiles_public';
  end if;

  if not exists (
    select 1
    from public.profiles_public
    where username = 'Anonymous'
      and is_anonymous = true
      and points = 42
      and id is null
  ) then
    raise exception 'expected masked anonymous row in profiles_public';
  end if;

  perform set_config('role', 'postgres', true);
  delete from auth.users where id = v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_confirmation: self-confirm and proximity (service_role only)
-- ---------------------------------------------------------------------------

do $$
declare
  v_pothole uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
  v_reporter uuid := '00000000-0000-4000-8000-000000000004';
  v_confirmer uuid := '00000000-0000-4000-8000-000000000005';
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
  values
    (
      '00000000-0000-0000-0000-000000000000',
      v_reporter,
      'authenticated',
      'authenticated',
      'reporter-demo@example.invalid',
      extensions.crypt('test-password', extensions.gen_salt('bf')),
      now(),
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_confirmer,
      'authenticated',
      'authenticated',
      'confirmer-demo@example.invalid',
      extensions.crypt('test-password', extensions.gen_salt('bf')),
      now(),
      now(),
      now()
    )
  on conflict (id) do nothing;

  insert into public.reports (pothole_id, reporter_id, photo_path, location)
  values (
    v_pothole,
    v_reporter,
    'demo/test.jpg',
    st_setsrid(st_makepoint(28.047, -26.200), 4326)::geography
  );

  perform set_config('role', 'service_role', true);

  begin
    perform public.record_confirmation(v_pothole, v_reporter, -26.200, 28.047);
    raise exception 'self-confirmation should fail';
  exception
    when others then
      if sqlerrm not like '%cannot confirm your own report%' then
        raise;
      end if;
  end;

  begin
    perform public.record_confirmation(v_pothole, v_confirmer, -33.0, 18.0);
    raise exception 'distant confirmation should fail';
  exception
    when others then
      if sqlerrm not like '%within 15m%' then
        raise;
      end if;
  end;

  perform set_config('role', 'postgres', true);
  delete from public.reports where reporter_id = v_reporter and pothole_id = v_pothole;
  delete from auth.users where id in (v_reporter, v_confirmer);
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles: points not client-writable (policy with check)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users update own profile safe fields'
  ) then
    raise exception 'missing safe profile update policy';
  end if;
end;
$$;

do $$
begin
  raise notice 'DEV-209 security_hardening_test.sql passed';
end;
$$;
