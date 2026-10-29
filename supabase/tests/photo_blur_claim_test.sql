-- claim_photo_blur_report: lock, reclaim after stale lock, max attempts (run after migrations).
\set ON_ERROR_STOP on

do $$
declare
  v_user uuid := '11111111-1111-4111-8111-111111111111';
  v_pothole uuid := '22222222-2222-4222-8222-222222222222';
  v_report uuid := '33333333-3333-4333-8333-333333333333';
  v_claim public.reports;
  v_attempts integer;
begin
  insert into auth.users (id, email) values (v_user, 'test@example.com');
  insert into public.profiles (id, username, is_anonymous)
  values (v_user, 'claim_test', false)
  on conflict (id) do nothing;

  insert into public.potholes (id, name, location)
  values (
    v_pothole,
    'Claim test pothole',
    st_setsrid(st_makepoint(28.0, -26.0), 4326)::geography
  );

  insert into public.reports (
    id,
    pothole_id,
    reporter_id,
    photo_path,
    location,
    photo_moderation_status
  )
  values (
    v_report,
    v_pothole,
    v_user,
    'user/test.jpg',
    st_setsrid(st_makepoint(28.0, -26.0), 4326)::geography,
    'pending'
  );

  set local role service_role;

  select * into v_claim from public.claim_photo_blur_report(v_report);
  if v_claim.id is null then
    raise exception 'first claim should succeed';
  end if;
  if v_claim.photo_blur_attempt_count <> 1 or v_claim.photo_blur_processing_at is null then
    raise exception 'first claim should set attempt=1 and processing_at';
  end if;

  select * into v_claim from public.claim_photo_blur_report(v_report);
  if v_claim.id is not null then
    raise exception 'second claim while lock fresh should return no row';
  end if;

  reset role;
  update public.reports
  set photo_blur_processing_at = now() - interval '11 minutes'
  where id = v_report;

  set local role service_role;
  select * into v_claim from public.claim_photo_blur_report(v_report);
  if v_claim.id is null or v_claim.photo_blur_attempt_count <> 2 then
    raise exception 'stale lock reclaim should succeed with attempt=2';
  end if;

  reset role;
  update public.reports
  set photo_blur_attempt_count = 4,
      photo_blur_processing_at = now() - interval '11 minutes'
  where id = v_report;

  set local role service_role;
  select * into v_claim from public.claim_photo_blur_report(v_report);
  if v_claim.id is null or v_claim.photo_blur_attempt_count <> 5 then
    raise exception 'fifth claim should succeed';
  end if;

  select * into v_claim from public.claim_photo_blur_report(v_report);
  if v_claim.id is not null then
    raise exception 'sixth claim should fail (max attempts)';
  end if;

  reset role;
  select photo_blur_attempt_count into v_attempts from public.reports where id = v_report;
  if v_attempts <> 5 then
    raise exception 'attempt count should remain 5 after exhaustion';
  end if;
end;
$$;
