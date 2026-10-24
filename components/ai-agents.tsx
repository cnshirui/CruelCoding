import Link from "next/link";
import { agentCourses, aiGroupRules, type AgentCourse } from "@/lib/ai-agent-courses";

const schools = ["Stanford", "Harvard", "CMU"] as const;

function CourseCard({ course }: { course: AgentCourse }) {
  return (
    <li className="course-card" id={course.code.replace(/\s+/g, "-").toLowerCase()}>
      <div className="course-head">
        <div><span className="course-code">{course.code}</span><h4><a href={course.url} target="_blank" rel="noreferrer">{course.title} ↗</a></h4></div>
        <span className="course-term">{course.term}</span>
      </div>
      <p className="course-summary">{course.summary}</p>
      <dl className="course-facts">
        <dt>授课</dt><dd>{course.instructors.join("、")}{course.staff ? `；${course.staff.join("、")}` : null}</dd>
        {course.meeting ? <><dt>时间地点</dt><dd>{course.meeting}</dd></> : null}
        {course.units ? <><dt>学分</dt><dd>{course.units}</dd></> : null}
        {course.prereqs ? <><dt>先修</dt><dd>{course.prereqs}</dd></> : null}
        {course.grading ? <><dt>评分</dt><dd>{course.grading.join(" · ")}</dd></> : null}
        {course.assignments ? <><dt>作业</dt><dd><ul>{course.assignments.map((item) => <li key={item}>{item}</li>)}</ul></dd></> : null}
        {course.project ? <><dt>项目</dt><dd>{course.project}</dd></> : null}
        {course.links ? <><dt>链接</dt><dd className="course-links">{course.links.map(([label, href]) => <a href={href} target="_blank" rel="noreferrer" key={href}>{label}</a>)}</dd></> : null}
      </dl>
      {course.schedule ? (
        <details className="course-schedule">
          <summary>课程安排 · {course.schedule.length} 条</summary>
          <table><tbody>{course.schedule.map(([date, topic]) => <tr key={`${date}-${topic}`}><td>{date}</td><td>{topic}</td></tr>)}</tbody></table>
        </details>
      ) : null}
      {course.note ? <p className="course-note">{course.note}</p> : null}
    </li>
  );
}

export function AiAgents() {
  return (
    <div className="rules-layout">
      <aside className="rules-summary">
        <p className="eyebrow">残酷AI群 · AI AGENTS</p>
        <h3>每天 50 字，或者每人 5 元。</h3>
        <p>每日记录一点 AI 学习与实践，一起把 Stanford、Harvard、CMU 的 Agent 课程啃完。</p>
        <div className="rules-notice"><strong>群规</strong><ol className="ai-rule-list">{aiGroupRules.map(([title, text]) => <li key={title}><strong>{title}</strong>{text}</li>)}</ol></div>
        <nav className="course-index" aria-label="课程索引">{schools.map((school) => <a href={`#${school.toLowerCase()}`} key={school}>{school} ↓</a>)}</nav>
        <div className="course-index"><Link href="/ai-agents/checkins">去打卡 →</Link><Link href="/ai-agents/stats">打卡统计 →</Link><Link href="/rules">刷题群群规 →</Link></div>
      </aside>
      <div className="rules-content">
        <div className="rules-meta"><span>Agent 课程</span><span>{agentCourses.length} 门</span></div>
        {schools.map((school) => (
          <section className="course-group" id={school.toLowerCase()} key={school}>
            <h3>{school}</h3>
            <ul className="course-list">{agentCourses.filter((course) => course.school === school).map((course) => <CourseCard course={course} key={course.code} />)}</ul>
          </section>
        ))}
        <p className="rules-footnote">课程信息整理自各课程官网与学校 Bulletin（2026-10）；开课时间、评分与安排以官网最新公告为准。</p>
      </div>
    </div>
  );
}
