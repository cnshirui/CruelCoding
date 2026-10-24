-- 残酷AI群: members apply with their login, the group owner approves, approved members post a
-- daily study note (>= 50 chars) on one course and comment on each other's notes.
create type public.ai_member_status as enum ('pending', 'approved', 'rejected');

create table public.ai_group_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (btrim(display_name) <> ''),
  status public.ai_member_status not null default 'pending',
  applied_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);

create table public.ai_checkins (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.ai_group_members (user_id) on delete cascade,
  checkin_date date not null,
  course_code text not null check (btrim(course_code) <> ''),
  note text not null check (char_length(note) between 50 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, checkin_date)
);
create index ai_checkins_date_idx on public.ai_checkins (checkin_date desc, created_at asc);
create index ai_checkins_course_idx on public.ai_checkins (course_code, checkin_date desc);

create table public.ai_checkin_comments (
  id bigint generated always as identity primary key,
  checkin_id bigint not null references public.ai_checkins (id) on delete cascade,
  user_id uuid not null references public.ai_group_members (user_id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index ai_checkin_comments_checkin_idx on public.ai_checkin_comments (checkin_id, created_at);

create or replace function public.ai_is_approved_member(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ai_group_members where user_id = uid and status = 'approved');
$$;
revoke all on function public.ai_is_approved_member(uuid) from public;
grant execute on function public.ai_is_approved_member(uuid) to authenticated;

alter table public.ai_group_members enable row level security;
alter table public.ai_checkins enable row level security;
alter table public.ai_checkin_comments enable row level security;
revoke all on table public.ai_group_members, public.ai_checkins, public.ai_checkin_comments from anon, authenticated;
grant select, insert on table public.ai_group_members to authenticated;
grant select, insert, update, delete on table public.ai_checkins to authenticated;
grant select, insert, delete on table public.ai_checkin_comments to authenticated;

create policy "AI group members are visible to logged-in users"
  on public.ai_group_members for select to authenticated using (true);
create policy "Users apply for themselves"
  on public.ai_group_members for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending');
-- Approval and rejection go through the server with the secret key (see app/ai-agents/actions.ts).

create policy "AI check-ins are visible to logged-in users"
  on public.ai_checkins for select to authenticated using (true);
create policy "Approved members write their own check-ins"
  on public.ai_checkins for insert to authenticated
  with check (auth.uid() = user_id and public.ai_is_approved_member(auth.uid()));
create policy "Approved members edit their own check-ins"
  on public.ai_checkins for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id and public.ai_is_approved_member(auth.uid()));
create policy "Members delete their own check-ins"
  on public.ai_checkins for delete to authenticated using (auth.uid() = user_id);

create policy "AI check-in comments are visible to logged-in users"
  on public.ai_checkin_comments for select to authenticated using (true);
create policy "Approved members comment as themselves"
  on public.ai_checkin_comments for insert to authenticated
  with check (auth.uid() = user_id and public.ai_is_approved_member(auth.uid()));
create policy "Members delete their own comments"
  on public.ai_checkin_comments for delete to authenticated using (auth.uid() = user_id);
