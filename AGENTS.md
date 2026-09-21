# Project Instructions

## Browser

- For browser-based work in this repository, use the Chrome profile named `cruel`.
- When multiple Chrome extension connections exist, list them and select the one whose metadata `profileName` is exactly `cruel`; do not rely on the default Chrome connection.
- Do not use another Chrome profile or the in-app browser unless the user explicitly requests it.

## Tables

- Use TanStack Table with the project’s shadcn/ui primitives for every list table and data table.
- Every list table must support sorting, search, and refresh. Non-member list tables must also support pagination; active-member lists must show the complete active set without pagination.
- Use TanStack Table state and row models for sorting and filtering/search, plus pagination where required; use shadcn/ui controls for the corresponding interface.
- When pagination is required, it must show at most three page-number buttons at a time and include `<<` for the first page, `<` for the previous page, `>` for the next page, and `>>` for the last page. Keep the current page centered among the three page numbers when possible, and provide accessible labels for every navigation control.
- Refresh actions must clearly communicate loading, success, and error states and update the displayed table data without requiring a manual page reload.
- Every list table must support column visibility and column reordering. Implement both with TanStack Table state (`columnVisibility`, `columnOrder`) through the shared `TableColumnSettings` component and `useColumnLayout` hook in `components/table-column-settings.tsx`; the picker UI uses the shadcn/ui Popover (or DropdownMenu) primitives and the drag-and-drop ordering uses dnd-kit. Give every column a `meta.label` so it has a readable name in the picker. Do not hand-roll drag logic or introduce another DnD library.
- Reuse components from `components/ui` instead of creating ad hoc table, input, button, select, badge, avatar, popover, dropdown, or checkbox primitives.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
