#!/usr/bin/env bash
# trim-packages.sh — stop paying for hardware this machine does not have.
#
# Every daemon below serves mobile modems, multipath SAN, removable media,
# batteries, VMware tooling, GPUs, thermal zones or iSCSI targets. On a
# headless KVM guest they only hold RSS and widen the attack surface.
#
# Two tiers, because `ubuntu-server-minimal` depends on some of them and
# purging those would drag out `linux-generic` with it — which is how kernel
# updates arrive. Those are masked instead: the daemon never starts, the
# dependency graph stays intact.
#
# Deliberately untouched: cloud-init (owns the network config, the provider
# may re-run it), unattended-upgrades (security patches), rsyslog (plain-text
# fallback to the journal), qemu-guest-agent (this really is a KVM guest),
# lvm2 (touches the initramfs for no real gain), kernel headers (removing them
# takes `linux-generic` and therefore kernel updates).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../lib/common.sh
source "${SCRIPT_DIR}/../../lib/common.sh"

# Nothing installed depends on these, so they can go entirely.
PURGE=(
  modemmanager
  packagekit
  packagekit-tools
  udisks2
  upower
  open-vm-tools
  thermald
)

# Pulled in by ubuntu-server-minimal: keep the package, kill the daemon.
MASK=(
  multipathd.service
  snapd.service
  snapd.socket
  snapd.seeded.service
  snapd.autoimport.service
  iscsid.service
  open-iscsi.service
  gpu-manager.service
  apport.service
  pollinate.service
)

INSTALLED=()
for pkg in "${PURGE[@]}"; do
  if dpkg-query -W -f '${Status}' "${pkg}" 2>/dev/null | grep -q "^install ok installed"; then
    INSTALLED+=("${pkg}")
  fi
done

if [[ ${#INSTALLED[@]} -eq 0 ]]; then
  ok "No purgeable packages left"
else
  info "Purging: ${INSTALLED[*]}"
  DEBIAN_FRONTEND=noninteractive apt-get purge -y -qq "${INSTALLED[@]}"
fi

for unit in "${MASK[@]}"; do
  if systemctl list-unit-files "${unit}" --no-legend 2>/dev/null | grep -q .; then
    systemctl disable --now "${unit}" >/dev/null 2>&1 || true
    systemctl mask "${unit}" >/dev/null 2>&1 || true
    info "masked ${unit}"
  fi
done

info "Removing orphaned dependencies"
DEBIAN_FRONTEND=noninteractive apt-get autoremove --purge -y -qq
info "Clearing the package cache"
apt-get clean

ok "Trim complete"
