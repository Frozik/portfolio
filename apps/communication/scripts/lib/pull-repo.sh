#!/usr/bin/env bash
# pull-repo.sh — sync /opt/communication to latest origin/main.
#
# Uses `fetch + reset --hard` rather than `pull --ff-only` so a
# force-pushed amend on origin (which the portfolio's solo workflow
# leans on) does not stall the deploy with `Not possible to
# fast-forward`.
#
# `production.toml` is install-rendered (see render-toml-configs.sh)
# but tracked in git as a stripped-down stub — `git reset --hard`
# would otherwise clobber the rendered values (CORS origins, ports,
# TURN URLs). We back it up across the reset so the local rendered
# copy survives every upgrade. install.sh still re-renders it from
# scratch on a fresh deploy.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

USER_NAME="communication"
TARGET_DIR="/opt/communication"
PROD_TOML="${TARGET_DIR}/apps/communication/config/production.toml"

if [[ ! -d "${TARGET_DIR}/.git" ]]; then
  die "${TARGET_DIR} is not a git checkout — run install.sh first"
fi

prod_toml_backup=""
if [[ -f "${PROD_TOML}" ]]; then
  prod_toml_backup="$(mktemp /tmp/production.toml.XXXXXX)"
  cp "${PROD_TOML}" "${prod_toml_backup}"
  info "Stashed rendered production.toml at ${prod_toml_backup}"
fi

info "git fetch + reset --hard origin/main (force-push resilient)"
sudo -u "${USER_NAME}" -H git -C "${TARGET_DIR}" fetch --depth=1 origin main
sudo -u "${USER_NAME}" -H git -C "${TARGET_DIR}" reset --hard origin/main

if [[ -n "${prod_toml_backup}" && -s "${prod_toml_backup}" ]]; then
  cp "${prod_toml_backup}" "${PROD_TOML}"
  chown "${USER_NAME}:${USER_NAME}" "${PROD_TOML}"
  rm -f "${prod_toml_backup}"
  ok "Restored rendered production.toml"
fi

ok "Repository updated to $(sudo -u "${USER_NAME}" -H git -C "${TARGET_DIR}" rev-parse --short HEAD)"
