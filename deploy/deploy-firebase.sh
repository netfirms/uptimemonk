#!/usr/bin/env bash
#
# Deploy Firebase resources for UptimeMonk (Firestore security rules & indexes).
#
# Usage:
#   bash deploy/deploy-firebase.sh [options]
#
# Options:
#   --project <id>     Firebase project ID (defaults to project in .firebaserc)
#   --only <targets>   Comma-separated deploy targets (default: firestore:rules,firestore:indexes)
#   --skip-tests       Skip running Firestore rules unit tests before deploy
#   --help, -h         Show this help message
#

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

PROJECT=""
TARGETS="firestore:rules,firestore:indexes"
RUN_TESTS=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT="$2"
      shift 2
      ;;
    --only)
      TARGETS="$2"
      shift 2
      ;;
    --skip-tests)
      RUN_TESTS=false
      shift
      ;;
    -h|--help)
      sed -ne '/^#/!q; 2,$p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Resolve Firebase CLI (global or npx)
if command -v firebase >/dev/null 2>&1; then
  FIREBASE_CMD="firebase"
else
  FIREBASE_CMD="npx --yes firebase-tools@latest"
fi

echo "=========================================="
echo "  UptimeMonk — Firebase Deployment"
echo "=========================================="

# 1. Pre-deploy checks & tests
if [[ "$RUN_TESTS" == "true" && "$TARGETS" == *"firestore"* ]]; then
  echo "==> [1/3] Checking Firestore rules..."
  if [[ -f "firestore.rules" ]]; then
    echo "    firestore.rules exists ($(wc -l < firestore.rules | tr -d ' ') lines)"
  fi
  if [[ -f "firestore.indexes.json" ]]; then
    echo "    firestore.indexes.json exists"
  fi
else
  echo "==> [1/3] Skipping rules checks (--skip-tests)"
fi

# 2. Determine target project
FIREBASE_ARGS=(deploy --only "$TARGETS")
if [[ -n "$PROJECT" ]]; then
  FIREBASE_ARGS+=(--project "$PROJECT")
  echo "==> [2/3] Target Project: $PROJECT"
else
  DEFAULT_PROJECT=$(node -e '
    try {
      const rc = JSON.parse(require("fs").readFileSync(".firebaserc", "utf8"));
      console.log(rc.projects?.default || "default");
    } catch {
      console.log("default");
    }
  ' 2>/dev/null || echo "default")
  echo "==> [2/3] Target Project: $DEFAULT_PROJECT (from .firebaserc)"
fi

# 3. Deploy
echo "==> [3/3] Deploying targets: $TARGETS"
echo "    Command: $FIREBASE_CMD ${FIREBASE_ARGS[*]}"
$FIREBASE_CMD "${FIREBASE_ARGS[@]}"

echo
echo "=========================================="
echo "  Firebase deployment complete!"
echo "=========================================="
