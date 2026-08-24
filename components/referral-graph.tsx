"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import type { LeaderboardMember } from "@/lib/types";

function normalizeName(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function escapeHtml(value: string | undefined) {
  return (value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

const nodeColors = ["#d95d4f", "#387f70", "#d28a2e", "#5f72c9", "#a34f91", "#3b8ca5", "#79943c", "#c46785"];

function colorForMember(member: LeaderboardMember, connections: number) {
  if (connections === 0) return member.status === "inactive" ? "#c7bfb4" : "#9a8067";
  const hash = [...member.user_id].reduce((value, character) => value + character.charCodeAt(0), 0);
  return nodeColors[hash % nodeColors.length];
}

export function ReferralGraph({ members }: { members: LeaderboardMember[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const graph = useMemo(() => {
    const memberByName = new Map<string, LeaderboardMember>();
    for (const member of members) {
      for (const name of [member.cruel_id, member.wechat_name, member.wechat_id]) {
        const key = normalizeName(name);
        if (key && !memberByName.has(key)) memberByName.set(key, member);
      }
    }
    const links: { source: string; target: string }[] = [];
    const degree = new Map(members.map((member) => [member.user_id, 0]));
    const referrals = new Map(members.map((member) => [member.user_id, 0]));
    for (const member of members) {
      const referrer = memberByName.get(normalizeName(member.referral));
      if (!referrer || referrer.user_id === member.user_id) continue;
      links.push({ source: referrer.user_id, target: member.user_id });
      degree.set(referrer.user_id, (degree.get(referrer.user_id) ?? 0) + 1);
      degree.set(member.user_id, (degree.get(member.user_id) ?? 0) + 1);
      referrals.set(referrer.user_id, (referrals.get(referrer.user_id) ?? 0) + 1);
    }
    const maxDegree = Math.max(1, ...members.map((member) => degree.get(member.user_id) ?? 0));
    return {
      links,
      nodes: members.map((member) => {
        const connections = degree.get(member.user_id) ?? 0;
        const referralCount = referrals.get(member.user_id) ?? 0;
        const referralScale = Math.min(1, Math.log1p(referralCount) / Math.log1p(60));
        return {
          id: member.user_id,
          name: member.cruel_id,
          displayName: member.wechat_name || member.cruel_id,
          value: connections,
          referrals: referralCount,
          symbolSize: connections === 0 ? 8 : referralCount === 0 ? 10 : 24 + referralScale * 64,
          itemStyle: { color: connections === maxDegree ? "#b42318" : colorForMember(member, connections), borderColor: "#fffaf2", borderWidth: connections ? 2 : 1, shadowBlur: connections >= 3 ? 12 : 3, shadowColor: "rgba(50, 38, 30, .2)" },
          label: { show: referralCount > 0, formatter: member.wechat_name || member.cruel_id },
        };
      }),
    };
  }, [members]);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    void (async () => {
      const [{ init, use }, { GraphChart }, { TooltipComponent }, { CanvasRenderer }] = await Promise.all([
        import("echarts/core"), import("echarts/charts"), import("echarts/components"), import("echarts/renderers"),
      ]);
      if (disposed || !containerRef.current) return;
      use([GraphChart, TooltipComponent, CanvasRenderer]);
      const chart = init(containerRef.current);
      chart.setOption({
        tooltip: { formatter: (params: { dataType?: string; data?: { name?: string; displayName?: string; value?: number; referrals?: number } }) => params.dataType === "node" ? `<strong>${escapeHtml(params.data?.displayName ?? params.data?.name)}</strong><br/>CruelID: ${escapeHtml(params.data?.name) || "—"}<br/>推荐 ${params.data?.referrals ?? 0} 人<br/>${params.data?.value ?? 0} 条连接` : "推荐关系" },
        series: [{ type: "graph", layout: "force", data: graph.nodes, links: graph.links, roam: true, draggable: true, force: { repulsion: 180, edgeLength: [55, 150], gravity: 0.08 }, label: { position: "right", color: "#38352f", fontSize: 11 }, lineStyle: { color: "source", width: 1.4, opacity: 0.5, curveness: 0.1 }, emphasis: { focus: "adjacency", lineStyle: { width: 3, opacity: 1 } } }],
      });
      chart.on("click", (params) => {
        const node = params.data as { id?: string } | null;
        if (params.dataType === "node" && node?.id) router.push(`/users/${node.id}`);
      });
      const observer = new ResizeObserver(() => chart.resize());
      observer.observe(containerRef.current);
      cleanup = () => { observer.disconnect(); chart.dispose(); };
    })();
    return () => { disposed = true; cleanup(); };
  }, [graph, router]);

  return <section className="referral-graph-card" aria-labelledby="referral-graph-title">
    <div className="referral-graph-heading"><div><h2 id="referral-graph-title">残酷关系</h2></div><p>{graph.nodes.length} 位群友 · {graph.links.length} 条推荐关系</p></div>
    {graph.links.length ? <><div ref={containerRef} className="referral-graph" role="img" aria-label="群友推荐关系图，节点越大表示连接越多" /><p className="referral-graph-hint">拖动节点探索关系，滚轮缩放，点击节点查看群友详情。节点越大，连接越多。</p></> : <div className="referral-graph-empty">暂无可匹配的推荐关系。</div>}
  </section>;
}
