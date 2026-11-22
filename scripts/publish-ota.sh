#!/usr/bin/env bash
# Publish one JS-only OTA to every app version still on phones, both platforms.
# Run from a clean worktree at origin/main, after `npm ci`, with the owner's yes.
# Usage: scripts/publish-ota.sh "<message>"
# Edit SHOPPER_VERSIONS / BUSINESS_VERSIONS to match CLAUDE_HANDOFF.md section 1.
# Each older version is published by setting app.json "version" temporarily; the
# file is restored with git checkout afterwards (never commit that change).
set -euo pipefail
MSG="${1:?Usage: scripts/publish-ota.sh \"<message>\"}"
SHOPPER_VERSIONS="1.0.3 1.0.2 1.0.1"
BUSINESS_VERSIONS="1.0.2 1.0.1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[ -z "$(git status --porcelain)" ] || { echo "Working tree not clean; commit or stash first."; exit 1; }
git fetch origin -q
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "HEAD is not origin/main. Publish from main only."; exit 1; }
publish() {
  local app="$1"; shift
  cd "$ROOT/apps/$app"
  trap 'git checkout -q app.json' RETURN
  for v in "$@"; do
    sed -i "0,/\"version\": \"[0-9.]*\"/s//\"version\": \"$v\"/" app.json
    for p in android ios; do
      echo "=== $app $v $p"
      npx --yes eas-cli@24.11.0 update --channel production --environment production --platform "$p" --non-interactive --message "$MSG" 2>&1 | grep -E "Runtime version|Update group ID|update ID|rror"
    done
  done
}
publish shopper $SHOPPER_VERSIONS
publish retailer $BUSINESS_VERSIONS
echo "Done. Record every group ID in CLAUDE_HANDOFF.md."
