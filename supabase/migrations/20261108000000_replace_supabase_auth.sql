-- Supabase Auth is replaced by the app's own Google sign-in (lib/auth.ts). Accounts move to
-- public.app_users with their existing ids, so AI-group rows keep their owners. The server
-- now reads and writes the AI-group tables with the secret key after checking its own session,
-- so the `authenticated` role, its RLS policies and auth.users references are dropped.

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and email ~ '^\S+@\S+\.\S+$'),
  google_sub text unique,
  name text not null default '',
  role text not null default 'user' check (role ~ '^[a-z][a-z0-9_-]*$'),
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
alter table public.app_users enable row level security;
revoke all on table public.app_users from public, anon, authenticated;

insert into public.app_users (id, email, google_sub, name, role, created_at)
select u.id,
       lower(u.email),
       (select i.provider_id from auth.identities i where i.user_id = u.id and i.provider = 'google' limit 1),
       coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''), nullif(btrim(u.raw_user_meta_data->>'name'), ''), split_part(u.email, '@', 1)),
       coalesce(nullif(u.raw_app_meta_data->>'role', ''), 'user'),
       u.created_at
from auth.users u
where u.email is not null
on conflict do nothing;

alter table public.ai_group_members
  drop constraint ai_group_members_user_id_fkey,
  add constraint ai_group_members_user_id_fkey foreign key (user_id) references public.app_users (id) on delete cascade,
  drop constraint ai_group_members_reviewed_by_fkey,
  add constraint ai_group_members_reviewed_by_fkey foreign key (reviewed_by) references public.app_users (id) on delete set null;

alter table public.leaderboard_refresh_state
  drop constraint leaderboard_refresh_state_refreshed_by_fkey,
  add constraint leaderboard_refresh_state_refreshed_by_fkey foreign key (refreshed_by) references public.app_users (id) on delete set null;

drop policy "AI check-ins are visible to logged-in users" on public.checkins;
drop policy "Approved members write their own check-ins" on public.checkins;
drop policy "Approved members edit their own check-ins" on public.checkins;
drop policy "Members delete their own check-ins" on public.checkins;
drop policy "AI group members are visible to logged-in users" on public.ai_group_members;
drop policy "Users apply for themselves" on public.ai_group_members;
drop policy "Check-in comments are visible to logged-in users" on public.checkin_comments;
drop policy "Approved members comment as themselves" on public.checkin_comments;
drop policy "Members delete their own comments" on public.checkin_comments;
revoke insert, update, delete on table public.checkins from authenticated;
revoke all on table public.ai_group_members, public.checkin_comments from authenticated;
drop function public.ai_is_approved_member(uuid);

drop table public.signup_activation_codes;
