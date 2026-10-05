import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import { RedPacketsTable } from "@/components/red-packets-table";
import { SiteTabs } from "@/components/site-tabs";
import { getRedPackets } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function RedPacketsPage() {
  const packets = await getRedPackets().catch((error) => {
    console.error("Supabase red packets unavailable:", error);
    return [];
  });

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
      <section className="content home-content">
        <SiteTabs />
        <RedPacketsTable packets={packets} />
      </section>
    </main>
  );
}
