#!/usr/bin/env bash

set -euo pipefail

readonly PORT=3400

pids="$(lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "${pids}" ]]; then
  echo "Stopping process listening on port ${PORT}: ${pids//$'\n'/ }"
  kill ${pids}

  for _ in {1..20}; do
    if ! lsof -tiTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done
fi

echo "Starting Next.js on http://localhost:${PORT}"
exec npm run dev -- --port "${PORT}"
