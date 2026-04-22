#!/usr/bin/env bash
# upgrade.sh — pull the latest code, rebuild and restart the signaling
# service. Expects install.sh to have been run previously.
#
# Run as root:
#   sudo bash /opt/retro-signaling/apps/retro-signaling/scripts/upgrade.sh

set -euo pipefail

SIGNALING_USER="signaling"
SIGNALING_HOME="/opt/retro-signaling"
SERVICE_NAME="webrtc-signaling"

if [[ -t 1 ]]; then
  BLUE=$'\033[0;34m'; GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; RESET=$'\033[0m'
else
  BLUE=''; GREEN=''; RED=''; RESET=''
fi
info() { printf '%s▸%s %s\n' "${BLUE}" "${RESET}" "$*"; }
ok()   { printf '%s✓%s %s\n' "${GREEN}" "${RESET}" "$*"; }
die()  { printf '%s✗%s %s\n' "${RED}" "${RESET}" "$*" >&2; exit 1; }

if [[ $EUID -ne 0 ]]; then
  die "Run as root: sudo bash $0"
fi

if [[ ! -d "${SIGNALING_HOME}/.git" ]]; then
  die "No git repository found in ${SIGNALING_HOME}. Run install.sh first"
fi

info "Pulling latest code"
sudo -u "${SIGNALING_USER}" -H bash -c \
  "cd '${SIGNALING_HOME}' && git pull --ff-only"

info "Reinstalling dependencies"
sudo -u "${SIGNALING_USER}" -H bash -c \
  "cd '${SIGNALING_HOME}' && pnpm install --frozen-lockfile"

info "Rebuilding"
sudo -u "${SIGNALING_USER}" -H bash -c \
  "cd '${SIGNALING_HOME}' && pnpm --filter @frozik/retro-signaling run build"

info "Restarting service"
systemctl restart "${SERVICE_NAME}"

sleep 1
if systemctl is-active --quiet "${SERVICE_NAME}"; then
  ok "Service ${SERVICE_NAME} is active"
  ok "Upgrade complete"
else
  die "Service failed to start. Check logs: journalctl -u ${SERVICE_NAME} -n 50"
fi
