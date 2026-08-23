create table public.daily_checkins (
  id bigint generated always as identity primary key,
  cruel_id citext not null references public.scoreboard_members(cruel_id)
    on update cascade on delete cascade,
  checkin_date date not null default ((now() at time zone 'America/Los_Angeles')::date),
  note text,
  owner_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint daily_checkins_one_per_member_per_day unique (cruel_id, checkin_date),
  constraint daily_checkins_note_length check (note is null or char_length(note) <= 500),
  constraint daily_checkins_owner_hash_format check (owner_hash ~ '^[0-9a-f]{64}$')
);

create index daily_checkins_date_idx
  on public.daily_checkins (checkin_date desc, created_at asc);

alter table public.daily_checkins enable row level security;
revoke all on table public.daily_checkins from anon, authenticated;
grant select on table public.daily_checkins to anon, authenticated;

create policy "Daily check-ins are publicly readable"
  on public.daily_checkins for select
  to anon, authenticated
  using (true);
