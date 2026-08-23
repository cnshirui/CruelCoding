create or replace view public.community_members as
select
  u.id as user_id,
  u.cruel_id::text as cruel_id,
  coalesce(min(m.joined_at), u.cruel_date) as cruel_date,
  (array_agg(m.subgroup order by m.joined_at desc nulls last) filter (where m.subgroup is not null))[1] as subgroup,
  u.display_name as wechat_name,
  null::text as wechat_id,
  coalesce((array_agg(m.invited_by_text order by m.joined_at desc nulls last) filter (where m.invited_by_text is not null))[1], u.referral) as referral,
  u.status::text as status,
  case
    when bool_or(m.left_at is null) then current_date - coalesce(min(m.joined_at), u.cruel_date)
    else coalesce(sum(m.left_at - m.joined_at), 0)::integer
  end as days,
  coalesce(ms.rating, u.rating, 0)::double precision as rating,
  coalesce(ms.rolling_score, 0)::double precision as score,
  coalesce(
    (select jsonb_agg(jsonb_build_object(
      'contest', cr.contest_number,
      'participants', c.participants,
      'rank', cr.rank,
      'score', cr.score::double precision
    ) order by cr.contest_number desc)
    from public.scorebook_contest_results cr
    join public.contests c on c.contest_number = cr.contest_number
    where cr.snapshot_id = ms.snapshot_id and cr.user_id = u.id),
    '[]'::jsonb
  ) as contests
from public.users u
left join public.memberships m on m.user_id = u.id
left join public.member_scores ms
  on ms.user_id = u.id
  and ms.snapshot_id = (select id from public.scoreboard_snapshots order by generated_at desc, id desc limit 1)
where u.status <> 'merged'
group by u.id, ms.snapshot_id, ms.rating, ms.rolling_score;

revoke all on public.community_members from public;
grant select on public.community_members to anon, authenticated;
