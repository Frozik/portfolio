#!/usr/bin/env bash
# parse-args.sh — CLI argument parsing for install.sh / upgrade.sh.
#
# Exports: SSH_HOST, GOOGLE_OAUTH_CLIENT_ID, CERT_EMAIL,
# EDGE_HAPROXY_ENABLED, COMMUNICATION_DOMAIN.

set -euo pipefail

SSH_HOST="${SSH_HOST:-}"
GOOGLE_OAUTH_CLIENT_ID="${GOOGLE_OAUTH_CLIENT_ID:-}"
# Yandex OAuth — both fields optional. When unset, the Yandex sign-in
# path stays disabled and the server rejects handshakes for that
# provider as `auth/invalid-token`.
YANDEX_OAUTH_CLIENT_ID="${YANDEX_OAUTH_CLIENT_ID:-}"
YANDEX_OAUTH_CLIENT_SECRET="${YANDEX_OAUTH_CLIENT_SECRET:-}"
CERT_EMAIL="${CERT_EMAIL:-}"
EDGE_HAPROXY_ENABLED="${EDGE_HAPROXY_ENABLED:-true}"
COMMUNICATION_DOMAIN="${COMMUNICATION_DOMAIN:-}"
COMMUNICATION_CORS_ORIGINS="${COMMUNICATION_CORS_ORIGINS:-}"
INSTALL_REDIS="${INSTALL_REDIS:-true}"
HARDEN_SSH="${HARDEN_SSH:-true}"

usage_install() {
  cat >&2 <<USAGE
Usage: install.sh --ssh-host <user@host> --google-client-id <ID> --cert-email <EMAIL>
                  [--no-haproxy] [--domain <DOMAIN>]

Required:
  --ssh-host          SSH target (e.g. root@1.2.3.4)
  --google-client-id  Google OAuth 2.0 Web Client ID
  --cert-email        Email for Lets Encrypt notices

Optional:
  --no-haproxy        Disable HAProxy SNI router (coturn binds public TLS)
  --no-redis          Skip the local redis-server install (single-node deploys)
  --no-harden-ssh     Keep password SSH login enabled (default: disable)
  --domain            Override domain (default: <IP>.sslip.io)
  --cors-origin       Add a CORS-allowed origin (repeatable; default:
                      https://frozik.github.io,http://localhost:5173)
  --yandex-client-id      Yandex OAuth application ID (public — written to
                          the rendered TOML override).
  --yandex-client-secret  Yandex OAuth client_secret (sensitive — only
                          written to the systemd EnvironmentFile, never
                          to a TOML or any committed artifact).
USAGE
}

usage_upgrade() {
  cat >&2 <<USAGE
Usage: upgrade.sh --ssh-host <user@host> [--no-haproxy] [--no-redis] [--domain <DOMAIN>]

Required:
  --ssh-host          SSH target

Optional:
  --no-haproxy        Disable HAProxy SNI router
  --no-redis          Skip the local redis-server install
  --domain            Override domain
USAGE
}

_parse_common() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --ssh-host)
        SSH_HOST="$2"; shift 2;;
      --google-client-id)
        GOOGLE_OAUTH_CLIENT_ID="$2"; shift 2;;
      --yandex-client-id)
        YANDEX_OAUTH_CLIENT_ID="$2"; shift 2;;
      --yandex-client-secret)
        YANDEX_OAUTH_CLIENT_SECRET="$2"; shift 2;;
      --cert-email)
        CERT_EMAIL="$2"; shift 2;;
      --no-haproxy)
        EDGE_HAPROXY_ENABLED="false"; shift;;
      --no-redis)
        INSTALL_REDIS="false"; shift;;
      --no-harden-ssh)
        HARDEN_SSH="false"; shift;;
      --domain)
        COMMUNICATION_DOMAIN="$2"; shift 2;;
      --cors-origin)
        if [[ -z "${COMMUNICATION_CORS_ORIGINS}" ]]; then
          COMMUNICATION_CORS_ORIGINS="$2"
        else
          COMMUNICATION_CORS_ORIGINS="${COMMUNICATION_CORS_ORIGINS},$2"
        fi
        shift 2;;
      -h|--help)
        return 1;;
      *)
        err "Unknown flag: $1"; return 1;;
    esac
  done
  return 0
}

parse_install_args() {
  if ! _parse_common "$@"; then
    usage_install
    exit 2
  fi
}

parse_upgrade_args() {
  if ! _parse_common "$@"; then
    usage_upgrade
    exit 2
  fi
}

validate_install_args() {
  local missing=()
  [[ -z "${SSH_HOST}" ]]                && missing+=("--ssh-host")
  [[ -z "${GOOGLE_OAUTH_CLIENT_ID}" ]]  && missing+=("--google-client-id")
  [[ -z "${CERT_EMAIL}" ]]              && missing+=("--cert-email")
  if [[ ${#missing[@]} -gt 0 ]]; then
    err "Missing required arguments: ${missing[*]}"
    usage_install
    exit 2
  fi
  # Yandex pair: either both empty (provider disabled) or both set.
  if [[ -n "${YANDEX_OAUTH_CLIENT_ID}" && -z "${YANDEX_OAUTH_CLIENT_SECRET}" ]]; then
    err "--yandex-client-id was provided without --yandex-client-secret"
    usage_install
    exit 2
  fi
  if [[ -z "${YANDEX_OAUTH_CLIENT_ID}" && -n "${YANDEX_OAUTH_CLIENT_SECRET}" ]]; then
    err "--yandex-client-secret was provided without --yandex-client-id"
    usage_install
    exit 2
  fi
  export SSH_HOST GOOGLE_OAUTH_CLIENT_ID YANDEX_OAUTH_CLIENT_ID YANDEX_OAUTH_CLIENT_SECRET \
    CERT_EMAIL EDGE_HAPROXY_ENABLED COMMUNICATION_DOMAIN COMMUNICATION_CORS_ORIGINS INSTALL_REDIS HARDEN_SSH
}

validate_upgrade_args() {
  if [[ -z "${SSH_HOST}" ]]; then
    err "Missing required argument: --ssh-host"
    usage_upgrade
    exit 2
  fi
  export SSH_HOST EDGE_HAPROXY_ENABLED COMMUNICATION_DOMAIN INSTALL_REDIS
}
