#!/usr/bin/env bash
#
# Build the image (unless one is provided), bring up the stack, run the
# Playwright E2E, then tear everything down. Used by CI and for local runs.
#
#   tests/homelab/e2e/run.sh                 # builds actual:e2e from this branch
#   ACTUAL_IMAGE=ghcr.io/fattyatom/actual:26.6.0 SKIP_BUILD=1 tests/homelab/e2e/run.sh
set -eu

E2E_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$E2E_DIR/../../.." && pwd)" # tests/homelab/e2e -> repo root
export ACTUAL_IMAGE="${ACTUAL_IMAGE:-actual:e2e}"

if [ "${SKIP_BUILD:-}" != "1" ]; then
  echo "==> Building $ACTUAL_IMAGE"
  docker build -f "$REPO_ROOT/Dockerfile.homelab" -t "$ACTUAL_IMAGE" "$REPO_ROOT"
fi

cd "$E2E_DIR"
cleanup() { docker compose down -v >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> Starting stack"
docker compose up -d

echo "==> Waiting for the app to answer on :8080"
ok=0
for _ in $(seq 1 60); do
  if curl -fsS http://localhost:8080/ >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done
if [ "$ok" -ne 1 ]; then
  echo "FAIL: app did not become reachable" >&2
  docker compose logs --tail=50 >&2 || true
  exit 1
fi

# Warm the server's account DB. The first hit to /account/needs-bootstrap (and
# /info) initializes the account database, which is slow on a cold container —
# slow enough that the in-app server-URL validation times out on the first try.
# Pre-warming makes the onboarding deterministic on attempt 1.
echo "==> Warming the server (account DB init)"
for p in /info /account/needs-bootstrap /needs-bootstrap; do
  curl -fsS "http://localhost:8080$p" >/dev/null 2>&1 || true
done

if [ -f package-lock.json ]; then npm ci; else npm install; fi
npx playwright install --with-deps chromium
npm test
