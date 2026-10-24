-- 残酷AI群: members apply with their login, the group owner approves, approved members post a
-- daily study note (>= 50 chars) on one course and comment on each other's notes.
--
-- Check-ins reuse public.daily_checkins. LeetCode rows keep cruel_id + owner_hash (cookie API);
-- AI-group rows are keyed by user_id and carry the course_code (the "class") they studied.
create type public.ai_member_status as enum ('pending', 'approved', 'rejected');

create table public.ai_group_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (btrim(display_name) <> ''),
  status public.ai_member_status not null default 'pending',
  applied_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);

alter table public.daily_checkins
  alter column cruel_id drop not null,
  alter column owner_hash drop not null,
  add column user_id uuid references public.ai_group_members (user_id) on delete cascade,
  add column course_code text check (course_code is null or btrim(course_code) <> ''),
  drop constraint daily_checkins_note_length,
  add constraint daily_checkins_note_length check (note is null or char_length(note) <= 2000),
  -- A row belongs to exactly one group: LeetCode (cruel_id + cookie owner) or AI (user + course + 50-char note).
  add constraint daily_checkins_group_shape check (
    (cruel_id is not null and owner_hash is not null and user_id is null and course_code is null)
    or (user_id is not null and course_code is not null and cruel_id is null and owner_hash is null and note is not null and char_length(note) >= 50)
  ),
  -- Enforced here too, so a member calling Supabase directly cannot back-fill the future.
  add constraint daily_checkins_not_in_future check (user_id is null or checkin_date <= (now() at time zone 'Asia/Shanghai')::date);

create unique index daily_checkins_one_per_user_per_day on public.daily_checkins (user_id, checkin_date) where user_id is not null;
create index daily_checkins_course_idx on public.daily_checkins (course_code, checkin_date desc) where course_code is not null;

create table public.daily_checkin_comments (
  id bigint generated always as identity primary key,
  checkin_id bigint not null references public.daily_checkins (id) on delete cascade,
  user_id uuid not null references public.ai_group_members (user_id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index daily_checkin_comments_checkin_idx on public.daily_checkin_comments (checkin_id, created_at);

create or replace function public.ai_is_approved_member(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ai_group_members where user_id = uid and status = 'approved');
$$;
revoke all on function public.ai_is_approved_member(uuid) from public;
grant execute on function public.ai_is_approved_member(uuid) to authenticated;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger daily_checkins_touch_updated_at before update on public.daily_checkins
  for each row execute function public.touch_updated_at();

alter table public.ai_group_members enable row level security;
alter table public.daily_checkin_comments enable row level security;
revoke all on table public.ai_group_members, public.daily_checkin_comments from anon, authenticated;
-- LeetCode rows stay public; AI-group notes are for logged-in users only, and anon never sees
-- owner_hash or the AI columns. Column grants keep clients off cruel_id/owner_hash/created_at/
-- updated_at; upsert also sets user_id on conflict, and RLS pins it to auth.uid().
drop policy "Daily check-ins are publicly readable" on public.daily_checkins;
create policy "LeetCode check-ins are publicly readable"
  on public.daily_checkins for select to anon, authenticated using (cruel_id is not null);
create policy "AI check-ins are visible to logged-in users"
  on public.daily_checkins for select to authenticated using (user_id is not null);
revoke select on table public.daily_checkins from anon;
grant select (id, cruel_id, checkin_date, note, created_at, updated_at) on table public.daily_checkins to anon;
grant insert (user_id, checkin_date, course_code, note), update (user_id, checkin_date, course_code, note), delete on table public.daily_checkins to authenticated;
grant select on table public.ai_group_members to authenticated;
grant insert (user_id, display_name) on table public.ai_group_members to authenticated;
grant select, delete on table public.daily_checkin_comments to authenticated;
grant insert (checkin_id, user_id, body) on table public.daily_checkin_comments to authenticated;

create policy "AI group members are visible to logged-in users"
  on public.ai_group_members for select to authenticated using (true);
create policy "Users apply for themselves"
  on public.ai_group_members for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending');
-- Approval and rejection go through the server with the secret key (see app/ai-agents/actions.ts).

create policy "Approved members write their own check-ins"
  on public.daily_checkins for insert to authenticated
  with check (auth.uid() = user_id and public.ai_is_approved_member(auth.uid()));
create policy "Approved members edit their own check-ins"
  on public.daily_checkins for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id and public.ai_is_approved_member(auth.uid()));
create policy "Members delete their own check-ins"
  on public.daily_checkins for delete to authenticated using (auth.uid() = user_id);

create policy "Check-in comments are visible to logged-in users"
  on public.daily_checkin_comments for select to authenticated using (true);
create policy "Approved members comment as themselves"
  on public.daily_checkin_comments for insert to authenticated
  with check (auth.uid() = user_id and public.ai_is_approved_member(auth.uid()));
create policy "Members delete their own comments"
  on public.daily_checkin_comments for delete to authenticated using (auth.uid() = user_id);
