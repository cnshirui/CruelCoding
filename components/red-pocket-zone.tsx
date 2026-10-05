"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleCheck, Copy } from "lucide-react";
import type { RedPocketZone } from "@/lib/supabase";
import type { RedPocketState } from "@/lib/red-pocket-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type RedPocketRow = { contestId: number; userId: string | null; memberName: string; amount?: number; status?: RedPocketState | "none" };

const STATES: Record<RedPocketState, { icon: React.ReactNode; label: string; title: string; className: string }> = {
  owed: { icon: <span aria-hidden="true">🧧</span>, label: "待发", title: "待发红包", className: "text-rose-700" },
  paid: { icon: <CircleCheck className="size-4" aria-hidden="true" />, label: "已发", title: "已发红包", className: "text-emerald-700" },
  crying: { icon: <span aria-hidden="true">😭</span>, label: "哭穷", title: "哭穷，还没发红包", className: "text-amber-700" },
};

export function RedPocketStatus({ status, showLabel = false }: { status: RedPocketState; showLabel?: boolean }) {
  const state = STATES[status];
  return <span className={`inline-flex items-center gap-1 ${state.className}`} title={state.title}>{state.icon}{showLabel ? state.label : <span className="sr-only">{state.title}</span>}</span>;
}

export async function saveRedPockets(rows: RedPocketRow[]) {
  const response = await fetch("/api/red-pockets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "保存失败。");
}

const NEXT_STATE: Record<RedPocketState | "none", RedPocketState | "none"> = { none: "owed", owed: "paid", paid: "crying", crying: "none" };

// The owner's editor: each click moves to the next mark, 无 → 🧧 待发 → ✅ 已发 → 😭 哭穷 → 无.
export function RedPocketStatusButton({ status, contestId, userId, memberName, showLabel = false }: { status: RedPocketState | undefined; contestId: number; userId: string | null; memberName: string; showLabel?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const current = status ?? "none";
  const next = NEXT_STATE[current];

  function cycle() {
    setError("");
    startTransition(async () => {
      try {
        await saveRedPockets([{ contestId, userId, memberName, status: next }]);
        router.refresh();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "保存失败。");
      }
    });
  }

  return <button
    type="button"
    onClick={cycle}
    disabled={pending}
    className={`inline-flex min-h-6 min-w-6 items-center justify-center rounded px-1 hover:bg-muted disabled:opacity-50 ${error ? "ring-1 ring-destructive" : ""}`}
    aria-label={`${memberName}：${status ? STATES[status].title : "无红包"}，点击改为${next === "none" ? "无红包" : STATES[next].title}`}
    title={error || `点击改为${next === "none" ? "无红包" : STATES[next].label}`}
  >{status ? <RedPocketStatus status={status} showLabel={showLabel} /> : <span className="text-muted-foreground/40" aria-hidden="true">＋</span>}</button>;
}

export function RedPocketZonePanel({ zone, statuses, defaultAmount, isAdmin }: { zone: RedPocketZone; statuses: Record<string, RedPocketState>; defaultAmount: number; isAdmin: boolean }) {
  const router = useRouter();
  const [amount, setAmount] = useState(defaultAmount);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!zone) return null;
  const { contest, candidates } = zone;
  const statusOf = (member: (typeof candidates)[number]): RedPocketState => member.paid ? "paid" : statuses[member.user_id] ?? "owed";
  const unpaid = candidates.filter((member) => statusOf(member) !== "paid");
  const nameOf = (member: (typeof candidates)[number]) => member.wechat_name || member.cruel_id;
  const message = unpaid.length
    ? `${unpaid.map((member) => `@${nameOf(member)}`).join("  ")} 很遗憾你们此次周赛落入红包区，请记得发周赛红包${amount}rmb`
    : `${contest.title} 红包区的群友都已发过红包，谢谢大家！`;
  const rowOf = (member: (typeof candidates)[number]): RedPocketRow => ({ contestId: contest.id, userId: member.user_id, memberName: nameOf(member), amount });

  function run(action: () => Promise<void>, success: string) {
    setStatus(null);
    startTransition(async () => {
      try {
        await action();
        setStatus({ kind: "ok", text: success });
        router.refresh();
      } catch (error) {
        setStatus({ kind: "error", text: error instanceof Error ? error.message : "操作失败。" });
      }
    });
  }

  // The owner's copy also saves the zone, so the history table records who was called out.
  const copy = () => run(async () => {
    await navigator.clipboard.writeText(message);
    if (isAdmin) await saveRedPockets(candidates.map((member) => rowOf(member)));
  }, isAdmin ? "已复制并保存名单，可以粘贴到微信群。" : "已复制，可以粘贴到微信群。");

  return <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm" aria-labelledby="red-pocket-zone-title">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 id="red-pocket-zone-title" className="text-base font-semibold">{contest.title} 红包区</h2>
        <p className="text-xs text-muted-foreground">末位 10%，前两周已发过红包的群友本周免发。{isAdmin ? "点击图标切换：🧧 待发 → ✅ 已发 → 😭 哭穷。" : ""}</p>
      </div>
      <label className="flex items-center gap-2 text-sm">金额<Input type="number" min={1} value={amount} onChange={(event) => setAmount(Math.max(1, Number(event.target.value) || 1))} className="w-24" aria-label="红包金额（元）" />rmb</label>
    </div>

    <ul className="flex flex-wrap gap-2">
      {candidates.map((member) => <li key={member.user_id}>
        <span className={`flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm ${{ owed: "bg-rose-50", paid: "bg-emerald-50 text-emerald-700", crying: "bg-amber-50" }[statusOf(member)]}`}>
          {isAdmin ? <RedPocketStatusButton status={statusOf(member)} contestId={contest.id} userId={member.user_id} memberName={nameOf(member)} /> : <RedPocketStatus status={statusOf(member)} />}
          <span>{nameOf(member)}</span>
          <span className="font-mono text-xs text-muted-foreground">{member.score}</span>
        </span>
      </li>)}
    </ul>

    <p className="rounded-md bg-muted p-3 text-sm break-words">{message}</p>
    <div className="flex items-center gap-3">
      <Button type="button" onClick={copy} disabled={pending}><Copy aria-hidden="true" />复制到微信群</Button>
      {status ? <span role="status" className={`flex items-center gap-1 text-xs ${status.kind === "error" ? "text-destructive" : "text-emerald-700"}`}>{status.kind === "ok" ? <Check className="size-3.5" aria-hidden="true" /> : null}{status.text}</span> : null}
    </div>
  </section>;
}
