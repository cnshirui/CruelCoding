"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ColumnDef, type SortingState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { ArrowUpDown, MessageSquare, Search, X } from "lucide-react";
import type { AiCheckin, AiCheckinFilters, AiMember } from "@/lib/ai-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListRefresh } from "@/components/list-refresh";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/table-pagination";
import { TableColumnSettings, useColumnLayout } from "@/components/table-column-settings";

type CourseOption = { code: string; title: string };

function SortHeader({ label, column }: { label: string; column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) {
  return <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>{label} <ArrowUpDown /></Button>;
}

export function AiCheckinsTable({ rows, members, courses, filters }: { rows: AiCheckin[]; members: AiMember[]; courses: CourseOption[]; filters: AiCheckinFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sorting, setSorting] = useState<SortingState>([{ id: "checkin_date", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const { columnOrder, columnVisibility, setColumnOrder, setColumnVisibility } = useColumnLayout("ai-checkins");

  // Course / date / member filters live in the URL so a view can be linked and shared.
  function setFilter(key: keyof AiCheckinFilters, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "all") params.set(key, value); else params.delete(key);
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`);
  }
  const hasFilters = Boolean(filters.course || filters.date || filters.user);

  const columns = useMemo<ColumnDef<AiCheckin>[]>(() => [
    { accessorKey: "checkin_date", meta: { label: "日期" }, header: ({ column }) => <SortHeader label="日期" column={column} />, cell: ({ getValue }) => <Link className="font-mono text-xs hover:underline" href={`?date=${getValue<string>()}`}>{getValue<string>()}</Link> },
    { accessorKey: "display_name", meta: { label: "成员" }, header: ({ column }) => <SortHeader label="成员" column={column} />, cell: ({ row }) => <Link className="font-medium hover:text-primary hover:underline" href={`?user=${row.original.user_id}`}>{row.original.display_name}</Link> },
    { accessorKey: "course_code", meta: { label: "课程" }, header: ({ column }) => <SortHeader label="课程" column={column} />, cell: ({ getValue }) => <Link href={`?course=${encodeURIComponent(getValue<string>())}`}><Badge variant="secondary">{getValue<string>()}</Badge></Link> },
    { accessorKey: "note", meta: { label: "笔记" }, enableSorting: false, header: "笔记", cell: ({ row }) => <Link className="ai-note-preview" href={`/ai-agents/checkins/${row.original.id}`}>{row.original.note.length > 90 ? `${row.original.note.slice(0, 90)}…` : row.original.note}</Link> },
    { accessorKey: "comment_count", meta: { label: "评论" }, header: ({ column }) => <SortHeader label="评论" column={column} />, cell: ({ row }) => <Link className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary" href={`/ai-agents/checkins/${row.original.id}`}><MessageSquare className="size-3.5" aria-hidden="true" />{row.original.comment_count}</Link> },
    { accessorKey: "updated_at", meta: { label: "更新时间" }, header: ({ column }) => <SortHeader label="更新时间" column={column} />, cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{new Date(getValue<string>()).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}</span> },
  ], []);

  // TanStack Table returns a stateful instance whose methods are intentionally not memoizable.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows, columns,
    state: { sorting, globalFilter, columnOrder, columnVisibility },
    onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter, onColumnOrderChange: setColumnOrder, onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(), getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _id, value) => { const needle = String(value).trim().toLowerCase(); return !needle || [row.original.display_name, row.original.course_code, row.original.note].some((field) => field.toLowerCase().includes(needle)); },
    initialState: { pagination: { pageSize: 20 } },
  });

  return <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
    <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-xs"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder="搜索成员、课程或笔记…" className="pl-8" aria-label="搜索打卡记录" /></div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.course ?? "all"} onValueChange={(value) => setFilter("course", value)}><SelectTrigger aria-label="按课程筛选" className="min-w-36"><SelectValue placeholder="全部课程" /></SelectTrigger><SelectContent><SelectItem value="all">全部课程</SelectItem>{courses.map((course) => <SelectItem value={course.code} key={course.code}>{course.code} · {course.title}</SelectItem>)}</SelectContent></Select>
        <Select value={filters.user ?? "all"} onValueChange={(value) => setFilter("user", value)}><SelectTrigger aria-label="按成员筛选" className="min-w-32"><SelectValue placeholder="全部成员" /></SelectTrigger><SelectContent><SelectItem value="all">全部成员</SelectItem>{members.map((member) => <SelectItem value={member.user_id} key={member.user_id}>{member.display_name}</SelectItem>)}</SelectContent></Select>
        <Input type="date" value={filters.date ?? ""} onChange={(event) => setFilter("date", event.target.value)} aria-label="按日期筛选" className="w-auto" />
        {hasFilters ? <Button variant="ghost" size="sm" onClick={() => router.replace(pathname)}><X aria-hidden="true" />清除筛选</Button> : null}
        <ListRefresh /><TableColumnSettings table={table} />
        <span className="whitespace-nowrap text-xs text-muted-foreground">{table.getFilteredRowModel().rows.length} 条</span>
      </div>
    </div>
    <Table>
      <TableHeader>{table.getHeaderGroups().map((headerGroup) => <TableRow key={headerGroup.id}>{headerGroup.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
      <TableBody>{table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id} className="align-top">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length} className="h-28 text-center text-muted-foreground">还没有符合条件的打卡记录。</TableCell></TableRow>}</TableBody>
    </Table>
    <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs text-muted-foreground">第 {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)} 页</span>
      <TablePagination pageIndex={table.getState().pagination.pageIndex} pageCount={table.getPageCount()} onPageChange={table.setPageIndex} />
    </div>
  </div>;
}
