create or replace view public.community_members as
select
  cm.user_id,
  cm.cruel_id,
  cm.cruel_date,
  cm.subgroup,
  cm.wechat_name,
  cm.wechat_id,
  cm.referral,
  case when cs.user_id is not null then 'active' else 'inactive' end as status,
  cm.days,
  cm.rating,
  cm.score,
  cm.contests,
  case
    when cs.user_id is null then (
      select max(m.left_at)
      from public.memberships m
      where m.user_id = cm.user_id
        and m.left_at is not null
    )
    else null
  end as exit_date
from public.community_members_base cm
left join public.current_scoreboard cs on cs.user_id = cm.user_id;

revoke all on public.community_members from public;
grant select on public.community_members to anon, authenticated;
