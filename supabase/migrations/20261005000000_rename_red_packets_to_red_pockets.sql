alter table public.red_packets rename to red_pockets;
alter index public.red_packets_user_id_idx rename to red_pockets_user_id_idx;
alter table public.red_pockets rename constraint red_packets_contest_id_member_name_key to red_pockets_contest_id_member_name_key;
alter policy "Red packets are public" on public.red_pockets rename to "Red pockets are public";

-- SQL function bodies resolve table names at call time, so the zone function is
-- recreated under the new name against the renamed table.
drop function public.red_packet_candidates(integer, integer);

-- Weekly red-pocket zone for a contest: the bottom 10% (rounded up) of current members by
-- rolling score, skipping anyone who already paid for either of the two previous weekly
-- contests. Ties go to the newer member. `paid` says whether they already paid this week.
create or replace function public.red_pocket_candidates(target_contest_number integer, zone_size integer default null)
returns table (user_id uuid, cruel_id text, wechat_name text, cruel_date date, score double precision, paid boolean)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select s.user_id, s.cruel_id, s.wechat_name, s.cruel_date, s.score,
    exists (
      select 1 from public.red_pockets r join public.contests c on c.id = r.contest_id
      where r.user_id = s.user_id and r.paid_at is not null and c.contest_number = target_contest_number
    ) as paid
  from public.current_scoreboard s
  where not exists (
    select 1
    from public.red_pockets r
    join public.contests c on c.id = r.contest_id
    where r.user_id = s.user_id
      and r.paid_at is not null
      and c.contest_number in (target_contest_number - 1, target_contest_number - 2)
  )
  order by s.score asc, s.cruel_date desc, s.user_id desc
  limit coalesce(zone_size, (select ceil(count(*) * 0.1)::integer from public.current_scoreboard));
$$;

grant execute on function public.red_pocket_candidates(integer, integer) to anon, authenticated;
