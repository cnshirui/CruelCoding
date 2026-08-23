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

target="${1:-preview}"
case "${target}" in
  preview) environment="preview" ;;
  production|prod) environment="production" ;;
  *) echo "usage: $0 [preview|production]" >&2; exit 2 ;;
esac

run_vercel() {
  if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    npx --yes vercel@56.5.0 "$@" --token "${VERCEL_TOKEN}"
  else
    npx --yes vercel@56.5.0 "$@"
  fi
}

build_command=(build)
deploy_command=(deploy --prebuilt --yes --no-wait --format=json)

if [[ "${environment}" == "production" ]]; then
  build_command+=(--prod)
  deploy_command+=(--prod)
fi

if [[ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]]; then
  build_command+=(--build-env "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}")
  deploy_command+=(--env "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}")
fi
if [[ -n "${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}" ]]; then
  build_command+=(--build-env "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}")
  deploy_command+=(--env "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}")
fi
if [[ -n "${NEXT_PUBLIC_SITE_URL:-}" ]]; then
  runtime_env_args+=(--env "NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}")
  build_env_args+=(--build-env "NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}")
fi

echo "Pulling Vercel ${environment} settings..."
run_vercel pull --yes --environment="${environment}"

echo "Building the ${environment} deployment..."
run_vercel "${build_command[@]}"

echo "Deploying prebuilt output..."
deployment_json="$(run_vercel "${deploy_command[@]}")"
deployment_id="$(node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); process.stdout.write(d.deployment.id)' <<<"${deployment_json}")"
deployment_url="$(node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); process.stdout.write(d.deployment.url)' <<<"${deployment_json}")"

echo "Deployment created: ${deployment_url}"

for _ in {1..30}; do
  deployment_status_json="$(run_vercel api "/v13/deployments/${deployment_id}")"
  ready_state="$(node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); process.stdout.write(d.readyState || d.status || "UNKNOWN")' <<<"${deployment_status_json}")"

  case "${ready_state}" in
    READY)
      echo "Deployment complete: ${deployment_url}"
      exit 0
      ;;
    BLOCKED|CANCELED|ERROR)
      failure_reason="$(node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); process.stdout.write(d.readyStateReason || d.errorMessage || "No reason returned by Vercel.")' <<<"${deployment_status_json}")"
      echo "error: Vercel deployment ${ready_state}: ${failure_reason}" >&2
      exit 1
      ;;
  esac

  echo "Vercel deployment state: ${ready_state}"
  sleep 2
done

echo "error: timed out waiting for Vercel deployment: ${deployment_url}" >&2
exit 1
