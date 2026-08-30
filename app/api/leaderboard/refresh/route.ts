import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { refreshLeaderboard } from "@/lib/leaderboard-refresh";

export const runtime = "nodejs";
export const maxDuration = 60;

// Any signed-in member may refresh, but the slot is global: one refresh per minute for
// everyone, because each run re-downloads four WisdomPeak files plus the LeetCode history.
const COOLDOWN_SECONDS = 60;

type Claim = { claimed: boolean; refreshed_at: string; previous_refreshed_at?: string | null };

function secondsUntilFree(refreshedAt: string) {
  const elapsed = Math.floor((Date.now() - Date.parse(refreshedAt)) / 1_000);
  return Math.max(1, COOLDOWN_SECONDS - elapsed);
}

export async function POST() {
  try {
    const auth = await createSupabaseServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "登录后才能刷新排行榜。" }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!url || !secret) return NextResponse.json({ error: "Supabase admin is not configured." }, { status: 503 });
    const database = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data, error: claimError } = await database.rpc("claim_leaderboard_refresh", { cooldown_seconds: COOLDOWN_SECONDS, actor: user.id });
    if (claimError) return NextResponse.json({ error: claimError.message }, { status: 503 });
    const claim = data as Claim;
    if (!claim.claimed) {
      const retryAfter = secondsUntilFree(claim.refreshed_at);
      return NextResponse.json(
        { error: `排行榜刚刚已刷新，请 ${retryAfter} 秒后再试。`, retryAfter, lastRefreshedAt: claim.refreshed_at },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    try {
      const result = await refreshLeaderboard();
      revalidatePath("/ranks");
      revalidatePath("/");
      return NextResponse.json({ ...result, retryAfter: COOLDOWN_SECONDS, message: result.changed
        ? `Leaderboard updated; ${result.contestCount} LeetCode contest times synced.`
        : "WisdomPeak sources are unchanged; nothing was imported." });
    } catch (refreshError) {
      await database.rpc("release_leaderboard_refresh", { previous_refreshed_at: claim.previous_refreshed_at ?? null });
      throw refreshError;
    }
  } catch (error) {
    console.error("Leaderboard refresh failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Leaderboard refresh failed." }, { status: 500 });
  }
}
