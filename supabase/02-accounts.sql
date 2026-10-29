-- Game Net update 2: gamertag + PIN accounts.
-- Paste into Supabase: SQL Editor -> New query -> Run.
-- WARNING: step 1 deletes every existing player and score.

-- 1. Start fresh: remove all current players (their profiles and scores go with them)
delete from auth.users;

-- 2. Create the player profile automatically when someone signs up
create or replace function public.handle_new_player()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.raw_user_meta_data ->> 'tag' is not null then
    insert into public.players (id, tag, avatar)
    values (new.id, new.raw_user_meta_data ->> 'tag',
            coalesce((new.raw_user_meta_data ->> 'avatar')::int, 0));
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_player();

-- 3. Players can change their avatar, but not their gamertag (it is their login)
drop policy if exists "create own player" on public.players;
revoke insert, update on public.players from anon, authenticated;
grant update (avatar) on public.players to authenticated;
