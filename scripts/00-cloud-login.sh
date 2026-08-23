#!/usr/bin/env bash

set -euo pipefail

for cli in vercel supabase; do
  if ! command -v "${cli}" >/dev/null 2>&1; then
    echo "error: ${cli} CLI is required." >&2
    exit 1
  fi
done

# Authenticate the CLIs themselves, rather than using a token inherited from
# the calling shell for this invocation only.
unset VERCEL_TOKEN SUPABASE_ACCESS_TOKEN

echo "Logging in to Vercel..."
vercel login

echo "Logging in to Supabase..."
supabase login

echo "Cloud CLI login complete."
