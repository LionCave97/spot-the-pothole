-- Spot the Pothole — core schema with PostGIS
create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  is_anonymous boolean not null default false,
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mdb_code text not null unique,
  boundary geography (polygon, 4326) not null,
  councillor text,
  party text,
  as_of date not null,
  created_at timestamptz not null default now()
);

create index wards_boundary_gix on public.wards using gist (boundary);

create type public.pothole_status as enum ('open', 'fixed', 'comeback');

create table public.potholes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status public.pothole_status not null default 'open',
  location geography (point, 4326) not null,
  road_ref text,
  authority text,
  ward_id uuid references public.wards (id),
  first_seen timestamptz not null default now(),
  fixed_at timestamptz,
  comeback_count integer not null default 0 check (comeback_count >= 0),
  parent_pothole_id uuid references public.potholes (id),
  confirmation_count integer not null default 0 check (confirmation_count >= 0),
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index potholes_location_gix on public.potholes using gist (location);
create index potholes_ward_id_idx on public.potholes (ward_id);
create index potholes_status_idx on public.potholes (status);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  pothole_id uuid not null references public.potholes (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  photo_path text not null,
  location geography (point, 4326) not null,
  created_at timestamptz not null default now()
);

create index reports_location_gix on public.reports using gist (location);

create table public.confirmations (
  id uuid primary key default gen_random_uuid(),
  pothole_id uuid not null references public.potholes (id) on delete cascade,
  confirmer_id uuid not null references public.profiles (id) on delete cascade,
  location geography (point, 4326) not null,
  created_at timestamptz not null default now(),
  unique (pothole_id, confirmer_id)
);

create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  pothole_id uuid not null references public.potholes (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index timeline_events_pothole_id_idx on public.timeline_events (pothole_id, created_at desc);

create table public.guesses (
  id uuid primary key default gen_random_uuid(),
  pothole_id uuid not null references public.potholes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  guess_text text not null,
  is_correct boolean,
  created_at timestamptz not null default now()
);

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null
);

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  pothole_id uuid not null references public.potholes (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.likes (
  id uuid primary key default gen_random_uuid(),
  pothole_id uuid not null references public.potholes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (pothole_id, user_id)
);

create type public.moderation_target as enum ('pothole', 'comment', 'report');
create type public.moderation_reason as enum ('spam', 'unsafe', 'wrong_location', 'other');

create table public.moderation_flags (
  id uuid primary key default gen_random_uuid(),
  target_type public.moderation_target not null,
  target_id uuid not null,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason public.moderation_reason not null,
  details text,
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, is_anonymous)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'is_anonymous')::boolean, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
