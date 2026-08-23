"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef, type ColumnFiltersState, type PaginationState, type SortingState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { ArrowUpDown, Check, ChevronLeft, ChevronRight, RefreshCw, Search, TriangleAlert } from "lucide-react";
import type { LeaderboardMember } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function SortHeader({ label, column }: { label: string; column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) {
  return <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>{label}<ArrowUpDown /></Button>;
}

function visiblePages(current: number, total: number): Array<number | "ellipsis-start" | "ellipsis-end"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index);
  const pages: Array<number | "ellipsis-start" | "ellipsis-end"> = [0];
  if (current > 3) pages.push("ellipsis-start");
  for (let page = Math.max(1, current - 1); page <= Math.min(total - 2, current + 1); page += 1) pages.push(page);
  if (current < total - 4) pages.push("ellipsis-end");
  pages.push(total - 1);
  return pages;
}

const columns: ColumnDef<LeaderboardMember>[] = [
  { accessorKey: "cruel_id", header: ({ column }) => <SortHeader label="群友" column={column} />, cell: ({ row }) => <Link className="users-member" href={`/users/${row.original.user_id}`} onClick={(event) => event.stopPropagation()}><Avatar className="size-9"><AvatarFallback>{row.original.cruel_id.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><span><strong>{row.original.cruel_id}</strong><small>{row.original.wechat_name || "群友"}</small></span></Link> },
  { accessorKey: "status", header: ({ column }) => <SortHeader label="状态" column={column} />, filterFn: (row, id, value) => value === "all" || row.getValue(id) === value, cell: ({ row }) => row.original.status === "inactive" ? <Badge variant="outline">已退群</Badge> : <Badge className="bg-emerald-50 text-emerald-700" variant="outline">在群</Badge> },
  { accessorKey: "subgroup", header: "分组", filterFn: (row, id, value) => value === "all" || row.getValue(id) === value, cell: ({ row }) => row.original.subgroup ? <Badge variant="secondary">{row.original.subgroup} 组</Badge> : "—" },
  { accessorKey: "cruel_date", header: ({ column }) => <SortHeader label="加入日期" column={column} /> },
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
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([{ id: "status", value: "active" }]);
  const [refreshState, setRefreshState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [refreshError, setRefreshError] = useState("");
  const groups = useMemo(() => Array.from(new Set(data.map((member) => member.subgroup).filter((group): group is string => Boolean(group)))).sort(), [data]);

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
  const table = useReactTable({ data, columns, state: { sorting, globalFilter, pagination, columnFilters }, onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter, onPaginationChange: setPagination, onColumnFiltersChange: setColumnFilters, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), globalFilterFn: (row, _columnId, value) => [row.original.cruel_id, row.original.wechat_name, row.original.subgroup, row.original.status].some((field) => field?.toLowerCase().includes(String(value).trim().toLowerCase())) });

  const statusFilter = (table.getColumn("status")?.getFilterValue() as string) ?? "all";
  const groupFilter = (table.getColumn("subgroup")?.getFilterValue() as string) ?? "all";
  const pageCount = table.getPageCount();

  return <div className="users-directory">
    <div className="users-table-toolbar"><div className="users-table-search"><Search aria-hidden="true" /><Input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder="搜索姓名或 Cruel ID…" aria-label="搜索群友" /></div><div className="users-table-filters"><Select value={statusFilter} onValueChange={(value) => table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value)}><SelectTrigger aria-label="按在群状态筛选"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">在群群友</SelectItem><SelectItem value="inactive">已退群</SelectItem><SelectItem value="all">全部记录</SelectItem></SelectContent></Select><Select value={groupFilter} onValueChange={(value) => table.getColumn("subgroup")?.setFilterValue(value === "all" ? undefined : value)}><SelectTrigger aria-label="按分组筛选"><SelectValue placeholder="全部分组" /></SelectTrigger><SelectContent><SelectItem value="all">全部分组</SelectItem>{groups.map((group) => <SelectItem value={group} key={group}>{group} 组</SelectItem>)}</SelectContent></Select><span className="users-result-count">共 {table.getFilteredRowModel().rows.length} 位</span><Button variant="outline" type="button" onClick={refresh} disabled={refreshState === "loading"}><RefreshCw className={refreshState === "loading" ? "animate-spin" : undefined} aria-hidden="true" />{refreshState === "loading" ? "刷新中…" : "刷新"}</Button></div></div>
    {refreshState === "success" ? <p className="users-refresh-status success" role="status"><Check aria-hidden="true" />群友数据已刷新</p> : null}
    {refreshState === "error" ? <p className="users-refresh-status error" role="alert"><TriangleAlert aria-hidden="true" />{refreshError}</p> : null}
    <div className="users-table-shell"><Table className="users-data-table"><TableHeader>{table.getHeaderGroups().map((headerGroup) => <TableRow key={headerGroup.id}>{headerGroup.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow className="users-clickable-row" key={row.id} tabIndex={0} onClick={() => router.push(`/users/${row.original.user_id}`)} onKeyDown={(event) => { if (event.key === "Enter") router.push(`/users/${row.original.user_id}`); }}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={columns.length} className="users-table-empty">没有找到匹配的群友。</TableCell></TableRow>}</TableBody></Table></div>
    <div className="users-table-pagination"><span>第 {table.getState().pagination.pageIndex + 1} / {Math.max(pageCount, 1)} 页</span><div className="users-page-size"><span>每页</span><Select value={String(pagination.pageSize)} onValueChange={(value) => table.setPageSize(Number(value))}><SelectTrigger aria-label="每页显示数量"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select></div><div className="users-page-buttons"><Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="上一页"><ChevronLeft /></Button>{visiblePages(pagination.pageIndex, pageCount).map((page) => typeof page === "number" ? <Button key={page} variant={page === pagination.pageIndex ? "default" : "outline"} size="icon-sm" onClick={() => table.setPageIndex(page)} aria-label={`第 ${page + 1} 页`}>{page + 1}</Button> : <span className="users-page-ellipsis" aria-hidden="true" key={page}>…</span>)}<Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="下一页"><ChevronRight /></Button></div></div>
  </div>;
}
