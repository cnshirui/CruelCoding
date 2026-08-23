import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY before importing.");

const raw = JSON.parse(await readFile("lc-score-board/getRank/lc_profile_data.json", "utf8"));
const profiles = typeof raw === "string" ? JSON.parse(raw) : raw;
const members = [];
const results = [];

for (const [username, profile] of Object.entries(profiles)) {
  const current = profile?.userContestRanking;
  const history = profile?.userContestRankingHistory ?? [];
  if (!current) continue;
  members.push({ username, rating: current.rating ?? 0, global_rank: current.globalRanking ?? null, contests_attended: current.attendedContestsCount ?? history.length });
  history.forEach((item, sequence) => results.push({ username, contest_title: item.contest.title, rating: item.rating ?? 0, ranking: item.ranking || null, sequence }));
}

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
for (let start = 0; start < members.length; start += 500) {
  const users = members.slice(start, start + 500).map((member) => ({
    display_name: member.username,
    external_handle: member.username,
    cruel_id: member.username,
    cruel_date: new Date().toISOString().slice(0, 10),
    status: "active",
    rating: member.rating,
    global_rank: member.global_rank,
    contests_attended: member.contests_attended,
  }));
  const { error } = await supabase.from("users").upsert(users, { onConflict: "cruel_id" });
  if (error) throw error;
}
const userIds = new Map();
for (let start = 0; start < members.length; start += 500) {
  const usernames = members.slice(start, start + 500).map((member) => member.username);
  const { data, error } = await supabase.from("users").select("id,cruel_id").in("cruel_id", usernames);
  if (error) throw error;
  for (const user of data) userIds.set(user.cruel_id.toLowerCase(), user.id);
}
for (let start = 0; start < results.length; start += 500) {
  const rows = results.slice(start, start + 500).map(({ username, ...result }) => {
    const userId = userIds.get(username.toLowerCase());
    if (!userId) throw new Error(`No user found for ${username}`);
    return { user_id: userId, ...result };
  });
  const { error } = await supabase.from("contest_results").upsert(rows, { onConflict: "user_id,contest_title" });
  if (error) throw error;
}
console.log(`Imported ${members.length} members and ${results.length} contest results.`);
