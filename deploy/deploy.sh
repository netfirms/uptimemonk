#!/usr/bin/env bash
#
# Backward-compatible wrapper for Lightsail deployment.
# Usage: bash deploy/deploy.sh [options] <host> [more-hosts...]

exec "$(dirname "$0")/deploy-lightsail.sh" "$@"
