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
- Reuse components from `components/ui` instead of creating ad hoc table, input, button, select, badge, or avatar primitives.
