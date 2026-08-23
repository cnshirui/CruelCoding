import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import { UsersDirectory } from "@/components/users-directory";
import { getCommunityMembers } from "@/lib/supabase";
import { SiteTabs } from "@/components/site-tabs";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const { members } = await getCommunityMembers();

  return (
    <main className="users-page">
      <header className="home-header">
        <nav>
          <Link className="brand" href="/" aria-label="返回 Cruel Coding 排行榜">
            <span className="brand-mark">C</span>
            <span>Cruel Coding</span>
          </Link>
          <div className="nav-header-actions">
            <Link className="nav-link" href="/">排行榜</Link>
            <AuthNav />
          </div>
        </nav>
      </header>

      <section className="content home-content users-content">
        <SiteTabs />
        <UsersDirectory members={members} />
      </section>
    </main>
  );
}
