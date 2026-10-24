import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthNav } from "@/components/auth-nav";
import { SiteTabs } from "@/components/site-tabs";
import { AiSubnav } from "@/components/ai-subnav";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { addComment } from "@/app/ai-agents/actions";
import { courseTitle, getAiCheckin, getAiViewer } from "@/lib/ai-group";

export const metadata: Metadata = { title: "残酷AI群 · 打卡详情 · Cruel Coding" };
export const dynamic = "force-dynamic";

const formatTime = (value: string) => new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });

export default async function AiCheckinDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const checkinId = Number(id);
  if (!Number.isSafeInteger(checkinId) || checkinId <= 0) notFound();
  const [{ member }, detail] = await Promise.all([getAiViewer(), getAiCheckin(checkinId).catch(() => null)]);
  if (!detail) notFound();
  const { checkin, comments } = detail;

  return (
    <main>
      <header className="home-header">
        <nav>
          <Link className="brand" href="/" aria-label="返回 Cruel Coding 排行榜"><span className="brand-mark">C</span><span>Cruel Coding</span></Link>
          <div className="nav-header-actions"><Link className="nav-link" href="/ai-agents/checkins">← 打卡记录</Link><AuthNav /></div>
        </nav>
      </header>
      <section className="content home-content ai-page">
        <SiteTabs />
        <AiSubnav />
        <article className="ai-card ai-detail">
          <p className="eyebrow"><Link href={`/ai-agents/checkins?date=${checkin.checkin_date}`}>{checkin.checkin_date}</Link> · <Link href={`/ai-agents/checkins?course=${encodeURIComponent(checkin.course_code)}`}>{checkin.course_code}</Link></p>
          <h2>{courseTitle(checkin.course_code)}</h2>
          <p className="ai-detail-meta"><Link href={`/ai-agents/checkins?user=${checkin.user_id}`}>{checkin.display_name}</Link> · 更新于 {formatTime(checkin.updated_at)}</p>
          <div className="ai-note">{checkin.note}</div>
        </article>
        <section className="ai-card ai-comments">
          <div className="ai-card-head"><div><p className="eyebrow">COMMENTS</p><h3>{comments.length} 条评论</h3></div></div>
          {comments.length ? <ol>{comments.map((comment) => <li key={comment.id}><div><strong>{comment.display_name}</strong><time dateTime={comment.created_at}>{formatTime(comment.created_at)}</time></div><p>{comment.body}</p></li>)}</ol> : <p className="ai-empty">还没有评论。</p>}
          {member?.status === "approved"
            ? <ActionForm action={addComment} className="ai-comment-form"><input type="hidden" name="checkin_id" value={checkin.id} /><textarea name="body" rows={3} maxLength={1000} required placeholder="写下你的回复…" aria-label="评论内容" /><SubmitButton pendingLabel="发布中…">发布评论</SubmitButton></ActionForm>
            : <p className="ai-empty">加入残酷AI群后即可回复评论。<Link href="/ai-agents/checkins">去申请 →</Link></p>}
        </section>
      </section>
    </main>
  );
}
