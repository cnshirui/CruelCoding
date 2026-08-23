#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "error: npx is required (Node.js 22+)." >&2
  exit 1
fi

args=(--yes supabase@2.115.0 db push --yes)
if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  args+=(--db-url "${SUPABASE_DB_URL}")
else
  if [[ ! -f supabase/.temp/project-ref ]]; then
    echo "error: set SUPABASE_DB_URL or run 'npx supabase link --project-ref <ref>' first." >&2
    exit 1
  fi
  args+=(--linked)
fi

echo "Checking pending Supabase migrations..."
npx "${args[@]}" --dry-run

echo "Applying Supabase migrations..."
npx "${args[@]}"

echo "Migration complete."
