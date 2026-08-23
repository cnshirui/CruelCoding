create extension if not exists pgcrypto;

do $$ begin
  create type public.user_status as enum ('active', 'inactive', 'merged');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.identity_provider as enum ('leetcode', 'email', 'legacy_external');
exception when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (btrim(display_name) <> ''),
  real_name text,
  email text check (email is null or email = lower(btrim(email))),
  company text,
  school text,
  notes text,
  external_handle text,
  status public.user_status not null default 'inactive',
  merged_into_user_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'merged' and merged_into_user_id is not null)
    or (status <> 'merged' and merged_into_user_id is null)
  )
);

create unique index if not exists users_email_unique
  on public.users (lower(email)) where email is not null;

create table if not exists public.user_identities (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  provider public.identity_provider not null,
  username text not null check (btrim(username) <> ''),
  normalized_username text generated always as (lower(btrim(username))) stored,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  check (provider <> 'leetcode' or upper(btrim(username)) <> 'X'),
  unique (provider, normalized_username)
);

create unique index if not exists user_identities_one_primary_per_provider
  on public.user_identities (user_id, provider) where is_primary;

create table if not exists public.memberships (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at date not null,
  left_at date,
  subgroup text,
  invited_by_user_id uuid references public.users(id),
  invited_by_text text,
  source_sheet text not null check (source_sheet in ('Current', 'Quited')),
  source_row integer not null check (source_row > 0),
  membership_days integer generated always as (
    case when left_at is null then null else left_at - joined_at end
  ) stored,
  created_at timestamptz not null default now(),
  check (left_at is null or left_at >= joined_at),
  unique (source_sheet, source_row)
);

create unique index if not exists memberships_one_open_membership_per_user
  on public.memberships (user_id) where left_at is null;
create index if not exists memberships_joined_at_idx on public.memberships (joined_at);
create index if not exists memberships_left_at_idx on public.memberships (left_at);
create index if not exists memberships_subgroup_idx
  on public.memberships (subgroup) where subgroup is not null;

alter table public.users enable row level security;
alter table public.user_identities enable row level security;
alter table public.memberships enable row level security;

revoke all on table public.users, public.user_identities, public.memberships
  from anon, authenticated;

create or replace view public.active_users with (security_invoker = true) as
select
  u.id,
  u.display_name,
  u.real_name,
  u.email,
  u.company,
  u.school,
  i.username as leetcode_username,
  m.joined_at,
  m.subgroup,
  m.invited_by_user_id,
  m.invited_by_text
from public.users u
join public.memberships m on m.user_id = u.id and m.left_at is null
left join public.user_identities i
  on i.user_id = u.id and i.provider = 'leetcode' and i.is_primary
where u.status = 'active';

revoke all on table public.active_users from anon, authenticated;

