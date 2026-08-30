create table public.leaderboard_refresh_state (
  id boolean primary key default true check (id),
  refreshed_at timestamptz not null default '-infinity',
  refreshed_by uuid references auth.users (id) on delete set null
);

alter table public.leaderboard_refresh_state enable row level security;
revoke all on table public.leaderboard_refresh_state from public, anon, authenticated;
grant all on table public.leaderboard_refresh_state to service_role;

insert into public.leaderboard_refresh_state (id) values (true) on conflict (id) do nothing;

-- Claims the single global refresh slot so any signed-in member can trigger a refresh
-- without letting the whole group hammer the WisdomPeak and LeetCode sources. `for update`
-- serialises concurrent callers on the one row: the loser re-reads the committed timestamp
-- and fails the cooldown check instead of racing into a second upstream fetch.
create or replace function public.claim_leaderboard_refresh(cooldown_seconds integer, actor uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  previous timestamptz;
begin
  if cooldown_seconds is null or cooldown_seconds < 0 then
    raise exception 'cooldown_seconds must be a non-negative integer';
  end if;

  select state.refreshed_at into previous
    from public.leaderboard_refresh_state as state
   where state.id
     for update;
  if not found then
    raise exception 'leaderboard_refresh_state is missing its singleton row';
  end if;

  if previous > now() - make_interval(secs => cooldown_seconds) then
    return jsonb_build_object('claimed', false, 'refreshed_at', previous);
  end if;

  update public.leaderboard_refresh_state as state
     set refreshed_at = now(), refreshed_by = actor
   where state.id;

  return jsonb_build_object('claimed', true, 'refreshed_at', now(), 'previous_refreshed_at', previous);
end;
$$;

revoke all on function public.claim_leaderboard_refresh(integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_leaderboard_refresh(integer, uuid) to service_role;

-- Hands the slot back when the refresh itself fails, so a broken upstream does not
-- cost the group a full cooldown window.
create or replace function public.release_leaderboard_refresh(previous_refreshed_at timestamptz)
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  update public.leaderboard_refresh_state
     set refreshed_at = coalesce(previous_refreshed_at, '-infinity'), refreshed_by = null
   where id;
$$;

revoke all on function public.release_leaderboard_refresh(timestamptz) from public, anon, authenticated;
grant execute on function public.release_leaderboard_refresh(timestamptz) to service_role;
