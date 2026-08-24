"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { type ColumnDef, type SortingState, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { ArrowUpDown, ChevronRight, Search } from "lucide-react";
import type { LeaderboardMember } from "@/lib/types";
import type { ContestDates } from "@/lib/supabase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function contestRankBand(rank: number | null) {
  if (rank === null || rank <= 0) return "";
  if (rank < 500) return "contest-rank-dark-green";
  if (rank < 5_000) return "contest-rank-green";
  if (rank < 10_000) return "contest-rank-yellow";
  return "contest-rank-pink";
}

function SortHeader({ label, column }: { label: string; column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) {
  return <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>{label}<ArrowUpDown /></Button>;
}

function ContestDate({ value }: { value: string }) {
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }).format(new Date(value));
  return <time dateTime={value} suppressHydrationWarning>{date} · PDT</time>;
}

export function Leaderboard({ members, contestDates }: { members: LeaderboardMember[]; contestDates: ContestDates }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "score", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [visibleContestCount, setVisibleContestCount] = useState(3);
  const activeMembers = useMemo(() => members.filter((member) => member.status !== "inactive"), [members]);
  const allContests = useMemo(() => [...new Set(activeMembers.flatMap((member) => member.contests.map((contest) => contest.contest)))].toSorted((a, b) => b - a), [activeMembers]);
  const visibleContests = useMemo(() => allContests.slice(0, visibleContestCount), [allContests, visibleContestCount]);
  const tableWidth = 622 + visibleContests.length * 184;
  const columns = useMemo<ColumnDef<LeaderboardMember>[]>(() => [
    { id: "position", header: "#", cell: ({ row, table }) => { const position = table.getSortedRowModel().rows.findIndex((candidate) => candidate.id === row.id) + 1; return <span className={position <= 3 ? `podium podium-${position}` : "rank"}>{position}</span>; }, enableSorting: false },
    { accessorKey: "cruel_id", header: ({ column }) => <SortHeader label="CruelID" column={column} />, cell: ({ row }) => <Link className="member" href={`/users/${row.original.user_id}`}><Avatar className="size-7"><AvatarFallback>{row.original.cruel_id.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><span>{row.original.cruel_id}</span></Link> },
    { accessorKey: "cruel_date", header: ({ column }) => <SortHeader label="CruelDate" column={column} />, cell: ({ row }) => <time dateTime={row.original.cruel_date}>{row.original.cruel_date}</time> },
    { accessorKey: "days", header: ({ column }) => <SortHeader label="Days" column={column} />, cell: ({ row }) => row.original.days.toLocaleString() },
    { accessorKey: "rating", header: ({ column }) => <SortHeader label="Rating" column={column} />, cell: ({ row }) => row.original.rating && row.original.rating > 0 ? row.original.rating.toLocaleString() : "—" },
    { accessorKey: "score", header: ({ column }) => <SortHeader label="Score" column={column} />, cell: ({ row }) => <strong>{row.original.score.toFixed(1)}</strong> },
    ...visibleContests.map((contest): ColumnDef<LeaderboardMember> => ({
      id: `contest-${contest}`,
      header: () => <span className="contest-table-heading"><strong>Weekly {contest}</strong>{contestDates[contest] ? <ContestDate value={contestDates[contest]} /> : <small>PDT</small>}</span>,
      columns: [
        { id: `contest-${contest}-rank`, header: "Rank", cell: ({ row }) => { const result = row.original.contests.find((entry) => entry.contest === contest); return <span className={`contest-rank-badge ${contestRankBand(result?.rank ?? null)}`}>{result?.rank ? result.rank.toLocaleString() : "—"}</span>; }, enableSorting: false },
        { id: `contest-${contest}-score`, header: "Score", cell: ({ row }) => { const result = row.original.contests.find((entry) => entry.contest === contest); return result ? result.score.toFixed(1) : "—"; }, enableSorting: false },
      ],
    })),
  ], [contestDates, visibleContests]);

  // TanStack Table returns a stateful instance whose methods are intentionally not memoizable.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: activeMembers, columns, state: { sorting, globalFilter }, onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), globalFilterFn: (row, _id, value) => [row.original.cruel_id, row.original.wechat_name, row.original.subgroup].some((field) => field?.toLowerCase().includes(String(value).trim().toLowerCase())) });

  return <div className="board leaderboard-board" style={{ width: `${tableWidth}px` }}>
    <div className="leaderboard-toolbar"><div className="leaderboard-search"><Search aria-hidden="true" /><Input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder="搜索 CruelID、姓名或分组…" aria-label="搜索排行榜" /></div><div className="leaderboard-toolbar-actions"><Badge variant="outline">{table.getFilteredRowModel().rows.length} 位群友</Badge>{visibleContestCount < allContests.length ? <Button variant="outline" size="sm" onClick={() => setVisibleContestCount((count) => Math.min(count + 3, allContests.length))}>显示更多周赛<ChevronRight aria-hidden="true" /></Button> : null}</div></div>
    <Table className="leaderboard-table" style={{ width: `${tableWidth}px` }}><colgroup><col className="rank-col" /><col className="member-col" /><col className="date-col" /><col className="days-col" /><col className="rating-col" /><col className="score-col" />{visibleContests.flatMap((contest) => [<col className="contest-rank-col" key={`${contest}-rank`} />, <col className="contest-score-col" key={`${contest}-score`} />])}</colgroup><TableHeader>{table.getHeaderGroups().map((group, groupIndex) => <TableRow key={group.id}>{group.headers.map((header) => {
      const grouped = header.column.columns.length > 0;
      if (groupIndex === 1 && !header.column.parent) return null;
      return <TableHead key={header.id} colSpan={grouped ? header.colSpan : 1} rowSpan={groupIndex === 0 && !grouped ? 2 : 1} scope={grouped ? "colgroup" : "col"}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>;
    })}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length} className="h-32 text-center text-muted-foreground">没有找到匹配的群友。</TableCell></TableRow>}</TableBody></Table>
  </div>;
}
