alter table public.scoreboard_members
  add column if not exists user_id uuid,
  add column if not exists wechat_name text,
  add column if not exists wechat_id text,
  add column if not exists referral text;

create unique index if not exists scoreboard_members_user_id_unique
  on public.scoreboard_members (user_id) where user_id is not null;

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
  resolved_member_id bigint;
begin
  if payload->>'combined_hash' !~ '^[0-9a-f]{64}$' then raise exception 'combined_hash must be a SHA-256 hex digest'; end if;
  if jsonb_typeof(payload->'members') <> 'array' or jsonb_array_length(payload->'members') = 0 then raise exception 'members must be a non-empty array'; end if;
  select id into new_snapshot_id from public.scoreboard_snapshots where combined_hash = payload->>'combined_hash';
  if new_snapshot_id is not null then return new_snapshot_id; end if;

  insert into public.scoreboard_snapshots (source_url, latest_contest, combined_hash, source_hashes, source_urls)
  values (payload->'source_urls'->>'index_xlsx', (payload->>'latest_contest')::integer, payload->>'combined_hash', payload->'source_hashes', payload->'source_urls')
  returning id into new_snapshot_id;

  for member in select value from jsonb_array_elements(payload->'members') loop
    insert into public.scoreboard_members (user_id, cruel_id, cruel_date, subgroup, wechat_name, wechat_id, referral)
    values ((member->>'user_id')::uuid, member->>'cruel_id', (member->>'cruel_date')::date, member->>'subgroup', member->>'wechat_name', member->>'wechat_id', member->>'referral')
    on conflict (cruel_id) do update set user_id=excluded.user_id, cruel_date=excluded.cruel_date, subgroup=excluded.subgroup, wechat_name=excluded.wechat_name, wechat_id=excluded.wechat_id, referral=excluded.referral
    returning id into resolved_member_id;

    insert into public.member_scores (snapshot_id, member_id, membership_days, rating, rolling_score, source_rank)
    values (new_snapshot_id, resolved_member_id, (member->>'days')::integer, nullif(member->>'rating','')::integer, (member->>'score')::numeric, (member->>'source_rank')::integer);

    for contest_result in select value from jsonb_array_elements(member->'contests') loop
      insert into public.contests (contest_number, participants) values ((contest_result->>'contest')::integer, (contest_result->>'participants')::integer)
      on conflict (contest_number) do update set participants=excluded.participants;
      insert into public.scorebook_contest_results (snapshot_id, member_id, contest_number, rank, score)
      values (new_snapshot_id, resolved_member_id, (contest_result->>'contest')::integer, nullif(contest_result->>'rank','')::integer, (contest_result->>'score')::numeric);
    end loop;
  end loop;
  return new_snapshot_id;
end;
$$;

revoke all on function public.replace_scoreboard_snapshot(jsonb) from public, anon, authenticated;
grant execute on function public.replace_scoreboard_snapshot(jsonb) to service_role;

drop view if exists public.current_scoreboard;

create or replace view public.current_scoreboard with (security_invoker = true) as
select sm.user_id, sm.cruel_id::text as cruel_id, sm.cruel_date, sm.subgroup, sm.wechat_name, sm.wechat_id, sm.referral,
  ms.membership_days as days, ms.rating, ms.rolling_score::double precision as score,
  coalesce((select jsonb_agg(jsonb_build_object('contest',cr.contest_number,'participants',c.participants,'rank',cr.rank,'score',cr.score::double precision) order by cr.contest_number desc)
    from public.scorebook_contest_results cr join public.contests c on c.contest_number=cr.contest_number
    where cr.snapshot_id=ms.snapshot_id and cr.member_id=ms.member_id), '[]'::jsonb) as contests
from public.member_scores ms join public.scoreboard_members sm on sm.id=ms.member_id
where ms.snapshot_id=(select id from public.scoreboard_snapshots order by generated_at desc,id desc limit 1);

revoke all on table public.current_scoreboard from anon, authenticated;
grant select on table public.current_scoreboard to anon, authenticated;
