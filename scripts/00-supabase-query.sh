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

if [[ $# -ne 1 || -z "$1" ]]; then
  echo "usage: $0 '<sql or psql command>'" >&2
  echo "example: $0 '\\d'" >&2
  exit 1
fi

query="$1"

if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  if ! command -v psql >/dev/null 2>&1; then
    echo "error: psql is required when SUPABASE_DB_URL is set." >&2
    exit 1
  fi

  exec psql "${SUPABASE_DB_URL}" --set ON_ERROR_STOP=1 --command "${query}"
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "error: Supabase CLI is required when SUPABASE_DB_URL is not set." >&2
  exit 1
fi

if [[ ! -f supabase/.temp/project-ref ]]; then
  echo "error: set SUPABASE_DB_URL or run 'supabase link --project-ref <ref>' first." >&2
  exit 1
fi

# Management API queries accept SQL, but not psql meta-commands. Translate the
# common table-listing command so the linked-project fallback behaves like \d.
if [[ "${query}" == '\d' ]]; then
  query=$(cat <<'SQL'
select
  n.nspname as "Schema",
  c.relname as "Name",
  case c.relkind
    when 'r' then 'table'
    when 'p' then 'partitioned table'
    when 'v' then 'view'
    when 'm' then 'materialized view'
    when 'S' then 'sequence'
    when 'f' then 'foreign table'
  end as "Type",
  pg_get_userbyid(c.relowner) as "Owner"
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
  and n.nspname not in ('pg_catalog', 'information_schema')
  and n.nspname !~ '^pg_toast'
order by 1, 2;
SQL
  )
elif [[ "${query}" == \\* ]]; then
  echo "error: only the '\\d' psql meta-command is supported without SUPABASE_DB_URL." >&2
  exit 1
fi

exec supabase db query --linked "${query}"
