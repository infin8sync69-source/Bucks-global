#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-http://127.0.0.1:1420}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red() { printf "\033[31m%s\033[0m\n" "$*"; }

check_file() {
  local file="$1"
  if [[ -f "$ROOT_DIR/$file" ]]; then
    green "PASS file exists: $file"
  else
    red "FAIL missing file: $file"
    return 1
  fi
}

check_route() {
  local path="$1"
  local code
  code="$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL$path" || true)"
  if [[ "$code" == "200" ]]; then
    green "PASS route responds 200: $path"
  else
    red "FAIL route $path returned HTTP $code"
    return 1
  fi
}

echo "== Bucks Browser Primary Flow Smoke Test =="
echo "Root: $ROOT_DIR"
echo "App URL: $APP_URL"

echo "-- Static checks --"
check_file "src/routes/login/+page.svelte"
check_file "src/routes/feed/+page.svelte"
check_file "src/routes/create/+page.svelte"
check_file "src/routes/profile/+page.svelte"
check_file "src/routes/messages/+page.svelte"
check_file "src/routes/messages/[peerId]/+page.svelte"
check_file "src/routes/settings/+page.svelte"
check_file "src/routes/services/+page.svelte"
check_file "src/routes/notifications/+page.svelte"
check_file "tests/PRIMARY_USER_FLOW_TEST_CASES.md"

echo "-- Type check --"
(cd "$ROOT_DIR" && npm run check --silent >/dev/null)
green "PASS npm run check"

echo "-- Runtime route checks --"
if curl -sSf "$APP_URL" >/dev/null 2>&1; then
  check_route "/"
  check_route "/login"
  check_route "/feed"
  check_route "/create"
  check_route "/profile"
  check_route "/messages"
  check_route "/messages/test-peer"
  check_route "/settings"
  check_route "/services"
  check_route "/notifications"
else
  yellow "SKIP runtime checks (dev server not reachable at $APP_URL)"
  yellow "Start server with: npm run launch:browser"
fi

green "Smoke test completed."
