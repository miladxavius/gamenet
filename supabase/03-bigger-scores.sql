-- Game Net update 3: allow scores above 99999 (the carpet and gem games can pass it).
-- Paste into Supabase: SQL Editor -> New query -> Run. It keeps every player and score.
alter table public.scores drop constraint if exists scores_best_check;
alter table public.scores add constraint scores_best_check check (best between 0 and 99999999);
