-- Row Level Security policies (Phase 1 — pragmatic defaults)

alter table public.profiles enable row level security;
alter table public.wards enable row level security;
alter table public.potholes enable row level security;
alter table public.reports enable row level security;
alter table public.confirmations enable row level security;
alter table public.timeline_events enable row level security;
alter table public.guesses enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.moderation_flags enable row level security;

-- Public read for game data
create policy "Wards are readable by everyone"
  on public.wards for select using (true);

create policy "Potholes are readable by everyone"
  on public.potholes for select using (true);

create policy "Reports are readable by everyone"
  on public.reports for select using (true);

create policy "Confirmations are readable by everyone"
  on public.confirmations for select using (true);

create policy "Timeline readable by everyone"
  on public.timeline_events for select using (true);

create policy "Badges readable by everyone"
  on public.badges for select using (true);

create policy "User badges readable by everyone"
  on public.user_badges for select using (true);

create policy "Comments readable by everyone"
  on public.comments for select using (true);

create policy "Likes readable by everyone"
  on public.likes for select using (true);

-- Profiles
create policy "Profiles readable by everyone"
  on public.profiles for select using (true);

create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Authenticated writes
create policy "Authenticated users insert potholes"
  on public.potholes for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users update potholes"
  on public.potholes for update
  using (auth.role() = 'authenticated');

create policy "Authenticated users insert reports"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

create policy "Authenticated users insert confirmations"
  on public.confirmations for insert
  with check (auth.uid() = confirmer_id);

create policy "Authenticated users insert comments"
  on public.comments for insert
  with check (auth.uid() = author_id);

create policy "Authors delete own comments"
  on public.comments for delete
  using (auth.uid() = author_id);

create policy "Authenticated users manage likes"
  on public.likes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Authenticated users insert guesses"
  on public.guesses for insert
  with check (auth.uid() = user_id);

create policy "Authenticated users flag content"
  on public.moderation_flags for insert
  with check (auth.uid() = reporter_id);

create policy "Users read own moderation flags"
  on public.moderation_flags for select
  using (auth.uid() = reporter_id);

-- Service role handles merges / scoring via server routes (security definer functions)
