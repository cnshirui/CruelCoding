alter table public.scorebook_contest_results
  drop constraint scorebook_contest_results_contest_number_fkey;

alter table public.contests
  add column id bigint generated always as identity;

alter table public.contests
  drop constraint contests_pkey,
  add constraint contests_pkey primary key (id),
  alter column contest_number drop not null,
  alter column participants set default 0,
  add column title text,
  add column title_slug text,
  add column start_time timestamptz,
  add column origin_start_time timestamptz,
  add column card_img text,
  add column imported_at timestamptz not null default now(),
  add constraint contests_contest_number_key unique (contest_number),
  add constraint contests_title_slug_key unique (title_slug),
  add constraint contests_title_not_blank check (title is null or btrim(title) <> ''),
  add constraint contests_title_slug_not_blank check (title_slug is null or btrim(title_slug) <> '');

update public.contests
set
  title = 'Weekly Contest ' || contest_number,
  title_slug = 'weekly-contest-' || contest_number
where contest_number is not null and title_slug is null;

alter table public.contests
  alter column title set not null,
  alter column title_slug set not null;

alter table public.scorebook_contest_results
  add constraint scorebook_contest_results_contest_number_fkey
  foreign key (contest_number) references public.contests(contest_number);

create index contests_start_time_idx on public.contests (start_time desc);

revoke all on table public.contests from anon, authenticated;
grant select on table public.contests to anon, authenticated;
