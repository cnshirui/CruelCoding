-- Who landed in the weekly-contest red-packet zone. Names are kept as written in the group
-- chat because WeChat nicknames often differ from the registered display name; user_id is
-- filled in only when the name maps to exactly one member.
create table public.red_packets (
  id bigint generated always as identity primary key,
  contest_id bigint not null references public.contests (id),
  member_name text not null check (btrim(member_name) <> ''),
  user_id uuid references public.users (id) on delete set null,
  amount_rmb integer not null check (amount_rmb > 0),
  created_at timestamptz not null default now(),
  unique (contest_id, member_name)
);

create index red_packets_user_id_idx on public.red_packets (user_id);

alter table public.red_packets enable row level security;
create policy "Red packets are public" on public.red_packets for select using (true);
revoke all on table public.red_packets from anon, authenticated;
grant select on table public.red_packets to anon, authenticated;

insert into public.red_packets (contest_id, member_name, amount_rmb)
select c.id, v.member_name, v.amount_rmb
from (values
  (522, '小韭菜菜子', 111), (522, '09252024', 111), (522, 'kaze', 111), (522, '年前拿offer', 111),
  (522, '氧气', 111), (522, '看山还是水', 111), (522, 'wisdompool', 111), (522, '灵茶捌艾府🎈', 111),
  (522, 'gosh', 111), (522, '钟毛线w', 111), (522, 'Hanyuan', 111),
  (521, 'Williammmm', 110), (521, 'kaze', 110), (521, '年前拿offer', 110), (521, 'Toddyyyyyy', 110),
  (521, 'Sloth', 110), (521, 'wisdompool', 110), (521, '钟毛线w', 110), (521, 'Hanyuan', 110),
  (521, 'Tyler', 110), (521, '看山还是水', 110),
  (520, 'Williammmm', 111), (520, 'kaze', 111), (520, '年前拿offer', 111), (520, '氧气', 111),
  (520, '看山还是水', 111), (520, 'wisdompool', 111), (520, '钟毛线w', 111),
  (520, '中羊肖恩🎈🎈🎈🎈', 111), (520, 'ocavue', 111)
) as v (contest_number, member_name, amount_rmb)
join public.contests c on c.contest_number = v.contest_number;

-- Link names that match exactly one non-merged member by nickname, CruelID or LeetCode account.
with candidates as (
  select distinct rp.member_name, u.id as user_id
  from public.red_packets rp
  join public.users u on u.status <> 'merged'
  left join public.user_identities i on i.user_id = u.id
  where lower(rp.member_name) in (lower(u.display_name), lower(u.wechat_name), lower(u.cruel_id), i.normalized_username)
), unique_matches as (
  select member_name, min(user_id::text)::uuid as user_id
  from candidates
  group by member_name
  having count(*) = 1
)
update public.red_packets rp
set user_id = m.user_id
from unique_matches m
where m.member_name = rp.member_name;
