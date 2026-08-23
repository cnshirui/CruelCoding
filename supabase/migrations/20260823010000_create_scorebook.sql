create extension if not exists citext;

create table if not exists public.scoreboard_members (
  id bigint generated always as identity primary key,
  cruel_id citext not null unique,
  cruel_date date not null,
  subgroup text,
  created_at timestamptz not null default now(),
  constraint scoreboard_members_cruel_id_not_blank check (btrim(cruel_id::text) <> '')
);

create table if not exists public.scoreboard_snapshots (
  id bigint generated always as identity primary key,
  source_url text not null,
  generated_at timestamptz not null default now(),
  latest_contest integer not null
);

create table if not exists public.member_scores (
  snapshot_id bigint not null references public.scoreboard_snapshots(id) on delete cascade,
  member_id bigint not null references public.scoreboard_members(id) on delete cascade,
  membership_days integer not null,
  rating integer,
  rolling_score numeric(5,1) not null,
  source_rank integer not null,
  primary key (snapshot_id, member_id)
);

create table if not exists public.contests (
  contest_number integer primary key,
  participants integer not null check (participants >= 0)
);

create table if not exists public.scorebook_contest_results (
  snapshot_id bigint not null references public.scoreboard_snapshots(id) on delete cascade,
  member_id bigint not null references public.scoreboard_members(id) on delete cascade,
  contest_number integer not null references public.contests(contest_number),
  rank integer,
  score numeric(5,1) not null default 0,
  primary key (snapshot_id, member_id, contest_number),
  constraint contest_results_rank_positive check (rank is null or rank > 0)
);

create index if not exists member_scores_sort_idx on public.member_scores (snapshot_id, rolling_score desc);
create index if not exists scorebook_contest_results_member_idx on public.scorebook_contest_results (member_id, contest_number desc);

alter table public.scoreboard_members enable row level security;
alter table public.scoreboard_snapshots enable row level security;
alter table public.member_scores enable row level security;
alter table public.contests enable row level security;
alter table public.scorebook_contest_results enable row level security;
grant select on public.scoreboard_members, public.scoreboard_snapshots, public.member_scores, public.contests, public.scorebook_contest_results to anon, authenticated;
create policy "Scoreboard members are public" on public.scoreboard_members for select using (true);
create policy "Scoreboard snapshots are public" on public.scoreboard_snapshots for select using (true);
create policy "Member scores are public" on public.member_scores for select using (true);
create policy "Contests are public" on public.contests for select using (true);
create policy "Scorebook contest results are public" on public.scorebook_contest_results for select using (true);
