import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { getSession } from "@/lib/auth";
import { AuthNav } from "@/components/auth-nav";
import { SiteTabs } from "@/components/site-tabs";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getSession().catch(() => null);
  if (!user) redirect("/login?error=Log%20in%20to%20view%20your%20account.");

  return <main className="account-page">
    <nav className="profile-nav"><Link className="brand" href="/"><span className="brand-mark">C</span><span>Cruel Coding</span></Link><div className="nav-header-actions"><Link className="nav-link" href="/">← Leaderboard</Link><AuthNav /></div></nav>
    <section className="account-card">
      <SiteTabs />
      <p className="eyebrow">YOUR ACCOUNT</p><h1>Signed in.</h1>
      <dl><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>User ID</dt><dd>{user.id}</dd></div><div><dt>Name</dt><dd>{user.name}</dd></div></dl>
      <form action={logout}><button className="primary-button" type="submit">Log out</button></form>
    </section>
  </main>;
}
