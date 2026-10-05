"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Search } from "lucide-react";
import type { RedPacket } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListRefresh } from "@/components/list-refresh";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/table-pagination";
import { TableColumnSettings, useColumnLayout } from "@/components/table-column-settings";

function SortHeader({ label, column }: { label: string; column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) {
  return <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>{label} <ArrowUpDown /></Button>;
}

export function RedPacketsTable({ packets }: { packets: RedPacket[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const { columnOrder, columnVisibility, setColumnOrder, setColumnVisibility } = useColumnLayout("red-packets");

  const columns = useMemo<ColumnDef<RedPacket>[]>(() => [
    {
      id: "date",
      accessorFn: (row) => row.contest?.start_time?.slice(0, 10) ?? "",
      meta: { label: "日期" },
      header: ({ column }) => <SortHeader label="日期" column={column} />,
      cell: ({ getValue }) => <time className="font-mono text-xs">{getValue<string>() || "—"}</time>,
    },
    {
      id: "contest",
      accessorFn: (row) => row.contest?.title ?? "",
      meta: { label: "周赛" },
      header: ({ column }) => <SortHeader label="周赛" column={column} />,
    },
    {
      accessorKey: "member_name",
      meta: { label: "群友" },
      header: ({ column }) => <SortHeader label="群友" column={column} />,
      cell: ({ row }) => row.original.user_id
        ? <Link className="font-medium hover:text-primary hover:underline" href={`/users/${row.original.user_id}`}>{row.original.member_name}</Link>
        : <span className="font-medium">{row.original.member_name}</span>,
    },
    {
      accessorKey: "amount_rmb",
      meta: { label: "金额" },
      header: ({ column }) => <SortHeader label="金额" column={column} />,
      cell: ({ row }) => <span className="font-mono">{row.original.amount_rmb} 元</span>,
    },
  ], []);

  // TanStack Table returns a stateful instance whose methods are intentionally not memoizable.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: packets,
    columns,
    state: { sorting, globalFilter, columnOrder, columnVisibility },
    onSortingChange: setSorting,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  return <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
    <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder="搜索群友或周赛…" className="pl-8" aria-label="搜索周赛红包" /></div>
      <div className="flex items-center gap-2"><ListRefresh /><TableColumnSettings table={table} /><span className="whitespace-nowrap text-xs text-muted-foreground">{table.getFilteredRowModel().rows.length} 条</span></div>
    </div>

    <Table>
      <TableHeader>{table.getHeaderGroups().map((headerGroup) => <TableRow key={headerGroup.id}>{headerGroup.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
      <TableBody>{table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length} className="h-28 text-center text-muted-foreground">暂无红包记录。</TableCell></TableRow>}</TableBody>
    </Table>

    <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs text-muted-foreground">第 {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)} 页</span>
      <div className="flex items-center gap-2"><Select value={String(table.getState().pagination.pageSize)} onValueChange={(value) => table.setPageSize(Number(value))}><SelectTrigger size="sm" aria-label="每页显示数量"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">每页 10 条</SelectItem><SelectItem value="20">每页 20 条</SelectItem><SelectItem value="50">每页 50 条</SelectItem></SelectContent></Select><TablePagination pageIndex={table.getState().pagination.pageIndex} pageCount={table.getPageCount()} onPageChange={table.setPageIndex} /></div>
    </div>
  </div>;
}
