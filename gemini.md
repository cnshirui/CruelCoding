# Gemini Interaction Summary

## Initial Request
**Date:** January 4, 2026
**Goal:** Create a sortable scoreboard HTML page (`index.html`) using data from a public GitHub repository.

**Requirements:**
1.  **Source Data:**
    -   Scoreboard Excel file: `index.xlsx`
    -   CruelID mapping: `id.in`
    -   CruelDate mapping: `In.txt`
2.  **Functionality:**
    -   Fetch data directly from GitHub.
    -   Parse the Excel file in the browser (using SheetJS).
    -   Map `CruelID` and `CruelDate` to the corresponding usernames.
    -   Render a sortable HTML table.
    -   Implement search/filtering by username.
3.  **Constraints:**
    -   Frontend-only (HTML + JavaScript).
    -   No backend.
    -   Must work on GitHub Pages.

## Fixes & Iterations

### 1. CORS Issue Resolution
**Problem:** The initial implementation used `github.com/wisdompeak/...` and `cdn.jsdelivr.net/...` links which caused Cross-Origin Resource Sharing (CORS) errors in the browser.
**Solution:** Switched to using `raw.githubusercontent.com` URLs, which support CORS headers (`Access-Control-Allow-Origin: *`).

### 2. UI/UX Improvements
**Requirements:**
-   **Column Order:** Move `CruelID` and `CruelDate` to the 2nd and 3rd columns respectively.
-   **Typography:** Use a clear font (monospace) to distinguish between characters like lowercase 'l' and uppercase 'I'.
-   **Data Cleaning:** Remove footer rows from the Excel data (e.g., legends, disclaimers) that do not contain rank information.

**Implementation Details:**
-   **Columns:** Reordered table headers and row generation logic.
-   **Font:** Applied a CSS class `.clear-font` using a font stack of `JetBrains Mono`, `Consolas`, `monospace` to relevant columns.
-   **Filtering:** Added a keyword check to stop parsing the Excel file when footer text (e.g., "-1: absent/zero") is encountered.

### 3. Localization & Formatting
**Requirements:**
-   **Rename:** Change page title and heading to "残酷刷题群".
-   **Simplify UI:** Remove the search box.
-   **Date Formatting:** Change `CruelDate` format from `MM/DD/YYYY` to `YYYY-MM-DD`.

**Implementation Details:**
-   Updated HTML tags (`<title>`, `<h1>`) and removed search-related code.
-   Added date parsing logic in the JavaScript `fetchData` function to reformat strings using split/join and padding.

### 4. Further Data Cleaning & Layout Enhancements
**Requirements:**
-   **Remove Artifacts:** Filter out rows containing "ranking-figure" and "curve-figure" which appeared at the bottom of the table.
-   **Layout Stability:** Prevent text wrapping in cells and ensure the table supports horizontal scrolling as more weeks (columns) are added.
-   **Sort Indicators:** Show visual indicators (▲/▼) in table headers to denote the active sort column and direction.

**Implementation Details:**
-   **Filtering:** Updated `footerKeywords` to include "ranking-figure" and "curve-figure", checking both rank and username columns.
-   **CSS:** Added `white-space: nowrap` to `th, td` and wrapped the table in a `div` with `overflow-x: auto`.
-   **Sorting UI:** Added CSS for `.sort-asc` and `.sort-desc` classes and updated the JavaScript `sortTable` and `renderTableHeaders` functions to apply these classes dynamically.

### 5. Tab System & Daily Check-in Feature
**Requirements:**
-   **Tabs:** Create two tabs: "残酷排行榜" (Scoreboard) and "每日打卡" (Daily Check-in).
-   **Daily Data:** Fetch daily question data from a Google Sheet and merge with LeetCode question details (Title, Link, Tags, Difficulty).
-   **Layout:** Minimized UI with left-aligned controls and compact table columns.

**Implementation Details:**
-   **Tabs:** Implemented a tab switching mechanism.
-   **Data Fetching:**
    -   Fetched Google Sheet CSV via `corsproxy.io`.
    -   Fetched LeetCode question metadata from a raw GitHub JSON file (`leetcode_questions.json`) to bypass CORS.
    -   Merged data to populate columns: Date, ID, Question, Tags, Level, Difficulty, YouTube.
-   **Data Processing:**
    -   Converted Excel serial dates (e.g., 46037) to `YYYY-MM-DD`.
    -   Prioritized Tags from the spreadsheet columns.
    -   Truncated Question titles to 50 characters.
-   **UI/CSS:**
    -   Set column widths to `0.1%` with `white-space: nowrap` for maximum compactness.
    -   Made the Daily table sortable with proper numeric and date sorting.
    -   Refined spacing and alignment for buttons and tabs.

## Final Output
A single, self-contained `index.html` file that:
-   Loads dependencies (SheetJS) via CDN.
-   Fetches raw data files from GitHub.
-   Processes and merges data in the browser.
-   Displays a clean, sortable leaderboard named "残酷刷题群" with standardized date formats.
-   Supports horizontal scrolling and clear sort indicators.
-   Includes a "Daily Check-in" tab with data fetched from Google Sheets and LeetCode, featuring robust sorting and date formatting.
