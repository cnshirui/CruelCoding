import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import { HomeTabs } from "@/components/home-tabs";
import { getLeaderboard } from "@/lib/supabase";
import { SiteTabs } from "@/components/site-tabs";

export const dynamic = "force-dynamic";

export default async function RanksPage() {
  const { members, contestDates } = await getLeaderboard();

  return (
    <main>
      <header className="home-header">
        <nav>
          <Link className="brand" href="/" aria-label="Cruel Coding 排行榜">
            <span className="brand-mark">C</span>
            <span>Cruel Coding</span>
          </Link>
          <AuthNav />
        </nav>
      </header>
      <section className="content home-content" id="top">
        <SiteTabs />
        <HomeTabs members={members} contestDates={contestDates} />
      </section>
    </main>
  );
}
