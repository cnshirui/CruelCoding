"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { type ColumnDef, type SortingState, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { ArrowUpDown, Search } from "lucide-react";
import type { AiMemberStats, AiMemberStatus } from "@/lib/ai-group";
import { reviewMember } from "@/app/ai-agents/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListRefresh } from "@/components/list-refresh";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableColumnSettings, useColumnLayout } from "@/components/table-column-settings";

const statusMeta: Record<AiMemberStatus, { label: string; className: string }> = {
  approved: { label: "已加入", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  pending: { label: "待批准", className: "border-amber-200 bg-amber-50 text-amber-700" },
  rejected: { label: "已拒绝", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

function SortHeader({ label, column }: { label: string; column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) {
  return <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>{label} <ArrowUpDown /></Button>;
}

function ReviewButtons({ member }: { member: AiMemberStats }) {
  return <div className="flex flex-wrap gap-1">
    {member.status !== "approved" ? <ActionForm action={reviewMember}><input type="hidden" name="user_id" value={member.user_id} /><input type="hidden" name="status" value="approved" /><SubmitButton size="xs" pendingLabel="…">批准</SubmitButton></ActionForm> : null}
    {member.status !== "rejected" ? <ActionForm action={reviewMember}><input type="hidden" name="user_id" value={member.user_id} /><input type="hidden" name="status" value="rejected" /><SubmitButton size="xs" variant="outline" pendingLabel="…">{member.status === "approved" ? "移出" : "拒绝"}</SubmitButton></ActionForm> : null}
  </div>;
}

export function AiMembersTable({ rows, days, isAdmin }: { rows: AiMemberStats[]; days: string[]; isAdmin: boolean }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "status", desc: false }, { id: "streak", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { columnOrder, columnVisibility, setColumnOrder, setColumnVisibility } = useColumnLayout("ai-members");
  const data = useMemo(() => statusFilter === "all" ? rows : rows.filter((row) => row.status === statusFilter), [rows, statusFilter]);

  const columns = useMemo<ColumnDef<AiMemberStats>[]>(() => [
    { accessorKey: "display_name", meta: { label: "成员" }, header: ({ column }) => <SortHeader label="成员" column={column} />, cell: ({ row }) => <Link className="font-medium hover:text-primary hover:underline" href={`/ai-agents/checkins?user=${row.original.user_id}`}>{row.original.display_name}</Link> },
    { accessorKey: "status", meta: { label: "状态" }, header: ({ column }) => <SortHeader label="状态" column={column} />, sortingFn: (a, b) => ["pending", "approved", "rejected"].indexOf(a.original.status) - ["pending", "approved", "rejected"].indexOf(b.original.status), cell: ({ row }) => { const meta = statusMeta[row.original.status]; return <Badge variant="outline" className={meta.className}>{meta.label}</Badge>; } },
    { accessorKey: "total", meta: { label: "打卡天数" }, header: ({ column }) => <SortHeader label="打卡天数" column={column} />, cell: ({ getValue }) => <span className="font-mono">{getValue<number>()}</span> },
    { accessorKey: "streak", meta: { label: "连续天数" }, header: ({ column }) => <SortHeader label="连续天数" column={column} />, cell: ({ getValue }) => <span className="font-mono">{getValue<number>()}</span> },
    { id: "last7", meta: { label: "最近 7 天" }, enableSorting: false, header: "最近 7 天", cell: ({ row }) => <span className="ai-dots" aria-label={`最近 7 天打卡 ${row.original.last7.filter(Boolean).length} 次`}>{row.original.last7.map((done, index) => <i className={done ? "done" : undefined} title={`${days[index]}${done ? " 已打卡" : " 未打卡"}`} key={days[index]} />)}</span> },
    { accessorKey: "last_date", meta: { label: "最近打卡" }, header: ({ column }) => <SortHeader label="最近打卡" column={column} />, cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string | null>() ?? "—"}</span> },
    { accessorKey: "last_course", meta: { label: "最近课程" }, header: ({ column }) => <SortHeader label="最近课程" column={column} />, cell: ({ getValue }) => getValue<string | null>() ? <Badge variant="secondary">{getValue<string>()}</Badge> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "applied_at", meta: { label: "申请时间" }, header: ({ column }) => <SortHeader label="申请时间" column={column} />, cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{new Date(getValue<string>()).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}</span> },
    ...(isAdmin ? [{ id: "review", meta: { label: "审核" }, enableSorting: false, header: "审核", cell: ({ row }) => <ReviewButtons member={row.original} /> } satisfies ColumnDef<AiMemberStats>] : []),
  ], [days, isAdmin]);

  // TanStack Table returns a stateful instance whose methods are intentionally not memoizable.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data, columns,
    state: { sorting, globalFilter, columnOrder, columnVisibility },
    onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter, onColumnOrderChange: setColumnOrder, onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _id, value) => row.original.display_name.toLowerCase().includes(String(value).trim().toLowerCase()),
  });

  return <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
    <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder="搜索成员…" className="pl-8" aria-label="搜索成员" /></div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger aria-label="按状态筛选"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部状态</SelectItem><SelectItem value="approved">已加入</SelectItem><SelectItem value="pending">待批准</SelectItem><SelectItem value="rejected">已拒绝</SelectItem></SelectContent></Select>
        <ListRefresh /><TableColumnSettings table={table} />
        <span className="whitespace-nowrap text-xs text-muted-foreground">{table.getFilteredRowModel().rows.length} 人</span>
      </div>
    </div>
    <Table>
      <TableHeader>{table.getHeaderGroups().map((headerGroup) => <TableRow key={headerGroup.id}>{headerGroup.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
      <TableBody>{table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length} className="h-28 text-center text-muted-foreground">还没有成员。</TableCell></TableRow>}</TableBody>
    </Table>
  </div>;
}
