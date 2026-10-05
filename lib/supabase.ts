import snapshot from "@/data/leaderboard.json";
import type { LeaderboardMember } from "@/lib/types";
import { createClient } from "@supabase/supabase-js";

type LeaderboardSource = "supabase" | "snapshot";
export type ContestDates = Record<number, string>;

const memberColumns = "user_id,cruel_id,cruel_date,exit_date,subgroup,days,rating,score,contests,wechat_name,wechat_id,referral,status";
const MEMBER_PAGE_SIZE = 500;

export async function getCommunityMembers(): Promise<{ members: LeaderboardMember[]; source: LeaderboardSource }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const members: LeaderboardMember[] = [];
    let fetchError: { message: string } | null = null;
    for (let start = 0; ; start += MEMBER_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("community_members")
        .select(memberColumns)
        .order("cruel_date", { ascending: true })
        .order("user_id", { ascending: true })
        .range(start, start + MEMBER_PAGE_SIZE - 1);
      if (error) { fetchError = error; break; }
      const page = (data ?? []) as LeaderboardMember[];
      members.push(...page);
      if (page.length < MEMBER_PAGE_SIZE) break;
    }
    if (!fetchError) return { members, source: "supabase" };
    console.error("Supabase community members unavailable; using bundled snapshot:", fetchError.message);
  }
  return { members: (snapshot as LeaderboardMember[]).map((member) => ({ ...member, status: "active" })), source: "snapshot" };
}

export async function getLeaderboard(): Promise<{ members: LeaderboardMember[]; source: LeaderboardSource; contestDates: ContestDates }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const [{ data, error }, { data: contests, error: contestsError }] = await Promise.all([
      supabase
        .from("current_scoreboard")
        .select("user_id,cruel_id,cruel_date,subgroup,days,rating,score,contests,wechat_name,wechat_id,referral"),
      supabase
        .from("contests")
        .select("contest_number,start_time")
        .not("contest_number", "is", null)
        .not("start_time", "is", null),
    ]);
    const contestDates = Object.fromEntries(
      (contests ?? []).map((contest) => [contest.contest_number, contest.start_time]),
    ) as ContestDates;
    if (!error && data?.length) {
      if (contestsError) console.error("Supabase contest dates unavailable:", contestsError.message);
      return { members: data as LeaderboardMember[], source: "supabase", contestDates };
    }
    if (error) console.error("Supabase leaderboard unavailable; using bundled snapshot:", error.message);
  }
  return { members: snapshot as LeaderboardMember[], source: "snapshot", contestDates: {} };
}

export async function getUserDetail(userId: string): Promise<LeaderboardMember | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase
      .from("community_members")
      .select(memberColumns)
      .eq("user_id", userId)
      .maybeSingle();
    if (!error && data) return data as LeaderboardMember;
    if (error) console.error("Supabase user detail unavailable; using bundled snapshot:", error.message);
  }
  return (snapshot as LeaderboardMember[]).find((member) => member.user_id === userId) ?? null;
}

export type RedPacket = {
  id: number;
  contest_id: number;
  member_name: string;
  user_id: string | null;
  amount_rmb: number;
  contest: { contest_number: number | null; title: string; start_time: string | null } | null;
};

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getRedPackets(): Promise<RedPacket[]> {
  const { data, error } = await publicClient()
    .from("red_packets")
    .select("id,contest_id,member_name,user_id,amount_rmb,contest:contests(contest_number,title,start_time)");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RedPacket[];
}
