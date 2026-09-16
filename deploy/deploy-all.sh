#!/usr/bin/env bash
#
# Unified Deployment Script for UptimeMonk
# Deploys Firebase (Firestore rules/indexes) and AWS Lightsail (API/Worker fleet).
#
# Usage:
#   bash deploy/deploy-all.sh [options] [lightsail-host...]
#
# Options:
#   --all                  Deploy both Firebase and AWS Lightsail (default)
#   --firebase             Deploy Firebase only
#   --lightsail            Deploy AWS Lightsail only
#   --project <id>         Firebase project ID (defaults to .firebaserc)
#   --skip-tests           Skip pre-deploy tests
#   --no-restart-worker    Skip restarting the probe worker on Lightsail (API only)
#   --help, -h             Show this help message
#
# Examples:
#   # Deploy both Firebase and a Lightsail worker
#   bash deploy/deploy-all.sh ubuntu@47.129.253.94
#
#   # Deploy Firebase only
#   bash deploy/deploy-all.sh --firebase
#
#   # Deploy Lightsail only
#   bash deploy/deploy-all.sh --lightsail ubuntu@47.129.253.94
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

DEPLOY_TARGET="all"
SKIP_TESTS=false
FIREBASE_PROJECT=""
NO_RESTART_WORKER=false
HOSTS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)
      DEPLOY_TARGET="all"
      shift
      ;;
    --firebase)
      DEPLOY_TARGET="firebase"
      shift
      ;;
    --lightsail)
      DEPLOY_TARGET="lightsail"
      shift
      ;;
    --project)
      FIREBASE_PROJECT="$2"
      shift 2
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --no-restart-worker)
      NO_RESTART_WORKER=true
      shift
      ;;
    -h|--help)
      sed -ne '/^#/!q; 2,$p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
    *)
      HOSTS+=("$1")
      shift
      ;;
  esac
done

echo "========================================================"
echo "          UptimeMonk — Unified Deployment"
echo "========================================================"
echo "Mode: $DEPLOY_TARGET"

# 1. Firebase deployment
if [[ "$DEPLOY_TARGET" == "all" || "$DEPLOY_TARGET" == "firebase" ]]; then
  echo ""
  echo ">>> [Phase 1] Firebase Deployment"
  FB_ARGS=()
  if [[ "$SKIP_TESTS" == "true" ]]; then
    FB_ARGS+=(--skip-tests)
  fi
  if [[ -n "$FIREBASE_PROJECT" ]]; then
    FB_ARGS+=(--project "$FIREBASE_PROJECT")
  fi
  bash "$SCRIPT_DIR/deploy-firebase.sh" "${FB_ARGS[@]}"
fi

# 2. AWS Lightsail deployment
if [[ "$DEPLOY_TARGET" == "all" || "$DEPLOY_TARGET" == "lightsail" ]]; then
  echo ""
  echo ">>> [Phase 2] AWS Lightsail Deployment"
  LS_ARGS=()
  if [[ "$SKIP_TESTS" == "true" ]]; then
    LS_ARGS+=(--skip-tests)
  fi
  if [[ "$NO_RESTART_WORKER" == "true" ]]; then
    LS_ARGS+=(--no-restart-worker)
  fi
  if [[ ${#HOSTS[@]} -gt 0 ]]; then
    LS_ARGS+=("${HOSTS[@]}")
  fi
  bash "$SCRIPT_DIR/deploy-lightsail.sh" "${LS_ARGS[@]}"
fi

echo ""
echo "========================================================"
echo "          All requested deployments finished!"
echo "========================================================"
