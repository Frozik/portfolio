#!/usr/bin/env bash
# The Maestro flows in e2e/ against the running emulator or a connected phone, as CI runs them:
# a release APK built for that device's ABI only, installed over whatever was there.
# --prebuilt skips the build (CI builds before it starts the emulator).
set -euo pipefail

cd "$(dirname "$0")"
apk=android/app/build/outputs/apk/release/app-release.apk

if [[ "$(adb get-state 2>/dev/null)" != device ]]; then
  echo "No device: start the emulator (or connect a phone) first." >&2
  exit 1
fi

if [[ "${1:-}" != --prebuilt ]]; then
  abi="$(adb shell getprop ro.product.cpu.abi | tr -d '\r')"
  ./install-ndk.sh
  pnpm run build-apk "-PreactNativeArchitectures=$abi"
fi

adb install -r "$apk"

# The flows run on a 320x640 dp screen whatever the device: the smallest phone the app is for, and
# what CI's emulator has by default, so a control pushed below the fold fails here as it does there.
adb shell wm size 640x1280
adb shell wm density 320
trap 'adb shell wm size reset; adb shell wm density reset' EXIT

maestro="$(command -v maestro || echo "$HOME/.maestro/bin/maestro")"
"$maestro" test e2e
