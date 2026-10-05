import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import { RedPocketsTable } from "@/components/red-pockets-table";
import { SiteTabs } from "@/components/site-tabs";
import { RedPocketZonePanel } from "@/components/red-pocket-zone";
import { redPocketState } from "@/lib/red-pocket-state";
import { isRedPocketAdmin } from "@/lib/red-pocket-admin";
import { getRedPocketZone, getRedPockets } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function RedPocketsPage() {
  const [pockets, zone, isAdmin] = await Promise.all([
    getRedPockets().catch((error) => {
      console.error("Supabase red pockets unavailable:", error);
      return [];
    }),
    getRedPocketZone().catch((error) => {
      console.error("Red pocket zone unavailable:", error);
      return null;
    }),
    isRedPocketAdmin(),
  ]);
  const statuses = Object.fromEntries(
    pockets.filter((pocket) => pocket.user_id && pocket.contest_id === zone?.contest.id).map((pocket) => [pocket.user_id, redPocketState(pocket)]),
  );
  const latestAmount = pockets.toSorted((a, b) => (b.contest?.start_time ?? "").localeCompare(a.contest?.start_time ?? ""))[0]?.amount_rmb ?? 111;

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
      <section className="content home-content space-y-5">
        <SiteTabs />
        <RedPocketZonePanel zone={zone} statuses={statuses} defaultAmount={latestAmount} isAdmin={isAdmin} />
        <RedPocketsTable pockets={pockets} isAdmin={isAdmin} />
      </section>
    </main>
  );
}
