"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { type ColumnDef, type SortingState, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { ArrowUpDown, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ProblemCheckinStatus = { cruel_id: string; solved: boolean; submitted_at: string | null; checked_at: string; check_error: string | null };
type Row = { member: { user_id: string; cruel_id: string; cruel_date: string; days: number }; status?: ProblemCheckinStatus };
type Progress = "queued" | "checking";
type StatusKey = "solved" | "error" | "missing" | "checking" | "queued" | "unchecked";
type StreamEvent =
  | { type: "start"; cruel_ids: string[]; skipped: number }
  | { type: "checking"; cruel_id: string }
  | { type: "result"; status: ProblemCheckinStatus }
  | { type: "complete"; checked: number; solved: number; errors: number; skipped: number }
  | { type: "error"; error: string };

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("zh-CN", { timeZone: "America/Los_Angeles" }) : "—";
}

function getStatus(row: Row, progress: Record<string, Progress>): StatusKey {
  const live = progress[row.member.cruel_id.toLowerCase()];
  if (live) return live;
  if (row.status?.solved) return "solved";
  if (row.status?.check_error) return "error";
  if (row.status) return "missing";
  return "unchecked";
}

const statusMeta: Record<StatusKey, { label: string; className: string }> = {
  solved: { label: "✓ 已完成", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  error: { label: "查询失败", className: "border-rose-200 bg-rose-50 text-rose-700" },
  missing: { label: "未打卡", className: "border-amber-200 bg-amber-50 text-amber-700" },
  checking: { label: "正在检查", className: "border-blue-200 bg-blue-50 text-blue-700" },
  queued: { label: "排队中", className: "border-slate-200 bg-slate-50 text-slate-600" },
  unchecked: { label: "尚未检查", className: "text-muted-foreground" },
};

function SortHeader({ label, column }: { label: string; column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) {
  return <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>{label}<ArrowUpDown /></Button>;
}

export function ProblemCheckinRefresh({ date, number, slug, initialRows }: { date: string; number: string; slug: string; initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "status", desc: false }, { id: "cruelId", desc: false }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredRows = useMemo(() => statusFilter === "all" ? rows : rows.filter((row) => getStatus(row, progress) === statusFilter), [progress, rows, statusFilter]);
  const columns = useMemo<ColumnDef<Row>[]>(() => [
    { id: "cruelId", accessorFn: (row) => row.member.cruel_id, header: ({ column }) => <SortHeader label="CruelID" column={column} />, cell: ({ row }) => <Link className="font-mono font-semibold hover:text-primary hover:underline" href={`/users/${row.original.member.user_id}`}>{row.original.member.cruel_id}</Link> },
    { id: "status", accessorFn: (row) => getStatus(row, progress), header: ({ column }) => <SortHeader label="状态" column={column} />, cell: ({ row }) => { const meta = statusMeta[getStatus(row.original, progress)]; return <Badge variant="outline" className={meta.className}>{meta.label}</Badge>; } },
    { id: "cruelDate", accessorFn: (row) => row.member.cruel_date, header: ({ column }) => <SortHeader label="加入日期" column={column} />, cell: ({ row }) => <time dateTime={row.original.member.cruel_date}>{row.original.member.cruel_date}</time> },
    { id: "joinedDays", accessorFn: (row) => row.member.days, header: ({ column }) => <SortHeader label="入群天数" column={column} />, cell: ({ row }) => row.original.member.days.toLocaleString() },
    { id: "submitted", accessorFn: (row) => row.status?.submitted_at ?? "", header: ({ column }) => <SortHeader label="提交时间" column={column} />, cell: ({ row }) => formatDate(row.original.status?.submitted_at) },
    { id: "checked", accessorFn: (row) => row.status?.checked_at ?? "", header: ({ column }) => <SortHeader label="最后检查" column={column} />, cell: ({ row }) => formatDate(row.original.status?.checked_at) },
  ], [progress]);

  // TanStack Table returns a stateful instance whose methods are intentionally not memoizable.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: filteredRows, columns, state: { sorting, globalFilter }, onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), globalFilterFn: (row, _id, value) => row.original.member.cruel_id.toLowerCase().includes(String(value).trim().toLowerCase()) });

  function applyEvent(event: StreamEvent) {
    if (event.type === "start") setProgress(Object.fromEntries(event.cruel_ids.map((id) => [id.toLowerCase(), "queued"])));
    else if (event.type === "checking") setProgress((current) => ({ ...current, [event.cruel_id.toLowerCase()]: "checking" }));
    else if (event.type === "result") {
      const key = event.status.cruel_id.toLowerCase();
      setRows((current) => current.map((row) => row.member.cruel_id.toLowerCase() === key ? { ...row, status: event.status } : row));
      setProgress((current) => { const next = { ...current }; delete next[key]; return next; });
    } else if (event.type === "complete") setMessage(`检查 ${event.checked} 人，跳过 ${event.skipped} 位已完成人员，发现 ${event.solved} 人完成${event.errors ? `，${event.errors} 人查询失败` : ""}。`);
    else if (event.type === "error") throw new Error(event.error);
  }

  async function refresh() {
    setLoading(true); setMessage(""); setHasError(false); setProgress({});
    try {
      const response = await fetch("/api/daily-problems/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, number, slug }) });
      if (response.status === 401) throw new Error("请先登录，再刷新所有成员的 LeetCode 打卡状态。");
      if (!response.ok || !response.body) { const result = await response.json().catch(() => ({})) as { error?: string }; throw new Error(result.error ?? "刷新失败"); }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) { const { done, value } = await reader.read(); buffer += decoder.decode(value, { stream: !done }); const lines = buffer.split("\n"); buffer = lines.pop() ?? ""; for (const line of lines) if (line) applyEvent(JSON.parse(line) as StreamEvent); if (done) break; }
      if (buffer) applyEvent(JSON.parse(buffer) as StreamEvent);
    } catch (error) { setHasError(true); setMessage(error instanceof Error ? error.message : "刷新失败"); }
    finally { setProgress({}); setLoading(false); }
  }

  return <div className="checkin-status-table">
    <div className="checkin-status-toolbar"><div className="checkin-status-search"><Search aria-hidden="true" /><Input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder="搜索 CruelID…" aria-label="搜索群友打卡状态" /></div><div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger aria-label="按状态筛选"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部状态</SelectItem><SelectItem value="solved">已完成</SelectItem><SelectItem value="missing">未打卡</SelectItem><SelectItem value="unchecked">尚未检查</SelectItem><SelectItem value="error">查询失败</SelectItem></SelectContent></Select><Button type="button" onClick={refresh} disabled={loading}><RefreshCw className={loading ? "animate-spin" : undefined} />{loading ? "正在检查…" : "刷新打卡状态"}</Button></div></div>
    {message ? <p className={hasError ? "checkin-refresh-message error" : "checkin-refresh-message"} role="status">{message}</p> : null}
    <div className="checkin-status-shell"><Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">没有符合条件的群友。</TableCell></TableRow>}</TableBody></Table></div>
    <div className="checkin-status-pagination"><span>{table.getFilteredRowModel().rows.length} 位在群群友</span></div>
  </div>;
}
