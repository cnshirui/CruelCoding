import { NextResponse } from "next/server";
import { getCommunityMembers } from "@/lib/supabase";

export async function GET() {
  try {
    const result = await getCommunityMembers();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "无法刷新群友数据。" }, { status: 500 });
  }
}
