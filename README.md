# Cruel Coding

A Next.js leaderboard for the 残酷刷题群 community, deployed on Vercel and backed by Supabase.

## Local setup

1. Use Node.js 22 or newer and run `npm install`.
2. Copy `.env.example` to `.env.local` and add the project URL and publishable key from Supabase's Connect panel.
3. Apply `supabase/migrations/20260823000000_create_leaderboard.sql` in the Supabase SQL editor (or with the Supabase CLI).
4. Add a Supabase secret key to `SUPABASE_SECRET_KEY`, then run `npm run data:import` once. This key is server-only and must never use a `NEXT_PUBLIC_` prefix.
5. Run `npm run dev`.

Without Supabase environment variables the app uses `data/leaderboard.json`, a generated preview snapshot. `npm run data:snapshot` downloads the three canonical source files and refreshes it.

## Vercel

Import the repository in Vercel and add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the server-only `SUPABASE_SECRET_KEY` to Development, Preview, and Production. The secret key is used by the `/api/checkins` route and must never use a `NEXT_PUBLIC_` prefix.

## Daily check-in REST API

Daily check-ins are stored in `public.daily_checkins`. Apply the migrations before using the API. Writes are performed server-side, and an HttpOnly ownership cookie limits update/delete operations to the browser that created the record.

```text
GET    /api/checkins?date=2026-08-23&cruel_id=example
POST   /api/checkins              { "cruel_id": "example", "checkin_date": "2026-08-23", "note": "done" }
PATCH  /api/checkins?id=1         { "note": "updated" }
DELETE /api/checkins?id=1
```

## Release scripts

Copy `.env.example` to `.env` and fill in the values. The scripts load `.env` automatically; `.env` is gitignored and must never be committed.

```bash
# Apply every pending file in supabase/migrations.
./scripts/00-db-migrate.sh

# Create a preview deployment; pass production to deploy to production.
./scripts/01-vercel-deploy.sh preview
./scripts/01-vercel-deploy.sh production

# Sync data/users.csv to Supabase Auth, then download and conditionally import scoreboard sources.
./scripts/02-data-import.mjs

# Rebuild only data/leaderboard.json, without touching Supabase.
./scripts/02-data-import.mjs --snapshot-only
```

The importer stores the SHA-256 of each source plus a combined SHA-256 in `scoreboard_snapshots`. If the combined hash already exists, it exits without writing. A changed source is imported atomically through one database function; `--force` may be used to call the import path even when checking manually.

## Authentication

Email/password and Google login use Supabase Auth with server-side cookies. Public email/password signup is disabled. Approved password accounts are provisioned from the gitignored `data/users.csv` file. Both `./scripts/02-data-import.mjs` and `npm run auth:import` synchronize these accounts; rerunning either updates passwords and metadata for existing emails. The app never exposes `SUPABASE_SECRET_KEY` to the browser.

To enable Google login:

1. Create a Google OAuth client of type **Web application**. Add the app origin (for example `https://cruelcoding.com`) under authorized JavaScript origins and copy the Supabase callback URL shown on the Supabase Google provider page into Google's authorized redirect URIs.
2. In Supabase, open **Authentication → Sign In / Providers → Google**, enter that client ID and secret, and enable the provider.
3. In **Authentication → URL Configuration**, set the production Site URL and add `http://localhost:3400/auth/callback` plus `https://cruelcoding.com/auth/callback` to the redirect allow list.
4. Set `NEXT_PUBLIC_SITE_URL` to the matching origin in each environment. Do not include a trailing slash.

## Automated scoreboard refresh

`.github/workflows/refresh-scoreboard.yml` checks the upstream scoreboard data
every six hours and imports it only when the tracked `gh-pages` revision changes.
Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` under **Settings → Secrets and
variables → Actions**. The workflow needs permission to write repository
contents so it can record the successfully imported submodule revision and
generated fallback snapshot.
