create table if not exists public.members (
  username text primary key,
  rating double precision not null default 0,
  global_rank integer,
  contests_attended integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.contest_results (
  username text not null references public.members(username) on delete cascade,
  contest_title text not null,
  rating double precision not null,
  ranking integer,
  sequence integer not null,
  primary key (username, contest_title)
);

alter table public.members enable row level security;
alter table public.contest_results enable row level security;
revoke all on table public.members, public.contest_results from anon, authenticated;
grant select on table public.members, public.contest_results to anon, authenticated;

drop policy if exists "Public leaderboard members are readable" on public.members;
create policy "Public leaderboard members are readable" on public.members for select to anon, authenticated using (true);
drop policy if exists "Public contest results are readable" on public.contest_results;
create policy "Public contest results are readable" on public.contest_results for select to anon, authenticated using (true);

create or replace view public.leaderboard with (security_invoker = true) as
select
  m.username,
  m.rating,
  m.global_rank,
  m.contests_attended,
  latest.contest_title as latest_contest,
  latest.ranking as latest_contest_rank,
  coalesce(stats.peak_rating, m.rating) as peak_rating
from public.members m
left join lateral (
  select cr.contest_title, cr.ranking
  from public.contest_results cr where cr.username = m.username
  order by cr.sequence desc limit 1
) latest on true
left join lateral (
  select max(cr.rating) as peak_rating
  from public.contest_results cr where cr.username = m.username
) stats on true;

revoke all on table public.leaderboard from anon, authenticated;
grant select on table public.leaderboard to anon, authenticated;
