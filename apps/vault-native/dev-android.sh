#!/usr/bin/env bash
# The app as it is now, on the running emulator, open on the test vault (dev/test-vault.mts,
# master password `test-vault-1234`): a release APK for the emulator's ABI installed over the one
# there, keeping its vaults, then the vault unlocked — or opened from a file on the first run.
#
#   dev-android.sh [--no-build]
set -euo pipefail

cd "$(dirname "$0")"
apk=android/app/build/outputs/apk/release/app-release.apk

if [[ "$(adb get-state 2>/dev/null)" != device ]]; then
  echo "No device: start the emulator first." >&2
  exit 1
fi

if [[ "${1:-}" != --no-build ]]; then
  abi="$(adb shell getprop ro.product.cpu.abi | tr -d '\r')"
  ../../libs/tooling/scripts/android/install-ndk.sh .
  pnpm run build-apk "-PreactNativeArchitectures=$abi"
fi
./install-apk.sh "$apk"

# shellcheck source=../../libs/tooling/scripts/android/e2e-agent.sh
source ../../libs/tooling/scripts/android/e2e-agent.sh
trap stop_e2e_agent EXIT
start_e2e_agent
pnpm run open-test-vault
