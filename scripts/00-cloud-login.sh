#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat >&2 <<USAGE
usage: $0 [profile]

  profile  Optional account name. When given, the CLIs use per-account credential
           stores instead of the default ones:
             Vercel   ~/.vercel/<profile>              (via --global-config)
             Supabase ~/.supabase/profiles/<profile>.yaml (via --profile)
           Other scripts must pass the same flags to use this account.
USAGE
}

if [[ $# -gt 1 ]]; then
  usage
  exit 2
fi

profile="${1:-}"
if [[ "${profile}" == "-h" || "${profile}" == "--help" ]]; then
  usage
  exit 0
fi

for cli in vercel supabase; do
  if ! command -v "${cli}" >/dev/null 2>&1; then
    echo "error: ${cli} CLI is required." >&2
    exit 1
  fi
done

# Authenticate the CLIs themselves, rather than using a token inherited from
# the calling shell for this invocation only.
unset VERCEL_TOKEN SUPABASE_ACCESS_TOKEN

vercel_args=()
supabase_args=()

if [[ -n "${profile}" ]]; then
  if [[ ! "${profile}" =~ ^[A-Za-z0-9._-]+$ ]]; then
    echo "error: profile name '${profile}' may only contain letters, digits, '.', '_' and '-'." >&2
    exit 2
  fi

  vercel_dir="${HOME}/.vercel/${profile}"
  supabase_profile="${HOME}/.supabase/profiles/${profile}.yaml"

  mkdir -p "${vercel_dir}"

  # The Supabase CLI resolves --profile as a file path, not a profile name.
  # Create the profile file on first use so each account keeps its own token slot.
  if [[ ! -f "${supabase_profile}" ]]; then
    mkdir -p "$(dirname "${supabase_profile}")"
    cat > "${supabase_profile}" <<PROFILE
# Supabase CLI profile for the ${profile} account.
# Use with: supabase --profile ${supabase_profile} <command>
# Each profile keeps its own credential slot, so this account can stay logged in
# alongside the other profiles without either one clobbering the other.
name: ${profile}
api_url: https://api.supabase.com
dashboard_url: https://supabase.com/dashboard
project_host: supabase.co
pooler_host: pooler.supabase.com
PROFILE
    chmod 600 "${supabase_profile}"
    echo "Created Supabase profile ${supabase_profile}"
  fi

  vercel_args=(--global-config "${vercel_dir}")
  supabase_args=(--profile "${supabase_profile}")
  echo "Using profile '${profile}'"
  echo "  Vercel:   ${vercel_dir}"
  echo "  Supabase: ${supabase_profile}"
fi

# ${arr[@]+"${arr[@]}"} keeps 'set -u' happy on the bash 3.2 that ships with macOS
# when the array is empty.
echo "Logging in to Vercel..."
vercel ${vercel_args[@]+"${vercel_args[@]}"} login
echo "Vercel account: $(vercel ${vercel_args[@]+"${vercel_args[@]}"} whoami 2>/dev/null || echo unknown)"

echo "Logging in to Supabase..."
supabase ${supabase_args[@]+"${supabase_args[@]}"} login

echo "Cloud CLI login complete."
