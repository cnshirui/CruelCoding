"use client";

import { useEffect, useId, useState } from "react";
import { type Column, type ColumnOrderState, type RowData, type Table, type VisibilityState } from "@tanstack/react-table";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, RotateCcw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Human-readable name shown in the column settings list (headers are often render functions). */
    label?: string;
    /** Fixed pixel width used by tables that render a <colgroup>. */
    width?: number;
  }
}

type StoredLayout = { order?: unknown; visibility?: unknown };

/**
 * Column order + visibility state for one table, persisted per `storageKey` in localStorage.
 * The first render always uses the defaults so server and client markup match; the saved layout is applied after mount.
 */
export function useColumnLayout(storageKey: string) {
  const key = `table-layout:${storageKey}`;
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredLayout;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating persisted layout after mount is the point of this effect
        if (Array.isArray(parsed.order) && parsed.order.every((id) => typeof id === "string")) setColumnOrder(parsed.order as string[]);
        if (parsed.visibility && typeof parsed.visibility === "object") setColumnVisibility(parsed.visibility as VisibilityState);
      }
    } catch {
      // Storage can be unavailable (private mode, blocked site data); defaults are fine.
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      if (!columnOrder.length && !Object.keys(columnVisibility).length) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify({ order: columnOrder, visibility: columnVisibility }));
    } catch {
      // Ignore write failures; the layout still works for the current session.
    }
  }, [columnOrder, columnVisibility, key, loaded]);

  return { columnOrder, columnVisibility, setColumnOrder, setColumnVisibility };
}

function rootColumn<T>(column: Column<T>): Column<T> {
  let current = column;
  while (current.parent) current = current.parent;
  return current;
}

/** Top-level columns (groups count as one item) in the table's current display order, hidden ones included. */
function orderedRootColumns<T>(table: Table<T>) {
  const seen = new Set<string>();
  const roots: Column<T>[] = [];
  for (const leaf of table.getAllLeafColumns()) {
    const root = rootColumn(leaf);
    if (!seen.has(root.id)) { seen.add(root.id); roots.push(root); }
  }
  return roots;
}

function columnLabel<T>(column: Column<T>) {
  const { meta, header } = column.columnDef;
  return meta?.label ?? (typeof header === "string" && header ? header : column.id);
}

function setColumnVisible<T>(table: Table<T>, column: Column<T>, visible: boolean) {
  table.setColumnVisibility((current) => ({ ...current, ...Object.fromEntries(column.getLeafColumns().map((leaf) => [leaf.id, visible])) }));
}

function SortableColumnItem<T>({ table, column, lockVisible }: { table: Table<T>; column: Column<T>; lockVisible: boolean }) {
  const id = useId();
  const label = columnLabel(column);
  const visible = column.getIsVisible();
  const canHide = column.getLeafColumns().every((leaf) => leaf.getCanHide()) && !(visible && lockVisible);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });

  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`column-settings-item${isDragging ? " dragging" : ""}`}>
    <button type="button" ref={setActivatorNodeRef} className="column-settings-handle" aria-label={`拖动调整“${label}”的位置`} {...attributes} {...listeners}><GripVertical aria-hidden="true" /></button>
    <Checkbox id={id} checked={visible} disabled={!canHide} onCheckedChange={(checked) => setColumnVisible(table, column, checked === true)} aria-label={`显示“${label}”列`} />
    <label htmlFor={id}>{label}</label>
  </li>;
}

export function TableColumnSettings<T>({ table, size = "sm" }: { table: Table<T>; size?: "sm" | "default" }) {
  const dndId = useId();
  const columns = orderedRootColumns(table);
  const visibleCount = columns.filter((column) => column.getIsVisible()).length;
  const customized = table.getState().columnOrder.length > 0 || Object.keys(table.getState().columnVisibility).length > 0;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = columns.findIndex((column) => column.id === active.id);
    const to = columns.findIndex((column) => column.id === over.id);
    if (from < 0 || to < 0) return;
    table.setColumnOrder(arrayMove(columns, from, to).flatMap((column) => column.getLeafColumns().map((leaf) => leaf.id)));
  }

  function reset() {
    table.resetColumnOrder(true);
    table.resetColumnVisibility(true);
  }

  return <Popover>
    <PopoverTrigger asChild><Button variant="outline" size={size} type="button" aria-label="列设置"><Settings2 aria-hidden="true" />列设置</Button></PopoverTrigger>
    <PopoverContent align="end" className="column-settings">
      <PopoverHeader><PopoverTitle>列设置</PopoverTitle><PopoverDescription>勾选控制显示，拖动手柄调整顺序。</PopoverDescription></PopoverHeader>
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onDragEnd}>
        <SortableContext items={columns.map((column) => column.id)} strategy={verticalListSortingStrategy}>
          <ul className="column-settings-list" aria-label="表格列">
            {columns.map((column) => <SortableColumnItem key={column.id} table={table} column={column} lockVisible={visibleCount <= 1} />)}
          </ul>
        </SortableContext>
      </DndContext>
      <div className="column-settings-footer"><span>{visibleCount} / {columns.length} 列显示中</span><Button variant="ghost" size="xs" type="button" onClick={reset} disabled={!customized}><RotateCcw aria-hidden="true" />重置</Button></div>
    </PopoverContent>
  </Popover>;
}
