export type ContestScore = { contest: number; participants: number; rank: number | null; score: number };

export type LeaderboardMember = {
  user_id: string;
  cruel_id: string;
  cruel_date: string;
  exit_date?: string | null;
  subgroup: string | null;
  days: number;
  rating: number | null;
  score: number;
  contests: ContestScore[];
  wechat_name: string | null;
  wechat_id: string | null;
  referral: string | null;
  status?: "active" | "inactive";
};
