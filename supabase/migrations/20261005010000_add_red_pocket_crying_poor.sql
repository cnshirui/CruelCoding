-- 哭穷: the member pleaded poverty instead of sending. It is not a payment, so it never
-- earns the two-week exemption in red_pocket_candidates.
alter table public.red_pockets
  add column crying_poor boolean not null default false;
