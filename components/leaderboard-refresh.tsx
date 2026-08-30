"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type RefreshResult = { message?: string; error?: string; retryAfter?: number; changed?: boolean };

export function LeaderboardRefresh() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState<{ failed: boolean; text: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1_000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function refresh() {
    setRefreshing(true);
    setStatus(null);
    try {
      const response = await fetch("/api/leaderboard/refresh", { method: "POST" });
      const payload = await response.json() as RefreshResult;
      if (payload.retryAfter) setCooldown(payload.retryAfter);
      if (!response.ok) {
        setStatus({ failed: true, text: payload.error ?? `刷新失败（${response.status}）` });
        return;
      }
      setStatus({ failed: false, text: payload.changed ? "榜单已更新" : "榜单已是最新" });
      router.refresh();
    } catch (error) {
      setStatus({ failed: true, text: error instanceof Error ? error.message : "刷新失败" });
    } finally {
      setRefreshing(false);
    }
  }

  const label = refreshing ? "正在刷新…" : cooldown > 0 ? `${cooldown}s 后可刷新` : "刷新榜单";
  return <div className="list-refresh">
    <Button variant="outline" size="sm" type="button" onClick={refresh} disabled={refreshing || cooldown > 0}>
      <RefreshCw className={refreshing ? "animate-spin" : undefined} aria-hidden="true" />{label}
    </Button>
    {status ? <span role="status" className={status.failed ? "failed" : undefined}>{status.failed ? null : <Check aria-hidden="true" />}{status.text}</span> : null}
  </div>;
}
