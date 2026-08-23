import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import { GroupRules } from "@/components/home-tabs";
import { SiteTabs } from "@/components/site-tabs";

export default function RulesPage() {
  return (
    <main>
      <header className="home-header">
        <nav>
          <Link className="brand" href="/"><span className="brand-mark">C</span><span>Cruel Coding</span></Link>
          <AuthNav />
        </nav>
      </header>
      <section className="content home-content">
        <SiteTabs />
        <GroupRules />
      </section>
    </main>
  );
}
