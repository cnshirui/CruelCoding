import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { isRedPocketAdmin } from "@/lib/red-pocket-admin";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = { contestId: number; userId: string | null; memberName: string; amount: number; paid?: boolean };

function isRow(value: unknown): value is Row {
  const row = value as Row;
  return Number.isInteger(row?.contestId)
    && (row.userId === null || (typeof row.userId === "string" && UUID.test(row.userId)))
    && typeof row.memberName === "string" && row.memberName.trim() !== ""
    && Number.isInteger(row.amount) && row.amount > 0
    && (row.paid === undefined || typeof row.paid === "boolean");
}

// Records who is in a contest's red-pocket zone. `paid` toggles the sent mark; leaving it out
// only makes sure the row exists, so saving the zone never clears a mark already set.
export async function POST(request: Request) {
  if (!(await isRedPocketAdmin())) return NextResponse.json({ error: "只有群主可以标记红包。" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const rows: unknown[] = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length || !rows.every(isRow)) return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return NextResponse.json({ error: "Supabase admin is not configured." }, { status: 503 });
  const database = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  for (const row of rows as Row[]) {
    const memberName = row.memberName.trim();
    const match = database.from("red_pockets").select("id").eq("contest_id", row.contestId);
    const { data: existing, error: findError } = await (row.userId
      ? match.or(`user_id.eq.${row.userId},member_name.eq."${memberName.replaceAll('"', '""')}"`)
      : match.eq("member_name", memberName)
    ).limit(1).maybeSingle();
    if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });

    const paid = row.paid === undefined ? {} : { paid_at: row.paid ? new Date().toISOString() : null };
    const { error } = existing
      ? await database.from("red_pockets").update({ user_id: row.userId, amount_rmb: row.amount, ...paid }).eq("id", existing.id)
      : await database.from("red_pockets").insert({ contest_id: row.contestId, user_id: row.userId, member_name: memberName, amount_rmb: row.amount, ...paid });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/red-pockets");
  return NextResponse.json({ ok: true });
}
