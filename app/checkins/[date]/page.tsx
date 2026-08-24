import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getDailyProblems } from "@/lib/daily-problems";
import { getLeaderboard } from "@/lib/supabase";
import { ProblemCheckinRefresh, type ProblemCheckinStatus } from "@/components/problem-checkin-refresh";
import { AuthNav } from "@/components/auth-nav";
import { SiteTabs } from "@/components/site-tabs";

export const dynamic = "force-dynamic";

export default async function DailyProblemPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const [problems, { members }] = await Promise.all([getDailyProblems(), getLeaderboard()]);
  const problem = problems.find((item) => item.date === date);
  if (!problem) notFound();

  let statuses: ProblemCheckinStatus[] = [];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url && key && problem.number) {
    const database = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await database.from("daily_problem_status").select("cruel_id,solved,submitted_at,checked_at,check_error").eq("problem_date", date).eq("problem_number", problem.number);
    statuses = (data ?? []) as ProblemCheckinStatus[];
  }
  const byMember = new Map(statuses.map((status) => [status.cruel_id.toLowerCase(), status]));
  const rows = members.filter((member) => member.status !== "inactive").map((member) => ({ member, status: byMember.get(member.cruel_id.toLowerCase()) })).sort((a, b) => Number(Boolean(b.status?.solved)) - Number(Boolean(a.status?.solved)) || a.member.cruel_id.localeCompare(b.member.cruel_id));
  const solved = rows.filter((row) => row.status?.solved).length;
  return <main>
    <header className="subpage-header"><nav><Link className="brand" href="/"><span className="brand-mark">C</span><span>Cruel Coding</span></Link><div className="nav-header-actions"><Link className="nav-link" href="/checkins">← 每日题目</Link><AuthNav /></div></nav></header>
    <section className="content problem-status-page">
      <SiteTabs />
      <div className="problem-status-heading"><div><p className="eyebrow">GROUP CHECK-IN</p><h2>{solved} / {rows.length} 已完成</h2><p>最近 48 小时内 AC 该题即视为完成；“未发现”不等同于确定未完成。</p></div></div>
      {problem.number && problem.slug ? <ProblemCheckinRefresh date={date} number={problem.number} slug={problem.slug} initialRows={rows} /> : null}
    </section>
  </main>;
}
