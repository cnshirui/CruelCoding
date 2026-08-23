alter view public.community_members rename to community_members_base;

revoke all on public.community_members_base from public, anon, authenticated;

create view public.community_members as
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
  cm.contests
from public.community_members_base cm
left join public.current_scoreboard cs on cs.user_id = cm.user_id;

revoke all on public.community_members from public;
grant select on public.community_members to anon, authenticated;
