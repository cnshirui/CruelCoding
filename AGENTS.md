# Project Instructions

## Browser

- For browser-based work in this repository, use the Chrome profile named `cruel`.
- When multiple Chrome extension connections exist, list them and select the one whose metadata `profileName` is exactly `cruel`; do not rely on the default Chrome connection.
- Do not use another Chrome profile or the in-app browser unless the user explicitly requests it.

## Tables

- Use TanStack Table with the project’s shadcn/ui primitives for every list table and data table.
- Every list table must support sorting, search, refresh, and pagination.
- Use TanStack Table state and row models for sorting, filtering/search, and pagination; use shadcn/ui controls for the corresponding interface.
- Refresh actions must clearly communicate loading, success, and error states and update the displayed table data without requiring a manual page reload.
- Reuse components from `components/ui` instead of creating ad hoc table, input, button, select, badge, or avatar primitives.
