import { CheckinsTable } from "@/components/checkins-table";
import { getDailyProblems } from "@/lib/daily-problems";
import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import { SiteTabs } from "@/components/site-tabs";

export const dynamic = "force-dynamic";

export default async function CheckinsPage() {
  const problems = await getDailyProblems().catch(() => []);

  return (
    <main>
      <header className="home-header">
        <nav>
          <Link className="brand" href="/" aria-label="返回 Cruel Coding 排行榜">
            <span className="brand-mark">C</span>
            <span>Cruel Coding</span>
          </Link>
          <div className="nav-header-actions">
            <Link className="nav-link" href="/">← 返回排行榜</Link>
            <AuthNav />
          </div>
        </nav>
      </header>
      <section className="content home-content checkins-page">
        <SiteTabs />
        <CheckinsTable problems={problems} />
      </section>
    </main>
  );
}
