"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Leaderboard } from "@/components/scoreboard";
import type { LeaderboardMember } from "@/lib/types";
import type { ContestDates } from "@/lib/supabase";
import type { DailyProblem } from "@/lib/daily-problems";

const groupRules = [
  ["每日打卡", "群主发布随机题号后，须在 24 小时内于 LeetCode 美服独立完成并提交，同时在群内发布完整代码截图。"],
  ["每周周赛", "请参加美西时间周六 19:30／北京时间周日 10:30 的 LeetCode 周赛，成绩按登记的美服 ID 获取。"],
  ["打卡查验", "查验时若此前连续两天的打卡题均未完成，须按规则发红包或退群。"],
  ["周赛红包", "每周按最近三次周赛中最好的两次计算残酷榜积分，群内末位 10% 须按规则发红包。"],
  ["红包发放", "使用普通红包，每份固定 1 元，份数等同发放时的群人数；份数或金额不符需全额重发。"],
  ["四题条款", "单场周赛完成四题，赛后次日至下周六可免受打卡查验；第二周美西周日上午恢复查验。"],
  ["竞赛公平", "周赛进行期间禁止讨论赛题解法（题意除外），并遵守 LeetCode 公平竞赛准则。"],
  ["邀请责任", "新人入群两周内主动或被动退群，介绍人须代缴一次红包。"],
  ["健康交流", "禁止无意义喊弱、吹捧、讥讽、贩卖焦虑，以及基于国籍、性别、年龄或工作地点的歧视。"],
  ["群聊质量", "每人每日群记录不超过 50 条；每日最多一条与算法学习无关的“气氛组”消息。"],
  ["再次入群", "退群后再次申请入群，须缴纳一次红包。"],
  ["迎大神条款", "新人首场周赛取得当轮或滚动积分前三名，推荐人须发红包鼓励群友。"],
  ["修改 ID", "报道后申请修改登记的 LeetCode ID，须按规则发红包。"],
  ["奇迹条款", "连续在群 2048 天终身免打卡；连续 4096 天终身免周赛。"],
  ["最终仲裁", "特殊情况及规则争议由群主进行解释与仲裁。"],
] as const;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DailyProblems({ problems = [] }: { problems?: DailyProblem[] }) {
  const [showAll, setShowAll] = useState(false);
  const today = localDateKey();
  const visible = useMemo(() => showAll ? problems : problems.slice(0, 30), [problems, showAll]);
  const todayProblem = problems.find((problem) => problem.date === today);
  const problemHref = (problem: DailyProblem) => problem.url ?? `https://leetcode.com/problemset/?search=${problem.number ?? encodeURIComponent(problem.title)}`;

  return (
    <div className="daily-problems">
      <section className="today-problem">
        <div><p className="eyebrow">TODAY · {today}</p><h3>{todayProblem ? `LeetCode ${todayProblem.number ?? ""}` : "今日题目尚未发布"}</h3></div>
        {todayProblem ? <div><Link href={`/checkins/${todayProblem.date}`}>{todayProblem.title} →</Link><p>{[todayProblem.level, ...todayProblem.tags].filter(Boolean).join(" · ")}</p></div> : <p>题目发布后会自动从群组 Google Sheet 同步到这里。</p>}
      </section>
      <div className="table-wrap daily-problem-table"><table>
        <thead><tr><th>日期</th><th>题号</th><th>题目</th><th>标签</th><th>难度</th><th>讲解</th></tr></thead>
        <tbody>{visible.map((problem) => <tr className={problem.date === today ? "today-row" : ""} key={`${problem.date}-${problem.number}-${problem.title}`}>
          <td><time dateTime={problem.date}>{problem.date}</time></td><td>{problem.number ?? "—"}</td>
          <td><Link href={`/checkins/${problem.date}`}>{problem.title}</Link> <a className="external-problem" href={problemHref(problem)} target="_blank" rel="noreferrer" aria-label="在 LeetCode 打开">↗</a></td>
          <td>{problem.tags.join(" · ") || "—"}</td><td><span className={`level ${(problem.level ?? "").toLowerCase()}`}>{problem.level ?? "—"}</span>{problem.difficulty ? <small>{problem.difficulty}</small> : null}</td>
          <td>{problem.youtube ? <a href={problem.youtube} target="_blank" rel="noreferrer">YouTube</a> : null}{problem.youtube && problem.bilibili ? " · " : null}{problem.bilibili ? <a href={problem.bilibili} target="_blank" rel="noreferrer">B站</a> : null}{!problem.youtube && !problem.bilibili ? "—" : null}</td>
        </tr>)}</tbody>
      </table>{!problems.length ? <p className="empty">暂时无法读取每日题目。</p> : null}</div>
      {!showAll && problems.length > 30 ? <button className="load-more" type="button" onClick={() => setShowAll(true)}>查看全部 {problems.length} 道题</button> : null}
    </div>
  );
}

export function GroupRules() {
  return (
    <div className="rules-layout">
      <aside className="rules-summary">
        <p className="eyebrow">EST. 2018.09.02</p>
        <h3>坚持，公平，尊重。</h3>
        <p>每日独立完成题目，每周认真参加竞赛，让讨论保持真诚且有价值。</p>
        <div className="rules-notice"><strong>新人须知</strong><span>进群后请 @群主登记 LeetCode ID，并在 24 小时内完成报道。</span></div>
        <Link href="/checkins">前往每日打卡 →</Link>
      </aside>
      <div className="rules-content">
        <div className="rules-meta"><span>群规正文</span><span>15 项</span></div>
        <ol className="rule-list">
          {groupRules.map(([title, description]) => (
            <li key={title}><div><strong>{title}</strong><p>{description}</p></div></li>
          ))}
        </ol>
        <section className="score-rules">
          <p className="eyebrow">CONTEST SCORING</p>
          <h3>周赛积分规则</h3>
          <p>缺席、零封或无正式成绩时单场得分为 0；其余情况按以下公式计算，满分 100，四舍五入保留一位小数。</p>
          <code>残酷分 = (1 − 名次 ÷ AC 人数) × 80 + 完成题数 × 5</code>
          <p>滚动积分取最近三场比赛中最好的两次残酷分计算平均值。新人前两场分别按一场、两场成绩计算。</p>
        </section>
        <p className="rules-footnote">页面内容整理自项目内现有群规；如与群主最新通知不一致，以群内通知为准。</p>
      </div>
    </div>
  );
}

export function HomeTabs({ members, contestDates, canRefresh = false }: { members: LeaderboardMember[]; contestDates: ContestDates; canRefresh?: boolean }) {
  return (
    <>
        <div>
          <Leaderboard members={members} contestDates={contestDates} canRefresh={canRefresh} />
        </div>
    </>
  );
}
