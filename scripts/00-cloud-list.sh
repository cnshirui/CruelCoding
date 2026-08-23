#!/usr/bin/env bash

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

status=0

echo "Vercel projects (current scope)"
if ! npx --yes vercel@59.3.0 project ls --limit 100 --no-color; then
  echo "error: unable to list Vercel projects; run 'npx vercel login' and try again." >&2
  status=1
fi

echo
echo "Supabase projects"
if ! npx --yes supabase@2.115.0 projects list --output pretty; then
  echo "error: unable to list Supabase projects; run 'npx supabase login' and try again." >&2
  status=1
fi

exit "${status}"
