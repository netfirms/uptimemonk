#!/usr/bin/env bash
#
# One-time provisioning for an UptimeMonk *worker* — one Lightsail instance
# (Ubuntu 24.04 LTS). The system scales out by running more of these; each one
# is provisioned identically and differs only by its worker identity in
# /etc/uptimemonk/env.
#
# Run as root on a fresh instance.
#
#   scp -r deploy/ ubuntu@<ip>:/tmp/ && ssh ubuntu@<ip> 'sudo bash /tmp/deploy/provision.sh'
#
# What it deliberately does NOT do: fetch secrets, or open the firewall. The
# Lightsail console firewall sits outside the OS and survives a compromised
# host, so it is the primary control and yours to set.

set -euo pipefail

APP_DIR=/opt/uptimemonk
DATA_DIR=/var/lib/uptimemonk
CONF_DIR=/etc/uptimemonk

echo "==> System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg ufw fail2ban unattended-upgrades iputils-ping

echo "==> Node.js 22"
if ! command -v node >/dev/null || [[ "$(node -v)" != v22.* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi



echo "==> Caddy"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy
fi

echo "==> Service user and directories"
id -u uptimemonk >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin uptimemonk
mkdir -p "$APP_DIR" "$DATA_DIR" "$CONF_DIR"
chown -R uptimemonk:uptimemonk "$DATA_DIR"
chmod 750 "$DATA_DIR"
# 0750 root:uptimemonk — the service user must be able to traverse into this
# directory to read the bind-mounted key, but nobody else should.
chown root:uptimemonk "$CONF_DIR"
chmod 750 "$CONF_DIR"

echo "==> Swap"
# Lightsail's smaller plans ship with no swap at all, which turns a brief
# memory spike into an OOM kill of the worker — i.e. monitoring stops. A swap
# file is not a substitute for RAM, but it is the difference between a slow
# minute and a dead process.
RAM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [[ "$RAM_MB" -lt 1024 && ! -f /swapfile ]]; then
  echo "    ${RAM_MB} MB RAM detected — creating a 1 GB swap file"
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Prefer reclaiming cache over swapping the probe pool out.
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-uptimemonk-swap.conf
  sysctl -p /etc/sysctl.d/99-uptimemonk-swap.conf >/dev/null
else
  echo "    ${RAM_MB} MB RAM — no swap file needed"
fi

echo "==> Unprivileged ICMP"
# Lets `ping` use a datagram socket instead of a raw one. This is why the
# service needs no capabilities and can keep NoNewPrivileges=true, which would
# otherwise block ping's setuid fallback.
cat > /etc/sysctl.d/99-uptimemonk-ping.conf <<'SYSCTL'
net.ipv4.ping_group_range = 0 2147483647
SYSCTL
sysctl -p /etc/sysctl.d/99-uptimemonk-ping.conf >/dev/null

echo "==> Host firewall (defence in depth; Lightsail's own firewall is primary)"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

echo "==> SSH hardening"
cat > /etc/ssh/sshd_config.d/99-uptimemonk.conf <<'SSHD'
PasswordAuthentication no
PermitRootLogin no
KbdInteractiveAuthentication no
SSHD
systemctl reload ssh || systemctl reload sshd || true

echo "==> Unattended security upgrades"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT

echo "==> journald rate limiting"
# A probe failure loop must not be able to fill a 40 GB disk with logs.
mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/uptimemonk.conf <<'JRNL'
[Journal]
SystemMaxUse=2G
RateLimitIntervalSec=30s
RateLimitBurst=5000
JRNL
systemctl restart systemd-journald

echo "==> systemd units"
DEPLOY_DIR="$(dirname "$0")"
install -m 644 "$DEPLOY_DIR/uptimemonk-worker.service" /etc/systemd/system/
install -m 644 "$DEPLOY_DIR/uptimemonk-api.service" /etc/systemd/system/
# Clean up any leftover container units from a previous deployment.
rm -f /etc/containers/systemd/uptimemonk-worker.container \
      /etc/containers/systemd/uptimemonk-api.container
systemctl daemon-reload

echo
echo "Provisioning done. Remaining steps, which need your secrets:"
echo "  1. cp deploy/uptimemonk.env.example $CONF_DIR/env && chmod 600 $CONF_DIR/env"
echo "     …then fill it in."
echo "  2. Install the GCP service-account key:"
echo "       sudo install -m 440 -o root -g uptimemonk key.json $CONF_DIR/sa.json"
echo "     Group-readable rather than 0400: systemd LoadCredential reads it as"
echo "     root, but the container bind-mounts it and reads as the service user."
echo "     It needs roles/datastore.user and nothing else."
echo "  3. Deploy the build:  bash deploy/deploy.sh <host>"
echo "  4. Enforce IMDSv2 from your workstation:"
echo "     aws lightsail update-instance-metadata-options \\"
echo "       --instance-name <name> --http-tokens required"
echo "  5. Point Caddy at your domain and reload it."
echo
echo "Adding a worker later: provision it the same way, then raise"
echo "UPTIMEMONK_WORKER_COUNT on EVERY worker in the region and restart them."
echo "They must agree, or some organisations get probed twice and others never."
