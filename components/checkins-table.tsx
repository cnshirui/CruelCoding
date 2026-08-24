"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink, Search } from "lucide-react";
import type { DailyProblem } from "@/lib/daily-problems";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckinsRefresh } from "@/components/checkins-refresh";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/table-pagination";

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function difficultyClass(level: string | null) {
  if (level === "Easy") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (level === "Medium") return "border-amber-200 bg-amber-50 text-amber-700";
  if (level === "Hard") return "border-rose-200 bg-rose-50 text-rose-700";
  return "";
}

export function CheckinsTable({ problems }: { problems: DailyProblem[] }) {
  const today = localDateKey();
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<DailyProblem>[]>(() => [
    {
      accessorKey: "date",
      header: ({ column }) => <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>日期 <ArrowUpDown /></Button>,
      cell: ({ row }) => <time className="font-mono text-xs" dateTime={row.original.date}>{row.original.date}</time>,
    },
    {
      accessorKey: "number",
      header: ({ column }) => <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>题号 <ArrowUpDown /></Button>,
      cell: ({ row }) => <span className="font-mono font-medium">{row.original.number ?? "—"}</span>,
    },
    {
      accessorKey: "title",
      header: "题目",
      cell: ({ row }) => {
        const problem = row.original;
        const externalHref = problem.url ?? `https://leetcode.com/problemset/?search=${problem.number ?? encodeURIComponent(problem.title)}`;
        return <div className="flex min-w-72 items-center gap-2"><Link className="font-medium hover:text-primary hover:underline" href={`/checkins/${problem.date}`}>{problem.title}</Link><Button asChild variant="ghost" size="icon-xs"><a href={externalHref} target="_blank" rel="noreferrer" aria-label={`在 LeetCode 打开 ${problem.title}`}><ExternalLink /></a></Button></div>;
      },
    },
    {
      accessorKey: "tags",
      header: "标签",
      cell: ({ row }) => <div className="flex max-w-80 flex-wrap gap-1">{row.original.tags.length ? row.original.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>) : <span className="text-muted-foreground">—</span>}</div>,
    },
    {
      accessorKey: "level",
      header: "难度",
      filterFn: (row, id, value) => value === "all" || row.getValue(id) === value,
      cell: ({ row }) => <div className="flex items-center gap-2"><Badge variant="outline" className={difficultyClass(row.original.level)}>{row.original.level ?? "—"}</Badge>{row.original.difficulty ? <span className="text-xs text-muted-foreground">{row.original.difficulty}</span> : null}</div>,
    },
    {
      id: "explanations",
      header: "讲解",
      enableSorting: false,
      cell: ({ row }) => <div className="flex gap-1">{row.original.youtube ? <Button asChild variant="outline" size="xs"><a href={row.original.youtube} target="_blank" rel="noreferrer">YouTube</a></Button> : null}{row.original.bilibili ? <Button asChild variant="outline" size="xs"><a href={row.original.bilibili} target="_blank" rel="noreferrer">B站</a></Button> : null}{!row.original.youtube && !row.original.bilibili ? <span className="text-muted-foreground">—</span> : null}</div>,
    },
  ], []);

  // TanStack Table returns a stateful instance whose methods are intentionally not memoizable.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: problems,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  return <div className="space-y-5">
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder="搜索题号、题目或标签…" className="pl-8" aria-label="搜索每日题目" /></div>
        <div className="flex items-center gap-2"><CheckinsRefresh /><Select value={(table.getColumn("level")?.getFilterValue() as string) ?? "all"} onValueChange={(value) => table.getColumn("level")?.setFilterValue(value === "all" ? undefined : value)}><SelectTrigger aria-label="按难度筛选"><SelectValue placeholder="全部难度" /></SelectTrigger><SelectContent><SelectItem value="all">全部难度</SelectItem><SelectItem value="Easy">Easy</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="Hard">Hard</SelectItem></SelectContent></Select><span className="whitespace-nowrap text-xs text-muted-foreground">{table.getFilteredRowModel().rows.length} 道题</span></div>
      </div>

      <Table>
        <TableHeader>{table.getHeaderGroups().map((headerGroup) => <TableRow key={headerGroup.id}>{headerGroup.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
        <TableBody>{table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow key={row.id} className={row.original.date === today ? "bg-accent/60" : undefined}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={columns.length} className="h-28 text-center text-muted-foreground">没有符合条件的题目。</TableCell></TableRow>}</TableBody>
      </Table>

      <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-muted-foreground">第 {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)} 页</span>
        <div className="flex items-center gap-2"><Select value={String(table.getState().pagination.pageSize)} onValueChange={(value) => table.setPageSize(Number(value))}><SelectTrigger size="sm" aria-label="每页显示数量"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">每页 10 条</SelectItem><SelectItem value="20">每页 20 条</SelectItem><SelectItem value="30">每页 30 条</SelectItem><SelectItem value="50">每页 50 条</SelectItem></SelectContent></Select><TablePagination pageIndex={table.getState().pagination.pageIndex} pageCount={table.getPageCount()} onPageChange={table.setPageIndex} /></div>
      </div>
    </div>
  </div>;
}
