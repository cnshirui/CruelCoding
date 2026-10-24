import type { Metadata } from "next";
import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import { SiteTabs } from "@/components/site-tabs";
import { AiSubnav } from "@/components/ai-subnav";
import { AiMembersTable } from "@/components/ai-members-table";
import { isRedPocketAdmin } from "@/lib/red-pocket-admin";
import { beijingDateKey, getAiStats } from "@/lib/ai-group";

export const metadata: Metadata = { title: "残酷AI群 · 打卡统计 · Cruel Coding" };
export const dynamic = "force-dynamic";

export default async function AiStatsPage() {
  const [rows, isAdmin] = await Promise.all([getAiStats().catch(() => []), isRedPocketAdmin()]);
  const today = beijingDateKey();
  const days = Array.from({ length: 7 }, (_, index) => beijingDateKey(-6 + index));
  const approved = rows.filter((row) => row.status === "approved");
  const todayDone = approved.filter((row) => row.last7[6]).length;
  const pending = rows.filter((row) => row.status === "pending").length;

  return (
    <main>
      <header className="home-header">
        <nav>
          <Link className="brand" href="/" aria-label="返回 Cruel Coding 排行榜"><span className="brand-mark">C</span><span>Cruel Coding</span></Link>
          <div className="nav-header-actions"><Link className="nav-link" href="/ai-agents/checkins">← 每日打卡</Link><AuthNav /></div>
        </nav>
      </header>
      <section className="content home-content ai-page">
        <SiteTabs />
        <AiSubnav />
        <div className="ai-stats">
          <div><p className="eyebrow">TODAY · {today}</p><strong>{todayDone} / {approved.length}</strong><span>今日已打卡 / 群成员</span></div>
          <div><p className="eyebrow">OWED</p><strong>{approved.length - todayDone}</strong><span>今日尚未打卡（每人 5 元）</span></div>
          <div><p className="eyebrow">PENDING</p><strong>{pending}</strong><span>待批准申请{isAdmin ? "，可在下表审核" : ""}</span></div>
          <div><p className="eyebrow">TOTAL</p><strong>{approved.reduce((sum, row) => sum + row.total, 0)}</strong><span>累计打卡天数</span></div>
        </div>
        <AiMembersTable rows={rows} days={days} isAdmin={isAdmin} />
        <p className="rules-footnote">“今日”按北京时间计算；连续天数允许今天尚未打卡时从昨天起算。点击成员名可查看其全部打卡。</p>
      </section>
    </main>
  );
}
