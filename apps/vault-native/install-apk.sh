#!/usr/bin/env bash
# Signs the APK with the release key when this machine has it (sign-apk.sh) and installs it over
# the app on the device, keeping its vaults. An app signed with the other key does not take the
# update, so that one is uninstalled first, its vaults with it.
#
#   install-apk.sh [apk]
set -euo pipefail

cd "$(dirname "$0")"
apk="${1:-android/app/build/outputs/apk/release/app-release.apk}"
package=io.github.ciphravault.vault

./sign-apk.sh "$apk"
if ! output="$(adb install -r "$apk" 2>&1)"; then
  if [[ "$output" != *INSTALL_FAILED_UPDATE_INCOMPATIBLE* ]]; then
    echo "$output" >&2
    exit 1
  fi
  echo "The installed app is signed with the other key: uninstalling it and its vaults."
  adb uninstall "$package"
  adb install "$apk"
fi
