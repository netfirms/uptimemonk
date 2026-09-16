#!/usr/bin/env bash
#
# Deploy UptimeMonk backend (API + Worker) to AWS Lightsail instances.
#
# Usage:
#   bash deploy/deploy-lightsail.sh [options] [ssh-host...]
#
# Arguments:
#   ssh-host               One or more SSH target hosts (e.g. ubuntu@47.129.253.94 or uptimemonk-worker-1).
#                          If not specified, reads from $LIGHTSAIL_HOSTS or $LIGHTSAIL_HOST.
#
# Options:
#   --skip-tests           Skip local tests before building and shipping
#   --no-restart-worker    Only restart uptimemonk-api, not the probe worker
#   --health-port <port>   Port for localhost healthcheck on remote host (default: 8080)
#   --help, -h             Show this help message
#

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

RUN_TESTS=true
RESTART_WORKER="${RESTART_WORKER:-auto}"
HEALTH_PORT=8080
HOSTS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-tests)
      RUN_TESTS=false
      shift
      ;;
    --no-restart-worker)
      RESTART_WORKER="no"
      shift
      ;;
    --health-port)
      HEALTH_PORT="$2"
      shift 2
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

# If no hosts specified on command line, fall back to environment variable
if [[ ${#HOSTS[@]} -eq 0 ]]; then
  if [[ -n "${LIGHTSAIL_HOSTS:-}" ]]; then
    read -r -a HOSTS <<< "$LIGHTSAIL_HOSTS"
  elif [[ -n "${LIGHTSAIL_HOST:-}" ]]; then
    HOSTS=("$LIGHTSAIL_HOST")
  fi
fi

# If still no hosts, provide clear error with example
if [[ ${#HOSTS[@]} -eq 0 ]]; then
  echo "Error: No target Lightsail host(s) specified." >&2
  echo "Usage: bash deploy/deploy-lightsail.sh [options] <ssh-host> [more-hosts...]" >&2
  echo "Or set LIGHTSAIL_HOST=ubuntu@<ip> in your environment." >&2
  echo "" >&2
  echo "Example:" >&2
  echo "  bash deploy/deploy-lightsail.sh ubuntu@47.129.253.94" >&2
  exit 1
fi

echo "=========================================="
echo "  UptimeMonk — AWS Lightsail Deployment"
echo "=========================================="
echo "Target hosts: ${HOSTS[*]}"
echo ""

# 1. Local Build & Test
echo "==> [1/4] Preparing server build..."
if [[ "$RUN_TESTS" == "true" ]]; then
  echo "    Running tests..."
  npm --prefix server test
else
  echo "    Skipping tests (--skip-tests)"
fi

echo "    Compiling TypeScript..."
npm --prefix server run build

# 2. Deploy to each Lightsail instance
for HOST in "${HOSTS[@]}"; do
  echo ""
  echo "==> [2/4] Shipping build to $HOST..."
  
  # Ensure remote temporary build dir exists
  ssh "$HOST" 'mkdir -p /tmp/uptimemonk-build'
  
  # Sync build artifacts & package manifests
  rsync -az --delete \
    --exclude node_modules \
    server/dist server/package.json server/package-lock.json \
    "$HOST:/tmp/uptimemonk-build/"

  echo "==> [3/4] Installing dependencies and restarting services on $HOST..."
  ssh "$HOST" 'sudo bash -s' <<REMOTE
set -euo pipefail
mkdir -p /opt/uptimemonk/server
rsync -a --delete /tmp/uptimemonk-build/ /opt/uptimemonk/server/
cd /opt/uptimemonk/server
npm ci --omit=dev --no-audit --no-fund
chown -R uptimemonk:uptimemonk /opt/uptimemonk

# Restart API
systemctl restart uptimemonk-api
REMOTE

  if [[ "$RESTART_WORKER" != "no" ]]; then
    echo "    Restarting uptimemonk-worker..."
    ssh "$HOST" 'sudo systemctl restart uptimemonk-worker'
  else
    echo "    Skipping worker restart (API only)"
  fi

  echo "==> [4/4] Verifying health on $HOST..."
  sleep 3
  if ssh "$HOST" "curl -fsS http://localhost:${HEALTH_PORT}/healthz" >/dev/null; then
    echo "    Health check: OK (200 OK on http://localhost:${HEALTH_PORT}/healthz)"
  else
    echo "    WARNING: Health check failed on $HOST!" >&2
    ssh "$HOST" 'sudo systemctl status uptimemonk-api --no-pager -l' >&2 || true
    exit 1
  fi

  echo "    Active services:"
  ssh "$HOST" 'systemctl is-active uptimemonk-api uptimemonk-worker' || true
done

echo ""
echo "=========================================="
echo "  Lightsail deployment complete!"
echo "=========================================="
