import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { refreshLeaderboard } from "@/lib/leaderboard-refresh";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Log in to refresh the leaderboard." }, { status: 401 });
    if (user.app_metadata?.role !== "admin") return NextResponse.json({ error: "Admin access is required." }, { status: 403 });

    const result = await refreshLeaderboard();
    revalidatePath("/ranks");
    revalidatePath("/");
    return NextResponse.json({ ...result, message: result.changed
      ? `Leaderboard updated; ${result.contestCount} LeetCode contest times synced.`
      : `Leaderboard is current; ${result.contestCount} LeetCode contest times synced.` });
  } catch (error) {
    console.error("Leaderboard refresh failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Leaderboard refresh failed." }, { status: 500 });
  }
}
