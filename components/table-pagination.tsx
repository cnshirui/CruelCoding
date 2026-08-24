"use client";

import { Button } from "@/components/ui/button";

function visiblePageNumbers(current: number, total: number) {
  if (total <= 3) return Array.from({ length: total }, (_, index) => index);
  const start = Math.min(Math.max(current - 1, 0), total - 3);
  return [start, start + 1, start + 2];
}

export function TablePagination({
  pageIndex,
  pageCount,
  onPageChange,
}: {
  pageIndex: number;
  pageCount: number;
  onPageChange: (pageIndex: number) => void;
}) {
  const total = Math.max(pageCount, 1);
  const current = Math.min(pageIndex, total - 1);
  const canPrevious = current > 0;
  const canNext = current < total - 1;

  return (
    <nav className="table-page-buttons" aria-label="分页导航">
      <Button variant="outline" size="icon-sm" onClick={() => onPageChange(0)} disabled={!canPrevious} aria-label="第一页">&lt;&lt;</Button>
      <Button variant="outline" size="icon-sm" onClick={() => onPageChange(current - 1)} disabled={!canPrevious} aria-label="上一页">&lt;</Button>
      {visiblePageNumbers(current, total).map((page) => (
        <Button key={page} variant={page === current ? "default" : "outline"} size="icon-sm" onClick={() => onPageChange(page)} aria-label={`第 ${page + 1} 页`} aria-current={page === current ? "page" : undefined}>{page + 1}</Button>
      ))}
      <Button variant="outline" size="icon-sm" onClick={() => onPageChange(current + 1)} disabled={!canNext} aria-label="下一页">&gt;</Button>
      <Button variant="outline" size="icon-sm" onClick={() => onPageChange(total - 1)} disabled={!canNext} aria-label="最后一页">&gt;&gt;</Button>
    </nav>
  );
}
