drop view if exists public.current_scoreboard;
drop view if exists public.leaderboard;
drop view if exists public.active_users;

alter table public.users
  add column cruel_id extensions.citext,
  add column cruel_date date,
  add column subgroup text,
  add column wechat_name text,
  add column wechat_id text,
  add column referral text,
  add column rating double precision not null default 0,
  add column global_rank integer,
  add column contests_attended integer not null default 0;

insert into public.users (
  id, display_name, external_handle, status, created_at,
  cruel_id, cruel_date, subgroup, wechat_name, wechat_id, referral
)
select
  sm.user_id,
  coalesce(nullif(btrim(sm.wechat_name), ''), sm.cruel_id::text),
  sm.cruel_id::text,
  'active'::public.user_status,
  sm.created_at,
  sm.cruel_id, sm.cruel_date, sm.subgroup,
  sm.wechat_name, sm.wechat_id, sm.referral
from public.scoreboard_members sm
on conflict (id) do update set
  cruel_id = excluded.cruel_id,
  cruel_date = excluded.cruel_date,
  subgroup = excluded.subgroup,
  wechat_name = excluded.wechat_name,
  wechat_id = excluded.wechat_id,
  referral = excluded.referral,
  external_handle = excluded.external_handle,
  status = 'active';

insert into public.users (
  display_name, external_handle, status, cruel_id,
  rating, global_rank, contests_attended, updated_at
)
select m.username, m.username, 'active', m.username,
       m.rating, m.global_rank, m.contests_attended, m.updated_at
from public.members m
where not exists (
  select 1 from public.users u where u.cruel_id = m.username
);

update public.users u
set rating = m.rating,
    global_rank = m.global_rank,
    contests_attended = m.contests_attended,
    updated_at = greatest(u.updated_at, m.updated_at)
from public.members m
where u.cruel_id = m.username;

alter table public.users
  alter column cruel_id set not null,
  alter column cruel_date set not null;

create unique index users_cruel_id_key on public.users (cruel_id);

insert into public.user_identities (user_id, provider, username, is_primary)
select id, 'leetcode', cruel_id::text, true
from public.users
on conflict (provider, normalized_username) do nothing;

alter table public.member_scores add column user_id uuid;
update public.member_scores ms
set user_id = sm.user_id
from public.scoreboard_members sm
where sm.id = ms.member_id;
alter table public.member_scores
  drop constraint member_scores_pkey,
  drop constraint member_scores_member_id_fkey,
  alter column user_id set not null,
  add constraint member_scores_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade,
  add constraint member_scores_pkey primary key (snapshot_id, user_id),
  drop column member_id;

alter table public.scorebook_contest_results add column user_id uuid;
update public.scorebook_contest_results cr
set user_id = sm.user_id
from public.scoreboard_members sm
where sm.id = cr.member_id;
drop index if exists public.scorebook_contest_results_member_idx;
alter table public.scorebook_contest_results
  drop constraint scorebook_contest_results_pkey,
  drop constraint scorebook_contest_results_member_id_fkey,
  alter column user_id set not null,
  add constraint scorebook_contest_results_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade,
  add constraint scorebook_contest_results_pkey primary key (snapshot_id, user_id, contest_number),
  drop column member_id;
create index scorebook_contest_results_user_idx
  on public.scorebook_contest_results (user_id, contest_number desc);

alter table public.daily_checkins
  drop constraint daily_checkins_cruel_id_fkey,
  add constraint daily_checkins_cruel_id_fkey foreign key (cruel_id) references public.users(cruel_id) on delete cascade;

alter table public.daily_problem_status
  drop constraint daily_problem_status_cruel_id_fkey,
  add constraint daily_problem_status_cruel_id_fkey foreign key (cruel_id) references public.users(cruel_id) on delete cascade;

alter table public.contest_results add column user_id uuid;
update public.contest_results cr
set user_id = u.id
from public.users u
where u.cruel_id = cr.username;
alter table public.contest_results
  drop constraint contest_results_pkey,
  drop constraint contest_results_username_fkey,
  alter column user_id set not null,
  add constraint contest_results_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade,
  add constraint contest_results_pkey primary key (user_id, contest_title),
  drop column username;

create or replace function public.replace_scoreboard_snapshot(payload jsonb)
returns bigint
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  new_snapshot_id bigint;
  member jsonb;
  contest_result jsonb;
  resolved_user_id uuid;
