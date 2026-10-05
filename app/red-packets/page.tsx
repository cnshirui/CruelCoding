import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import { RedPacketsTable } from "@/components/red-packets-table";
import { SiteTabs } from "@/components/site-tabs";
import { RedPacketZonePanel } from "@/components/red-packet-zone";
import { isRedPacketAdmin } from "@/lib/red-packet-admin";
import { getRedPacketZone, getRedPackets } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function RedPacketsPage() {
  const [packets, zone, isAdmin] = await Promise.all([
    getRedPackets().catch((error) => {
      console.error("Supabase red packets unavailable:", error);
      return [];
    }),
    getRedPacketZone().catch((error) => {
      console.error("Red packet zone unavailable:", error);
      return null;
    }),
    isRedPacketAdmin(),
  ]);
  const latestAmount = packets.toSorted((a, b) => (b.contest?.start_time ?? "").localeCompare(a.contest?.start_time ?? ""))[0]?.amount_rmb ?? 111;

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
        <RedPacketZonePanel zone={zone} defaultAmount={latestAmount} isAdmin={isAdmin} />
        <RedPacketsTable packets={packets} isAdmin={isAdmin} />
      </section>
    </main>
  );
}
