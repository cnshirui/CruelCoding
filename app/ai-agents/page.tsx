import type { Metadata } from "next";
import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import { AiAgents } from "@/components/ai-agents";
import { SiteTabs } from "@/components/site-tabs";

export const metadata: Metadata = { title: "残酷AI群 · AI Agents 课程 · Cruel Coding", description: "残酷AI群群规与 Stanford / Harvard / CMU 的 AI Agent 课程汇总。" };

export default function AiAgentsPage() {
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
        <AiAgents />
      </section>
    </main>
  );
}
