import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import { HomeTabs } from "@/components/home-tabs";
import { getLeaderboard } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SiteTabs } from "@/components/site-tabs";

export const dynamic = "force-dynamic";

// Refreshing is open to every signed-in member, so the button only needs to know that much.
async function isSignedIn() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    return Boolean(data?.claims?.sub);
  } catch {
    return false;
  }
}

export default async function RanksPage() {
  const { members, contestDates } = await getLeaderboard();
  const canRefresh = await isSignedIn();

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
        <HomeTabs members={members} contestDates={contestDates} canRefresh={canRefresh} />
      </section>
    </main>
  );
}
