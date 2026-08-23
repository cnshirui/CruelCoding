create table public.daily_problem_status (
  problem_date date not null,
  problem_number text not null,
  problem_slug text not null,
  cruel_id extensions.citext not null references public.scoreboard_members(cruel_id) on delete cascade,
  solved boolean not null default false,
  submitted_at timestamptz,
  checked_at timestamptz not null default now(),
  check_error text,
  primary key (problem_date, problem_number, cruel_id),
  constraint daily_problem_status_number_not_blank check (btrim(problem_number) <> ''),
  constraint daily_problem_status_slug_not_blank check (btrim(problem_slug) <> '')
);

create index daily_problem_status_checked_idx on public.daily_problem_status (problem_date desc, checked_at desc);
alter table public.daily_problem_status enable row level security;
revoke all on table public.daily_problem_status from anon, authenticated;
grant select on table public.daily_problem_status to anon, authenticated;
create policy "Daily problem status is public"
  on public.daily_problem_status for select to anon, authenticated using (true);
