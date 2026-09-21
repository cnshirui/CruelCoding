"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, LoaderCircle } from "lucide-react";
import { contestRankingLookupUrl, type ContestRankingLookup } from "@/lib/contest-links";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

type LookupState = { status: "idle" | "loading" } | { status: "error"; message: string } | { status: "done"; result: ContestRankingLookup };

function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 1500);
  }
  return <div className="flex items-center gap-2">
    <div className="min-w-0 flex-1">
      <div className="text-xs text-muted-foreground">{label}{hint ? <span> · {hint}</span> : null}</div>
      <div className="truncate font-mono font-semibold">{value}</div>
    </div>
    <Button variant="outline" size="icon-sm" onClick={copy} aria-label={`复制${label}`} title={copied === "failed" ? "复制失败" : `复制${label}`}>{copied === "copied" ? <Check /> : <Copy />}</Button>
  </div>;
}

// A member's rank opens where they sit in LeetCode's contest ranking before leaving the site: the ranking page shows
// display names, not usernames, so the viewer gets the page, row and both names to find the member there.
export function ContestRankLookup({ contest, rank, username, children }: { contest: number; rank: number | null | undefined; username: string; children: ReactNode }) {
  const [state, setState] = useState<LookupState>({ status: "idle" });
  const lookupUrl = contestRankingLookupUrl(contest, rank, username);
  if (!lookupUrl) return children;

  async function lookup() {
    setState({ status: "loading" });
    try {
      const response = await fetch(lookupUrl!);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "查询失败。");
      setState({ status: "done", result: body as ContestRankingLookup });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "查询失败。" });
    }
  }

  return <Popover onOpenChange={(open) => { if (open && (state.status === "idle" || state.status === "error")) void lookup(); }}>
    <PopoverTrigger asChild>
      <button type="button" className="contest-rank-link" aria-label={`查看 ${username} 在 Weekly ${contest} 排名中的位置`}>{children}</button>
    </PopoverTrigger>
    <PopoverContent className="w-72">
      <PopoverHeader>
        <PopoverTitle>Weekly {contest} · {username}</PopoverTitle>
        <PopoverDescription>LeetCode 全球排名（力扣 global_v2）</PopoverDescription>
      </PopoverHeader>
      {state.status === "loading" || state.status === "idle" ? <div className="flex items-center gap-2 py-3 text-muted-foreground" role="status"><LoaderCircle className="animate-spin" />正在排名中查找 {username}…</div> : null}
      {state.status === "error" ? <div className="flex flex-col gap-2" role="alert"><p className="text-destructive">{state.message}</p><Button variant="outline" size="sm" onClick={() => void lookup()}>重试</Button></div> : null}
      {state.status === "done" ? <>
        {state.result.found ? <>
          <CopyField label="页码" value={String(state.result.page)} hint={`第 ${state.result.row} 行`} />
          <CopyField label="LeetCode 名次" value={String(state.result.rank)} />
          <CopyField label="用户名" value={state.result.username} />
          {state.result.displayName ? <CopyField label="页面显示名" value={state.result.displayName} hint="排名页上显示这个名字" /> : null}
          <p className="text-xs text-muted-foreground">打开后按 ⌘F / Ctrl+F 搜索页面显示名。</p>
        </> : <p className="text-muted-foreground">没有在 LeetCode 排名中找到 {username}，可以从第 {state.result.page} 页开始往后找。</p>}
        <Button asChild size="sm"><a href={state.result.url} target="_blank" rel="noreferrer">打开第 {state.result.page} 页<ExternalLink data-icon="inline-end" /></a></Button>
      </> : null}
    </PopoverContent>
  </Popover>;
}
