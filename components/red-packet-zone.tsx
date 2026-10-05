"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleCheck, Copy } from "lucide-react";
import type { RedPacketZone } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export type RedPacketRow = { contestId: number; userId: string | null; memberName: string; amount: number; paid?: boolean };

// 🧧 still owes this week's packet; the green check means the owner marked it as sent.
export function RedPacketStatus({ paid, showLabel = false }: { paid: boolean; showLabel?: boolean }) {
  return paid
    ? <span className="inline-flex items-center gap-1 text-emerald-700" title="已发红包"><CircleCheck className="size-4" aria-hidden="true" />{showLabel ? "已发" : <span className="sr-only">已发红包</span>}</span>
    : <span className="inline-flex items-center gap-1 text-rose-700" title="待发红包"><span aria-hidden="true">🧧</span>{showLabel ? "待发" : <span className="sr-only">待发红包</span>}</span>;
}

export async function saveRedPackets(rows: RedPacketRow[]) {
  const response = await fetch("/api/red-packets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "保存失败。");
}

export function RedPacketZonePanel({ zone, defaultAmount, isAdmin }: { zone: RedPacketZone; defaultAmount: number; isAdmin: boolean }) {
  const router = useRouter();
  const [amount, setAmount] = useState(defaultAmount);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!zone) return null;
  const { contest, candidates } = zone;
  const unpaid = candidates.filter((member) => !member.paid);
  const nameOf = (member: (typeof candidates)[number]) => member.wechat_name || member.cruel_id;
  const message = unpaid.length
    ? `${unpaid.map((member) => `@${nameOf(member)}`).join("  ")} 很遗憾你们此次周赛落入红包区，请记得发周赛红包${amount}rmb`
    : `${contest.title} 红包区的群友都已发过红包，谢谢大家！`;
  const rowOf = (member: (typeof candidates)[number], paid?: boolean): RedPacketRow => ({ contestId: contest.id, userId: member.user_id, memberName: nameOf(member), amount, paid });

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
    if (isAdmin) await saveRedPackets(candidates.map((member) => rowOf(member)));
  }, isAdmin ? "已复制并保存名单，可以粘贴到微信群。" : "已复制，可以粘贴到微信群。");

  return <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm" aria-labelledby="red-packet-zone-title">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 id="red-packet-zone-title" className="text-base font-semibold">{contest.title} 红包区</h2>
        <p className="text-xs text-muted-foreground">末位 10%，前两周已发过红包的群友本周免发。{isAdmin ? "勾选表示已发。" : ""}</p>
      </div>
      <label className="flex items-center gap-2 text-sm">金额<Input type="number" min={1} value={amount} onChange={(event) => setAmount(Math.max(1, Number(event.target.value) || 1))} className="w-24" aria-label="红包金额（元）" />rmb</label>
    </div>

    <ul className="flex flex-wrap gap-2">
      {candidates.map((member) => <li key={member.user_id}>
        <label className={`flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm ${member.paid ? "bg-emerald-50 text-emerald-700" : "bg-rose-50"}`}>
          {isAdmin ? <Checkbox checked={member.paid} disabled={pending} onCheckedChange={(checked) => run(() => saveRedPackets([rowOf(member, checked === true)]), checked === true ? `已标记 ${nameOf(member)} 发过红包。` : `已取消 ${nameOf(member)} 的标记。`)} aria-label={`${nameOf(member)} 已发红包`} /> : null}
          <RedPacketStatus paid={member.paid} />
          <span>{nameOf(member)}</span>
          <span className="font-mono text-xs text-muted-foreground">{member.score}</span>
        </label>
      </li>)}
    </ul>

    <p className="rounded-md bg-muted p-3 text-sm break-words">{message}</p>
    <div className="flex items-center gap-3">
      <Button type="button" onClick={copy} disabled={pending}><Copy aria-hidden="true" />复制到微信群</Button>
      {status ? <span role="status" className={`flex items-center gap-1 text-xs ${status.kind === "error" ? "text-destructive" : "text-emerald-700"}`}>{status.kind === "ok" ? <Check className="size-3.5" aria-hidden="true" /> : null}{status.text}</span> : null}
    </div>
  </section>;
}
