#!/usr/bin/env bash
# common.sh — shared helpers for communication install/upgrade scripts.
#
# Sourced by orchestrators and every sub-script under lib/.
# Callers MUST also `set -euo pipefail` themselves; we re-apply it here as
# a defensive measure (sourcing does not propagate `set` from the caller).

set -euo pipefail

# Colored output (no-op when stdout is not a TTY — keeps CI logs clean).
if [[ -t 1 ]]; then
  COMMON_BLUE=$'\033[0;34m'
  COMMON_GREEN=$'\033[0;32m'
  COMMON_YELLOW=$'\033[0;33m'
  COMMON_RED=$'\033[0;31m'
  COMMON_RESET=$'\033[0m'
else
  COMMON_BLUE=''
  COMMON_GREEN=''
  COMMON_YELLOW=''
  COMMON_RED=''
  COMMON_RESET=''
fi

info() { printf '%s>%s %s\n' "${COMMON_BLUE}" "${COMMON_RESET}" "$*"; }
ok()   { printf '%s+%s %s\n' "${COMMON_GREEN}" "${COMMON_RESET}" "$*"; }
warn() { printf '%s!%s %s\n' "${COMMON_YELLOW}" "${COMMON_RESET}" "$*"; }
err()  { printf '%sx%s %s\n' "${COMMON_RED}" "${COMMON_RESET}" "$*" >&2; }
die()  { err "$*"; exit 1; }

# require_env VAR_NAME — die if the named env var is unset or empty.
require_env() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "${value}" ]]; then
    die "Required environment variable '${name}' is not set"
  fi
}

# Default error trap — every script that sources us inherits this.
# Sub-scripts may override with their own message.
trap 'err "Failed in ${BASH_SOURCE[0]:-$0} at line ${LINENO}"' ERR
