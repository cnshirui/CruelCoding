#!/usr/bin/env bash

set -uo pipefail

for cli in vercel supabase; do
  if ! command -v "${cli}" >/dev/null 2>&1; then
    echo "error: ${cli} CLI is required." >&2
    exit 1
  fi
done

# Remove persisted CLI credentials even when the calling shell has temporary
# token overrides configured.
unset VERCEL_TOKEN SUPABASE_ACCESS_TOKEN

status=0

echo "Logging out of Vercel..."
if ! vercel logout; then
  echo "error: failed to log out of Vercel." >&2
  status=1
fi

echo "Logging out of Supabase..."
if ! supabase logout; then
  echo "error: failed to log out of Supabase." >&2
  status=1
fi

if [[ "${status}" -eq 0 ]]; then
  echo "Cloud CLI logout complete."
fi

exit "${status}"
