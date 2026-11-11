#!/usr/bin/env bash
# Signs a built APK with the release key, so Google accepts it as the OAuth client registered
# for the release certificate. Without the key (CI, a fresh machine) the APK keeps prebuild's
# debug signature and nothing fails.
#
#   sign-apk.sh [apk]
#
# The key: $VAULT_KEYSTORE, else ~/ciphra-keys/ciphra-vault.keystore. Its password:
# $VAULT_KEYSTORE_PASSWORD, else the macOS Keychain item «ciphra-vault-keystore».
set -euo pipefail

cd "$(dirname "$0")"
apk="${1:-android/app/build/outputs/apk/release/app-release.apk}"
keystore="${VAULT_KEYSTORE:-$HOME/ciphra-keys/ciphra-vault.keystore}"
alias_name="${VAULT_KEY_ALIAS:-ciphra-vault}"

if [[ ! -f "$keystore" ]]; then
  echo "No release key at $keystore: the APK keeps the debug signature."
  exit 0
fi

if [[ -z "${VAULT_KEYSTORE_PASSWORD:-}" ]]; then
  if ! VAULT_KEYSTORE_PASSWORD="$(security find-generic-password -a "$USER" -s ciphra-vault-keystore -w 2>/dev/null)"; then
    echo "Set VAULT_KEYSTORE_PASSWORD or add the Keychain item «ciphra-vault-keystore»." >&2
    exit 1
  fi
fi
export VAULT_KEYSTORE_PASSWORD

build_tools="$(find "${ANDROID_HOME:?ANDROID_HOME is not set}/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
"$build_tools/apksigner" sign \
  --ks "$keystore" \
  --ks-key-alias "$alias_name" \
  --ks-pass env:VAULT_KEYSTORE_PASSWORD \
  "$apk"
"$build_tools/apksigner" verify --print-certs "$apk" | grep 'SHA-256 digest'