begin
  if payload->>'combined_hash' !~ '^[0-9a-f]{64}$' then raise exception 'combined_hash must be a SHA-256 hex digest'; end if;
  if jsonb_typeof(payload->'members') <> 'array' or jsonb_array_length(payload->'members') = 0 then raise exception 'members must be a non-empty array'; end if;
  select id into new_snapshot_id from public.scoreboard_snapshots where combined_hash = payload->>'combined_hash';
  if new_snapshot_id is not null then return new_snapshot_id; end if;

  insert into public.scoreboard_snapshots (source_url, latest_contest, combined_hash, source_hashes, source_urls)
  values (payload->'source_urls'->>'index_xlsx', (payload->>'latest_contest')::integer, payload->>'combined_hash', payload->'source_hashes', payload->'source_urls')
  returning id into new_snapshot_id;

  for member in select value from jsonb_array_elements(payload->'members') loop
    resolved_user_id := (member->>'user_id')::uuid;
    insert into public.users (id, display_name, external_handle, status, cruel_id, cruel_date, subgroup, wechat_name, wechat_id, referral)
    values (resolved_user_id, coalesce(nullif(btrim(member->>'wechat_name'), ''), member->>'cruel_id'), member->>'cruel_id', 'active', member->>'cruel_id', (member->>'cruel_date')::date, member->>'subgroup', member->>'wechat_name', member->>'wechat_id', member->>'referral')
    on conflict (id) do update set cruel_id=excluded.cruel_id, cruel_date=excluded.cruel_date, subgroup=excluded.subgroup, wechat_name=excluded.wechat_name, wechat_id=excluded.wechat_id, referral=excluded.referral, external_handle=excluded.external_handle, status='active', updated_at=now();

    insert into public.user_identities (user_id, provider, username, is_primary)
    values (resolved_user_id, 'leetcode', member->>'cruel_id', true)
    on conflict (provider, normalized_username) do update set user_id=excluded.user_id, username=excluded.username, is_primary=true;

    insert into public.member_scores (snapshot_id, user_id, membership_days, rating, rolling_score, source_rank)
    values (new_snapshot_id, resolved_user_id, (member->>'days')::integer, nullif(member->>'rating','')::integer, (member->>'score')::numeric, (member->>'source_rank')::integer);

    for contest_result in select value from jsonb_array_elements(member->'contests') loop
      insert into public.contests (contest_number, participants) values ((contest_result->>'contest')::integer, (contest_result->>'participants')::integer)
      on conflict (contest_number) do update set participants=excluded.participants;
      insert into public.scorebook_contest_results (snapshot_id, user_id, contest_number, rank, score)
      values (new_snapshot_id, resolved_user_id, (contest_result->>'contest')::integer, nullif(contest_result->>'rank','')::integer, (contest_result->>'score')::numeric);
    end loop;
  end loop;
  return new_snapshot_id;
end;
$$;

create view public.current_scoreboard with (security_invoker = true) as
select u.id as user_id, u.cruel_id::text as cruel_id, u.cruel_date, u.subgroup, u.wechat_name, u.wechat_id, u.referral,
  ms.membership_days as days, ms.rating, ms.rolling_score::double precision as score,
  coalesce((select jsonb_agg(jsonb_build_object('contest',cr.contest_number,'participants',c.participants,'rank',cr.rank,'score',cr.score::double precision) order by cr.contest_number desc)
    from public.scorebook_contest_results cr join public.contests c on c.contest_number=cr.contest_number
    where cr.snapshot_id=ms.snapshot_id and cr.user_id=ms.user_id), '[]'::jsonb) as contests
from public.member_scores ms join public.users u on u.id=ms.user_id
where ms.snapshot_id=(select id from public.scoreboard_snapshots order by generated_at desc,id desc limit 1);

create view public.leaderboard with (security_invoker = true) as
select u.cruel_id::text as username, u.rating, u.global_rank, u.contests_attended,
  latest.contest_title as latest_contest, latest.ranking as latest_contest_rank,
  coalesce(stats.peak_rating, u.rating) as peak_rating
from public.users u
left join lateral (select cr.contest_title, cr.ranking from public.contest_results cr where cr.user_id=u.id order by cr.sequence desc limit 1) latest on true
left join lateral (select max(cr.rating) as peak_rating from public.contest_results cr where cr.user_id=u.id) stats on true;

create view public.active_users with (security_invoker = true) as
select u.id, u.display_name, u.real_name, u.email, u.company, u.school,
  u.cruel_id::text as leetcode_username, u.cruel_date as joined_at, u.subgroup,
  null::uuid as invited_by_user_id, u.referral as invited_by_text
from public.users u where u.status='active';

drop table public.scoreboard_members;
drop table public.members;

drop policy if exists "Public scoreboard users are readable" on public.users;
create policy "Public scoreboard users are readable" on public.users
  for select to anon, authenticated using (status='active');
grant select (id, display_name, cruel_id, cruel_date, subgroup, wechat_name, wechat_id, referral, status, rating, global_rank, contests_attended)
  on public.users to anon, authenticated;
grant select on public.current_scoreboard, public.leaderboard to anon, authenticated;
revoke all on public.active_users from anon, authenticated;
