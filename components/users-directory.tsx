"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef, type ColumnFiltersState, type PaginationState, type SortingState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { ArrowUpDown, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Network, RefreshCw, Search, Table2, TriangleAlert } from "lucide-react";
import type { LeaderboardMember } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReferralGraph } from "@/components/referral-graph";

function SortHeader({ label, column }: { label: string; column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) {
  return <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>{label}<ArrowUpDown /></Button>;
}

function visiblePages(current: number, total: number) {
  const start = Math.max(0, Math.min(current - 1, total - 3));
  return Array.from({ length: Math.min(3, total) }, (_, index) => start + index);
}

const columns: ColumnDef<LeaderboardMember>[] = [
  { accessorKey: "cruel_id", header: ({ column }) => <SortHeader label="群友" column={column} />, cell: ({ row }) => <Link className="users-member" href={`/users/${row.original.user_id}`} onClick={(event) => event.stopPropagation()}><Avatar className="size-9"><AvatarFallback>{row.original.cruel_id.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><span><strong>{row.original.cruel_id}</strong><small>{row.original.wechat_name || "群友"}</small></span></Link> },
  { accessorKey: "status", header: ({ column }) => <SortHeader label="状态" column={column} />, filterFn: (row, id, value) => value === "all" || row.getValue(id) === value, cell: ({ row }) => row.original.status === "inactive" ? <Badge variant="outline">已退群</Badge> : <Badge className="bg-emerald-50 text-emerald-700" variant="outline">在群</Badge> },
  { accessorKey: "cruel_date", header: ({ column }) => <SortHeader label="加入日期" column={column} /> },
  { accessorKey: "exit_date", header: ({ column }) => <SortHeader label="退出日期" column={column} />, cell: ({ row }) => row.original.exit_date ?? "—" },
  { accessorKey: "days", header: ({ column }) => <SortHeader label="入群天数" column={column} />, cell: ({ row }) => row.original.days.toLocaleString() },
  { accessorKey: "rating", header: ({ column }) => <SortHeader label="竞赛分" column={column} />, cell: ({ row }) => row.original.rating && row.original.rating > 0 ? row.original.rating.toLocaleString() : "—" },
  { accessorKey: "score", header: ({ column }) => <SortHeader label="综合得分" column={column} />, cell: ({ row }) => <strong>{row.original.score.toFixed(1)}</strong> },
  { id: "profile", header: "", cell: ({ row }) => <Button variant="ghost" size="icon-sm" asChild><Link href={`/users/${row.original.user_id}`} aria-label={`查看 ${row.original.cruel_id} 的详情`} onClick={(event) => event.stopPropagation()}><ChevronRight /></Link></Button> },
];

export function UsersDirectory({ members }: { members: LeaderboardMember[] }) {
  const router = useRouter();
  const [data, setData] = useState(members);
  const [sorting, setSorting] = useState<SortingState>([{ id: "score", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [view, setView] = useState<"table" | "graph">("table");
  const [refreshState, setRefreshState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [refreshError, setRefreshError] = useState("");

  async function refresh() {
    setRefreshState("loading");
    setRefreshError("");
    try {
      const response = await fetch("/api/community-members", { cache: "no-store" });
      const result = await response.json() as { members?: LeaderboardMember[]; error?: string };
      if (!response.ok || !result.members) throw new Error(result.error ?? "无法刷新群友数据。");
      setData(result.members);
      setRefreshState("success");
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "无法刷新群友数据。");
      setRefreshState("error");
    }
  }

  // TanStack Table returns a stateful instance whose methods are intentionally not memoizable.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data, columns, state: { sorting, globalFilter, pagination, columnFilters }, onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter, onPaginationChange: setPagination, onColumnFiltersChange: setColumnFilters, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), globalFilterFn: (row, _columnId, value) => [row.original.cruel_id, row.original.wechat_name].some((field) => field?.toLowerCase().includes(String(value).trim().toLowerCase())) });

  const pageCount = table.getPageCount();
  const statusFilter = (table.getColumn("status")?.getFilterValue() as string | undefined) ?? "all";
  const activeOnly = statusFilter === "active";
  const visibleRows = activeOnly ? table.getSortedRowModel().rows : table.getRowModel().rows;
  const filteredMembers = table.getFilteredRowModel().rows.map((row) => row.original);

  return <div className="users-directory">
    <div className="users-table-toolbar"><div className="users-table-search"><Search aria-hidden="true" /><Input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder="搜索姓名或 Cruel ID…" aria-label="搜索群友" /></div><div className="users-table-filters"><Select value={statusFilter} onValueChange={(value) => { table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value); table.setPageIndex(0); }}><SelectTrigger aria-label="按在群状态筛选"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部群友</SelectItem><SelectItem value="active">在群群友</SelectItem></SelectContent></Select><Button variant="outline" type="button" onClick={() => setView(view === "table" ? "graph" : "table")} aria-label={view === "table" ? "切换到关系图" : "切换到表格"}>{view === "table" ? <Network aria-hidden="true" /> : <Table2 aria-hidden="true" />}{view === "table" ? "查看关系图" : "查看表格"}</Button><span className="users-result-count">共 {table.getFilteredRowModel().rows.length} 位{activeOnly ? "在群" : "残酷"}群友</span><Button variant="outline" type="button" onClick={refresh} disabled={refreshState === "loading"}><RefreshCw className={refreshState === "loading" ? "animate-spin" : undefined} aria-hidden="true" />{refreshState === "loading" ? "刷新中…" : "刷新"}</Button></div></div>
    {refreshState === "success" ? <p className="users-refresh-status success" role="status"><Check aria-hidden="true" />群友数据已刷新</p> : null}
    {refreshState === "error" ? <p className="users-refresh-status error" role="alert"><TriangleAlert aria-hidden="true" />{refreshError}</p> : null}
    {view === "graph" ? <ReferralGraph members={filteredMembers} /> : <>
    <div className="users-table-shell"><Table className="users-data-table"><TableHeader>{table.getHeaderGroups().map((headerGroup) => <TableRow key={headerGroup.id}>{headerGroup.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{visibleRows.length ? visibleRows.map((row) => <TableRow className="users-clickable-row" key={row.id} tabIndex={0} onClick={() => router.push(`/users/${row.original.user_id}`)} onKeyDown={(event) => { if (event.key === "Enter") router.push(`/users/${row.original.user_id}`); }}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={columns.length} className="users-table-empty">没有找到匹配的群友。</TableCell></TableRow>}</TableBody></Table></div>
    {!activeOnly ? <div className="users-table-pagination"><span aria-live="polite">第 {pagination.pageIndex + 1} / {Math.max(pageCount, 1)} 页</span><div className="users-page-buttons"><Button variant="outline" size="icon-sm" onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()} aria-label="第一页"><ChevronsLeft /></Button><Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="上一页"><ChevronLeft /></Button>{visiblePages(pagination.pageIndex, pageCount).map((page) => <Button key={page} variant={page === pagination.pageIndex ? "default" : "outline"} size="icon-sm" onClick={() => table.setPageIndex(page)} aria-label={`第 ${page + 1} 页`} aria-current={page === pagination.pageIndex ? "page" : undefined}>{page + 1}</Button>)}<Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="下一页"><ChevronRight /></Button><Button variant="outline" size="icon-sm" onClick={() => table.lastPage()} disabled={!table.getCanNextPage()} aria-label="最后一页"><ChevronsRight /></Button></div></div> : null}
    </>}
  </div>;
}
