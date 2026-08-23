import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserDetail } from "@/lib/supabase";
import { AuthNav } from "@/components/auth-nav";
import { SiteTabs } from "@/components/site-tabs";

export const revalidate = 300;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const member = await getUserDetail(id);
  if (!member) notFound();
  const recentContests = member.contests.slice(0, 10);

  return (
    <main className="profile-page">
      <nav className="profile-nav">
        <Link className="brand" href="/"><span className="brand-mark">C</span><span>Cruel Coding</span></Link>
        <div className="nav-header-actions"><Link className="nav-link" href="/">← Leaderboard</Link><AuthNav /></div>
      </nav>

      <section className="profile-hero">
        <div className="profile-avatar">{member.cruel_id.slice(0, 2).toUpperCase()}</div>
        <div>
          <p className="eyebrow">MEMBER PROFILE · {member.subgroup ? `GROUP ${member.subgroup}` : "CRUEL CODING"}</p>
          <h1>{member.cruel_id}</h1>
          <a className="leetcode-link" href={`https://leetcode.com/u/${encodeURIComponent(member.cruel_id)}`} target="_blank" rel="noreferrer">Open LeetCode profile ↗</a>
        </div>
      </section>

      <section className="profile-content">
        <SiteTabs />
        <div className="profile-grid">
          <article className="profile-card"><span>WeChat ID</span><strong>{member.wechat_id ?? "Not provided"}</strong></article>
          <article className="profile-card"><span>WeChat name</span><strong>{member.wechat_name ?? "Not provided"}</strong></article>
          <article className="profile-card"><span>Joined group</span><strong>{member.cruel_date}</strong></article>
          <article className="profile-card"><span>Referral</span><strong>{member.referral ?? "Not recorded"}</strong></article>
        </div>

        <div className="profile-section">
          <div className="section-heading"><div><p className="eyebrow">LEETCODE</p><h2>Performance</h2></div></div>
          <div className="profile-metrics">
            <div><strong>{member.rating && member.rating > 0 ? member.rating.toLocaleString() : "—"}</strong><span>Rating</span></div>
            <div><strong>{member.score.toFixed(1)}</strong><span>Score</span></div>
            <div><strong>{member.days.toLocaleString()}</strong><span>Member days</span></div>
          </div>
        </div>

        <div className="profile-section">
          <div className="section-heading"><div><p className="eyebrow">RECENT HISTORY</p><h2>Contests</h2></div></div>
          <div className="table-wrap profile-table"><table><thead><tr><th>Contest</th><th>Rank</th><th>Participants</th><th>Score</th></tr></thead><tbody>
            {recentContests.map((contest) => <tr key={contest.contest}><td>Weekly {contest.contest}</td><td>{contest.rank ? `#${contest.rank.toLocaleString()}` : "—"}</td><td>{contest.participants.toLocaleString()}</td><td><strong>{contest.score.toFixed(1)}</strong></td></tr>)}
          </tbody></table></div>
        </div>
      </section>
    </main>
  );
}
