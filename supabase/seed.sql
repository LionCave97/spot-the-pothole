-- Fake seed data only — no real users or photos.
-- Run after migrations: supabase db reset (applies migrations + seed)

insert into public.badges (slug, name, description) values
  ('first_spot', 'First Spot', 'Reported your first pothole.'),
  ('confirm_crew', 'Confirm Crew', 'Confirmed 5 potholes.'),
  ('ward_watch', 'Ward Watch', 'Spotted potholes in 3 different wards.');

-- Demo wards (simplified rectangles near JHB / CPT)
insert into public.wards (name, mdb_code, boundary, councillor, party, as_of) values
  (
    'Johannesburg Ward 99 (Demo)',
    'JHB-W99',
    st_geogfromtext('POLYGON((28.040 -26.205, 28.055 -26.205, 28.055 -26.195, 28.040 -26.195, 28.040 -26.205))'),
    'Demo Councillor Mokoena',
    'Independent (demo)',
    '2026-01-01'
  ),
  (
    'Cape Town Ward 77 (Demo)',
    'CPT-W77',
    st_geogfromtext('POLYGON((18.420 -33.925, 18.435 -33.925, 18.435 -33.915, 18.420 -33.915, 18.420 -33.925))'),
    'Demo Councillor Daniels',
    'Demo Party',
    '2026-01-01'
  );

-- Placeholder potholes (no auth.users — for map UI dev use service role or local overrides)
-- In local dev, create test users via Supabase Auth then link reports.

insert into public.potholes (
  id,
  name,
  status,
  location,
  road_ref,
  authority,
  ward_id,
  first_seen,
  confirmation_count,
  photo_path
)
select
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
  'Grayston Drive Crater (demo)',
  'open',
  st_setsrid(st_makepoint(28.047, -26.200), 4326)::geography,
  'M11',
  'City of Johannesburg Roads',
  w.id,
  now() - interval '3 days',
  1,
  'demo/photos/grayston-crater.jpg'
from public.wards w where w.mdb_code = 'JHB-W99';

insert into public.potholes (
  id,
  name,
  status,
  location,
  road_ref,
  authority,
  ward_id,
  first_seen,
  fixed_at,
  confirmation_count,
  photo_path
)
select
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid,
  'Main Road Moonscape (demo)',
  'fixed',
  st_setsrid(st_makepoint(18.427, -33.920), 4326)::geography,
  'M4',
  'City of Cape Town Transport',
  w.id,
  now() - interval '30 days',
  now() - interval '2 days',
  3,
  'demo/photos/main-road-moonscape.jpg'
from public.wards w where w.mdb_code = 'CPT-W77';

insert into public.timeline_events (pothole_id, event_type, payload)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
    'spotted',
    '{"source":"seed","note":"demo event"}'::jsonb
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid,
    'marked_fixed',
    '{"source":"seed","note":"demo fix"}'::jsonb
  );
