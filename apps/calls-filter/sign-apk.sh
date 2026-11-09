#!/usr/bin/env bash
# Signs a built APK with the release key, so Google accepts it as the OAuth client registered
# for the release certificate. Without the key (CI, a fresh machine) the APK keeps prebuild's
# debug signature and nothing fails.
#
#   sign-apk.sh [apk]
#
# The key: $CALLS_FILTER_KEYSTORE, else ~/calls-filter-release.keystore. Its password:
# $CALLS_FILTER_KEYSTORE_PASSWORD, else the macOS Keychain item «calls-filter-keystore».
set -euo pipefail

cd "$(dirname "$0")"
apk="${1:-android/app/build/outputs/apk/release/app-release.apk}"
keystore="${CALLS_FILTER_KEYSTORE:-$HOME/calls-filter-release.keystore}"
alias_name=calls-filter

if [[ ! -f "$keystore" ]]; then
  echo "No release key at $keystore: the APK keeps the debug signature."
  exit 0
fi

if [[ -z "${CALLS_FILTER_KEYSTORE_PASSWORD:-}" ]]; then
  if ! CALLS_FILTER_KEYSTORE_PASSWORD="$(security find-generic-password -a "$USER" -s calls-filter-keystore -w 2>/dev/null)"; then
    echo "Set CALLS_FILTER_KEYSTORE_PASSWORD or add the Keychain item «calls-filter-keystore»." >&2
    exit 1
  fi
fi
export CALLS_FILTER_KEYSTORE_PASSWORD

build_tools="$(find "${ANDROID_HOME:?ANDROID_HOME is not set}/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
"$build_tools/apksigner" sign \
  --ks "$keystore" \
  --ks-key-alias "$alias_name" \
  --ks-pass env:CALLS_FILTER_KEYSTORE_PASSWORD \
  "$apk"
"$build_tools/apksigner" verify --print-certs "$apk" | grep 'SHA-256 digest'
