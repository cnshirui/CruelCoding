alter table public.red_packets
  -- Set by the group owner once the packet is actually sent; only paid rows grant the
  -- two-week exemption in red_packet_candidates.
  add column paid_at timestamptz;

-- Weekly red-packet zone for a contest: the bottom 10% (rounded up) of current members by
-- rolling score, skipping anyone who already paid for either of the two previous weekly
-- contests. Ties go to the newer member. `paid` says whether they already paid this week.
create or replace function public.red_packet_candidates(target_contest_number integer, zone_size integer default null)
returns table (user_id uuid, cruel_id text, wechat_name text, cruel_date date, score double precision, paid boolean)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select s.user_id, s.cruel_id, s.wechat_name, s.cruel_date, s.score,
    exists (
      select 1 from public.red_packets r join public.contests c on c.id = r.contest_id
      where r.user_id = s.user_id and r.paid_at is not null and c.contest_number = target_contest_number
    ) as paid
  from public.current_scoreboard s
  where not exists (
    select 1
    from public.red_packets r
    join public.contests c on c.id = r.contest_id
    where r.user_id = s.user_id
      and r.paid_at is not null
      and c.contest_number in (target_contest_number - 1, target_contest_number - 2)
  )
  order by s.score asc, s.cruel_date desc, s.user_id desc
  limit coalesce(zone_size, (select ceil(count(*) * 0.1)::integer from public.current_scoreboard));
$$;

grant execute on function public.red_packet_candidates(integer, integer) to anon, authenticated;
