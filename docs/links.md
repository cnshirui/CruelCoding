# Leaderboard links and data mapping

The sortable leaderboard is rendered by the application home page. It supports
searching by CruelID and sorting by CruelID, CruelDate, Days, Rating, and Score.

## Canonical sources

- [Leaderboard workbook (`index.xlsx`)](https://github.com/wisdompeak/lc-score-board/raw/refs/heads/gh-pages/generateEXCEL/index.xlsx)
- [CruelID list (`id.in`)](https://github.com/wisdompeak/lc-score-board/raw/refs/heads/gh-pages/getRank/id.in)
- [CruelDate membership list (`In.txt`)](https://github.com/wisdompeak/lc-score-board/raw/refs/heads/gh-pages/generateEXCEL/Data/Members/In.txt)
- [Reference Google Sheet](https://docs.google.com/spreadsheets/d/1kBGyRsSdbGDu7DzjQcC-UkZjZERdrP8-_QyVGXHSrB8/edit?pli=1&gid=0#gid=0)

## Mapping

`scripts/build-scoreboard.py` creates `data/leaderboard.json` from the three
vendored source files:

| Web field | Source |
| --- | --- |
| CruelID | A case-insensitive match between the workbook username and `getRank/id.in` |
| CruelDate | The `MM/DD/YYYY` date beside the matching username in `Members/In.txt`, normalized to `YYYY-MM-DD` |
| Group | The optional subgroup after CruelDate in `Members/In.txt` |
| Days, Rating, Score, contest history | `generateEXCEL/index.xlsx` |

Every workbook user must have both a CruelID and CruelDate match. Snapshot
generation fails instead of silently publishing an incomplete row when either
mapping is missing.

## Refresh

After updating the vendored source files, regenerate the static fallback data:

```bash
npm run data:snapshot
```

The application reads Supabase when configured and otherwise renders this
generated snapshot.

The `Refresh scoreboard data` GitHub Actions workflow checks the upstream
`gh-pages` branch every six hours. When its commit changes, the workflow:

1. updates the `lc-score-board` submodule;
2. rebuilds `data/leaderboard.json` (which also validates the mappings);
3. imports the latest profile data into Supabase; and
4. commits the imported submodule revision and generated snapshot.

Configure these repository Actions secrets before enabling the workflow:

- `SUPABASE_URL`: the project URL;
- `SUPABASE_SECRET_KEY`: a server-only Supabase secret key.

The workflow can also be run manually from the Actions page. Its `force`
option repeats the import without requiring a new upstream commit.
