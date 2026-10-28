-- DEV-200 auth onboarding SQL tests (run after supabase db reset).

\set ON_ERROR_STOP on

do $$
begin
  if public.validate_username('ab') is distinct from 'invalidFormat' then
    raise exception 'expected invalidFormat for short username';
  end if;

  if public.validate_username('good_spotter') is not null then
    raise exception 'expected valid username';
  end if;

  if public.validate_username('John Smith') is distinct from 'looksLikeFullName' then
    raise exception 'expected full-name rejection';
  end if;

  if public.is_username_available('admin') then
    raise exception 'reserved username must not be available';
  end if;
end;
$$;

do $$
declare
  v_user uuid := '00000000-0000-4000-8000-00000000d200';
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
    'dev200-onboard@example.invalid',
    extensions.crypt('test-password', extensions.gen_salt('bf')),
    now(),
    '{}'::jsonb,
    now(),
    now()
  )
  on conflict (id) do nothing;

  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('role', 'authenticated', true);

  perform public.complete_onboarding('dev200_spotter', true, '2026-01-popia-v1');

  if not exists (
    select 1
    from public.popia_consents
    where user_id = v_user
      and notice_version = '2026-01-popia-v1'
  ) then
    raise exception 'POPIA consent row missing';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_user
      and username = 'dev200_spotter'
      and is_anonymous = true
      and onboarding_completed_at is not null
  ) then
    raise exception 'profile onboarding fields not set';
  end if;

  begin
    perform public.complete_onboarding('dev200_spotter', false, '2026-01-popia-v1');
    raise exception 'expected username taken error';
  exception
    when others then
      if sqlerrm not like '%username taken%' then
        raise;
      end if;
  end;

  perform set_config('role', 'postgres', true);
  delete from auth.users where id = v_user;
end;
$$;
