-- Game Net database. Paste into Supabase: SQL Editor -> New query -> Run.
create table public.players (
  id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  tag text not null check (tag ~ '^[A-Za-z0-9_]{3,14}$'),
  avatar int not null default 0 check (avatar between 0 and 15),
  created_at timestamptz not null default now()
);
create unique index players_tag_unique on public.players (lower(tag));

create table public.scores (
  player_id uuid not null default auth.uid() references public.players(id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9_]{1,30}$'),
  best int not null check (best between 0 and 99999),
  updated_at timestamptz not null default now(),
  primary key (player_id, game)
);

alter table public.players enable row level security;
alter table public.scores enable row level security;

create policy "read players" on public.players for select using (true);
create policy "create own player" on public.players for insert with check (auth.uid() = id);
create policy "edit own player" on public.players for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "read scores" on public.scores for select using (true);
create policy "create own score" on public.scores for insert with check (auth.uid() = player_id);
create policy "edit own score" on public.scores for update using (auth.uid() = player_id) with check (auth.uid() = player_id);
