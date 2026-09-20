#!/usr/bin/env bash
# hosts.sh — the inventory: which machines exist and what is true about them.
#
# One KEY=VALUE file per host under infra/hosts/. Kept deliberately dumber than
# an Ansible inventory: these are plain env files, so the same values a human
# reads are the ones the scripts source, with no parser in between.
set -euo pipefail

HOSTS_DIR="${HOSTS_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../hosts" && pwd)}"

# list_hosts — declared host names, one per line.
list_hosts() {
  local file
  for file in "${HOSTS_DIR}"/*.env; do
    [[ -e "${file}" ]] || continue
    basename "${file}" .env
  done
}

# host_file <name> — path to a host's file, or a hard error naming what exists.
host_file() {
  local name="$1"
  local file="${HOSTS_DIR}/${name}.env"
  if [[ ! -f "${file}" ]]; then
    die "Unknown host '${name}'. Declared: $(list_hosts | tr '\n' ' ')"
  fi
  printf '%s' "${file}"
}

# load_host <name> — export the host's facts, without clobbering anything the
# caller already set: an explicit flag or a shell variable must win over the
# file, which is what makes `--host production --domain other.example` work.
load_host() {
  local name="$1"
  local file
  file="$(host_file "${name}")"

  local line key value
  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ "${line}" =~ ^[[:space:]]*# ]] && continue
    [[ "${line}" =~ ^[[:space:]]*$ ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    key="${key//[[:space:]]/}"
    [[ -z "${key}" ]] && continue
    if [[ -z "${!key:-}" ]]; then
      export "${key}=${value}"
    fi
  done < "${file}"

  ok "Loaded host '${name}' (${SSH_HOST:-no ssh target})"
}
