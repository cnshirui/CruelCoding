#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if ! command -v npx >/dev/null 2>&1; then
  echo "error: npx is required (Node.js 22+)." >&2
  exit 1
fi

target="${1:-preview}"
case "${target}" in
  preview) environment="preview" ;;
  production|prod) environment="production" ;;
  *) echo "usage: $0 [preview|production]" >&2; exit 2 ;;
esac

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git_author_email="$(git log -1 --format=%ae 2>/dev/null || true)"
  if [[ "${git_author_email}" == *.local ]]; then
    cat >&2 <<EOF
error: the current Git commit uses the local-only author email ${git_author_email}.
Vercel cannot authorize that commit author for this team's project.

Configure this repository with the email connected to your Vercel/Git provider account,
then create a new commit (recommended) or explicitly amend the current commit before deploying.
EOF
    exit 1
  fi
fi

run_vercel() {
  local cli_version="${VERCEL_CLI_VERSION:-59.3.0}"
  if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    npx --yes "vercel@${cli_version}" "$@" --token "${VERCEL_TOKEN}"
  else
    npx --yes "vercel@${cli_version}" "$@"
  fi
}

deploy_command=(deploy --yes --no-wait --json)

if [[ "${environment}" == "production" ]]; then
  deploy_command+=(--prod)
fi

echo "Pulling Vercel ${environment} settings..."
run_vercel pull --yes --environment="${environment}"

echo "Uploading source for a Vercel Node.js 24 remote build..."
deployment_json="$(run_vercel "${deploy_command[@]}")"
deployment_id="$(node -e '
  const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const id = d.deployment?.id || d.id;
  if (typeof id !== "string") process.exit(1);
  process.stdout.write(id);
' <<<"${deployment_json}")" || {
  echo "error: Vercel did not return a deployment ID." >&2
  exit 1
}
deployment_url="$(node -e '
  const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const url = d.deployment?.url || d.url;
  if (typeof url !== "string") process.exit(1);
  process.stdout.write(url.startsWith("http") ? url : `https://${url}`);
' <<<"${deployment_json}")" || {
  echo "error: Vercel returned an unrecognized deployment response." >&2
  exit 1
}

if [[ ! "${deployment_url}" =~ ^https://[^[:space:]]+$ ]]; then
  echo "error: Vercel did not return a valid deployment URL." >&2
  exit 1
fi

echo "Deployment created: ${deployment_url}"

echo "Waiting for the Vercel build to finish..."
if ! deployment_status_json="$(run_vercel inspect "${deployment_url}" --wait --timeout 5m --json)"; then
  echo "error: Vercel deployment did not complete successfully: ${deployment_url}" >&2
  run_vercel inspect "${deployment_url}" --logs || true
  exit 1
fi

ready_state="$(node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); process.stdout.write(d.readyState || d.status || d.deployment?.readyState || "UNKNOWN")' <<<"${deployment_status_json}")"
if [[ "${ready_state}" != "READY" ]]; then
  failure_reason="$(node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); process.stdout.write(d.readyStateReason || d.errorMessage || d.deployment?.readyStateReason || "")' <<<"${deployment_status_json}")"
  if [[ -z "${failure_reason}" ]]; then
    deployment_api_json="$(run_vercel api "/v13/deployments/${deployment_id}" 2>/dev/null || true)"
    failure_reason="$(node -e 'try { const d=JSON.parse(require("fs").readFileSync(0,"utf8")); process.stdout.write(d.readyStateReason || d.errorMessage || ""); } catch {}' <<<"${deployment_api_json}")"
  fi
  failure_reason="${failure_reason:-No reason returned by Vercel.}"
  echo "error: Vercel deployment ${ready_state}: ${failure_reason}" >&2
  exit 1
fi

echo "Deployment complete: ${deployment_url}"
