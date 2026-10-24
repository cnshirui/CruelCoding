import type { Metadata } from "next";
import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import { SiteTabs } from "@/components/site-tabs";
import { AiSubnav } from "@/components/ai-subnav";
import { AiCheckinForm } from "@/components/ai-checkin-form";
import { AiCheckinsTable } from "@/components/ai-checkins-table";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { applyToJoin } from "@/app/ai-agents/actions";
import { beijingDateKey, courseOptions, courseTitle, getAiCheckins, getAiMembers, getAiViewer, type AiCheckinFilters } from "@/lib/ai-group";

export const metadata: Metadata = { title: "残酷AI群 · 每日打卡 · Cruel Coding" };
export const dynamic = "force-dynamic";

function Gate({ status, name }: { status: "none" | "pending" | "rejected"; name: string }) {
  if (status === "pending") return <div className="ai-gate"><p className="eyebrow">APPLICATION PENDING</p><h3>{name}，申请已提交</h3><p>管理员批准后即可打卡。你仍然可以浏览大家的打卡记录。</p></div>;
  if (status === "rejected") return <div className="ai-gate"><p className="eyebrow">NOT APPROVED</p><h3>申请未通过</h3><p>如有疑问请在群内联系群主。</p></div>;
  return <div className="ai-gate"><p className="eyebrow">JOIN 残酷AI群</p><h3>申请加入，开始每日打卡</h3><p>以当前登录账号「{name}」申请，管理员批准后即可打卡、评论。</p><ActionForm action={applyToJoin}><SubmitButton pendingLabel="提交中…">申请加入</SubmitButton></ActionForm></div>;
}

export default async function AiCheckinsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const pick = (key: string) => { const value = params[key]; return typeof value === "string" && value ? value : undefined; };
  const filters: AiCheckinFilters = { course: pick("course"), date: pick("date"), user: pick("user") };
  const [{ user, member }, members, rows] = await Promise.all([getAiViewer(), getAiMembers().catch(() => []), getAiCheckins(filters).catch(() => [])]);
  const today = beijingDateKey();
  const name = member?.display_name ?? user?.email?.split("@")[0] ?? "成员";
  const todayCount = rows.filter((row) => row.checkin_date === today).length;
  const filterLabel = [filters.course ? `课程 ${filters.course} · ${courseTitle(filters.course)}` : null, filters.date ? `日期 ${filters.date}` : null, filters.user ? `成员 ${members.find((m) => m.user_id === filters.user)?.display_name ?? "未知"}` : null].filter(Boolean).join(" / ");

  return (
    <main>
      <header className="home-header">
        <nav>
          <Link className="brand" href="/" aria-label="返回 Cruel Coding 排行榜"><span className="brand-mark">C</span><span>Cruel Coding</span></Link>
          <div className="nav-header-actions"><Link className="nav-link" href="/ai-agents">← 课程列表</Link><AuthNav /></div>
        </nav>
      </header>
      <section className="content home-content ai-page">
        <SiteTabs />
        <AiSubnav />
        <div className="ai-checkin-layout">
          <section className="ai-card">
            <div className="ai-card-head"><div><p className="eyebrow">TODAY · {today}</p><h3>每日打卡</h3></div><p>选择日期和课程，写下不少于 50 字的读书笔记；同一天再次提交会覆盖之前的内容。</p></div>
            {member?.status === "approved" ? <AiCheckinForm today={today} courses={courseOptions} /> : <Gate status={member?.status === "pending" ? "pending" : member?.status === "rejected" ? "rejected" : "none"} name={name} />}
          </section>
          <aside className="ai-card ai-side">
            <p className="eyebrow">群规</p>
            <h3>每天 50 字，或者每人 5 元。</h3>
            <dl><div><dt>今日已打卡</dt><dd>{filters.date || filters.course || filters.user ? "—" : todayCount}</dd></div><div><dt>群成员</dt><dd>{members.filter((m) => m.status === "approved").length}</dd></div></dl>
            <Link href="/ai-agents/stats">查看打卡统计 →</Link>
          </aside>
        </div>
        <div className="section-heading ai-records-heading"><div><p className="eyebrow">RECORDS</p><h2>{filterLabel || "全部打卡"}</h2></div></div>
        <AiCheckinsTable rows={rows} members={members} courses={courseOptions} filters={filters} />
      </section>
    </main>
  );
}
