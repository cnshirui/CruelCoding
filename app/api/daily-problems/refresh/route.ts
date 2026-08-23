import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9-]+$/;
const QUERY = `query recentAcSubmissions($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) { id title titleSlug timestamp }
}`;

type Submission = { titleSlug: string; timestamp: string };

const CHECKIN_WINDOW_SECONDS = 48 * 60 * 60;

async function inspectMember(cruelId: string, slug: string) {
  try {
    const response = await fetch("https://leetcode.com/graphql/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "cruel-coding-checkin/1.0", Referer: "https://leetcode.com/" },
      body: JSON.stringify({ operationName: "recentAcSubmissions", query: QUERY, variables: { username: cruelId, limit: 100 } }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as { data?: { recentAcSubmissionList?: Submission[] }; errors?: unknown };
    if (payload.errors) throw new Error("LeetCode GraphQL error");
    const cutoff = Math.floor(Date.now() / 1000) - CHECKIN_WINDOW_SECONDS;
    const match = payload.data?.recentAcSubmissionList?.find((submission) =>
      submission.titleSlug === slug && Number(submission.timestamp) >= cutoff,
    );
    return { cruel_id: cruelId, solved: Boolean(match), submitted_at: match ? new Date(Number(match.timestamp) * 1000).toISOString() : null, check_error: null };
  } catch (error) {
    return { cruel_id: cruelId, solved: false, submitted_at: null, check_error: error instanceof Error ? error.message.slice(0, 200) : "Unknown error" };
  }
}

export async function POST(request: NextRequest) {
  const auth = await createSupabaseServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in first." }, { status: 401 });

  const body = await request.json() as { date?: string; number?: string; slug?: string };
  const date = body.date?.trim() ?? "";
  const number = body.number?.trim() ?? "";
  const slug = body.slug?.trim() ?? "";
  if (!DATE.test(date) || !number || !SLUG.test(slug)) return NextResponse.json({ error: "Invalid problem." }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return NextResponse.json({ error: "Supabase admin is not configured." }, { status: 503 });
  const database = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: members, error }, { data: completed, error: completedError }] = await Promise.all([
    database.from("current_scoreboard").select("cruel_id").order("cruel_id"),
    database.from("daily_problem_status").select("cruel_id").eq("problem_date", date).eq("problem_number", number).eq("solved", true),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  if (completedError) return NextResponse.json({ error: completedError.message }, { status: 503 });

  const completedIds = new Set((completed ?? []).map((item) => item.cruel_id.toLowerCase()));
  const pending = (members ?? []).filter((member) => !completedIds.has(member.cruel_id.toLowerCase()));
  const skipped = (members ?? []).length - pending.length;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const results: Awaited<ReturnType<typeof inspectMember>>[] = [];
      send({ type: "start", cruel_ids: pending.map((member) => member.cruel_id), skipped });
      try {
        for (let offset = 0; offset < pending.length; offset += 8) {
          const batch = pending.slice(offset, offset + 8);
          batch.forEach((member) => send({ type: "checking", cruel_id: member.cruel_id }));
          const inspected = await Promise.all(batch.map((member) => inspectMember(member.cruel_id, slug)));
          const rows = inspected.map((result) => ({ problem_date: date, problem_number: number, problem_slug: slug, checked_at: new Date().toISOString(), ...result }));
          const { error: upsertError } = await database.from("daily_problem_status").upsert(rows, { onConflict: "problem_date,problem_number,cruel_id" });
          if (upsertError) throw upsertError;
          results.push(...inspected);
          rows.forEach((status) => send({ type: "result", status }));
        }
        send({ type: "complete", checked: results.length, solved: results.filter((row) => row.solved).length, errors: results.filter((row) => row.check_error).length, skipped });
      } catch (streamError) {
        send({ type: "error", error: streamError instanceof Error ? streamError.message : "刷新失败" });
      } finally {
        controller.close();
      }
    },
  });
  return new NextResponse(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
