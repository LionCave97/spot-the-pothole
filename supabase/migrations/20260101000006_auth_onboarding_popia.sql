-- DEV-200: Auth onboarding, POPIA consent, username validation, account deletion.
-- Compatible with DEV-209 hardening (auth.uid(), service_role-only game RPCs, *_public views).

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

create table if not exists public.popia_consents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notice_version text not null,
  consented_at timestamptz not null default now()
);

alter table public.popia_consents enable row level security;

create policy "Users read own POPIA consent"
  on public.popia_consents for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own POPIA consent"
  on public.popia_consents for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own POPIA consent"
  on public.popia_consents for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Username validation (no full names; English slurs subset)
-- ---------------------------------------------------------------------------

create or replace function public.validate_username(p_username text)
returns text
language plpgsql
immutable
as $$
declare
  v text := lower(trim(p_username));
begin
  if p_username ~ '\s' or p_username like '%@%' then
    return 'looksLikeFullName';
  end if;
  if v is null or char_length(v) < 3 or char_length(v) > 24 then
    return 'invalidFormat';
  end if;
  if v !~ '^[a-z0-9_]+$' then
    return 'invalidFormat';
  end if;
  if v = any (array[
    'admin', 'moderator', 'support', 'anonymous', 'spotthepothole'
  ]) then
    return 'blocked';
  end if;
  if lower(p_username) ~ '(fuck|shit|bitch|cunt|nigger|kaffir|poes)' then
    return 'blocked';
  end if;
  return null;
end;
$$;

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    public.validate_username(p_username) is null
    and not exists (
      select 1
      from public.profiles p
      where lower(p.username) = lower(trim(p_username))
    );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;
grant execute on function public.validate_username(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Signup: random placeholder username until onboarding (never email-derived)
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
  v_username := 'user_' || substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 12);

  insert into public.profiles (id, username, is_anonymous, onboarding_completed_at)
  values (
    new.id,
    v_username,
    coalesce((new.raw_user_meta_data ->> 'is_anonymous')::boolean, false),
    null
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Onboarding RPC (authenticated; sets username, anonymity, POPIA consent)
-- ---------------------------------------------------------------------------

create or replace function public.complete_onboarding(
  p_username text,
  p_is_anonymous boolean,
  p_notice_version text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_err text;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if p_notice_version is null or trim(p_notice_version) = '' then
    raise exception 'consent version required';
  end if;

  v_err := public.validate_username(p_username);
  if v_err is not null then
    raise exception 'invalid username: %', v_err;
  end if;

  if exists (
    select 1 from public.profiles p
    where lower(p.username) = lower(trim(p_username))
      and p.id <> v_user
  ) then
    raise exception 'username taken';
  end if;

  insert into public.popia_consents (user_id, notice_version)
  values (v_user, trim(p_notice_version))
  on conflict (user_id) do update
    set notice_version = excluded.notice_version,
        consented_at = now();

  update public.profiles
  set
    username = lower(trim(p_username)),
    is_anonymous = coalesce(p_is_anonymous, false),
    onboarding_completed_at = now(),
    updated_at = now()
  where id = v_user;
end;
$$;

grant execute on function public.complete_onboarding(text, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- POPIA account deletion (cascades profile + game data via FK)
-- ---------------------------------------------------------------------------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Allow authenticated users to update username / anonymity after onboarding (not points).
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Users update own profile safe fields" on public.profiles;

create policy "Users update own profile safe fields"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and points = (select p.points from public.profiles p where p.id = auth.uid())
  );
