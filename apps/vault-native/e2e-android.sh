#!/usr/bin/env bash
# The e2e tests against the running emulator or a connected phone, as CI runs them: a release APK
# built for that device's ABI only, installed over whatever was there, then `node --test` over
# e2e/*.e2e.mts. Only what a phone alone can show is tested here — the window kept from
# screenshots, Argon2 and the keystore for real; every screen's logic is a Jest test.
#
#   e2e-android.sh [--prebuilt] [--only <name pattern>]
#
# --prebuilt skips the build (CI builds before it starts the emulator). Each test is bounded as a
# hang guard, not a speed budget, and a failure leaves the screen, the view tree and logcat
# in e2e-artifacts/.
set -euo pipefail

cd "$(dirname "$0")"
apk=android/app/build/outputs/apk/release/app-release.apk
artifacts=e2e-artifacts

if [[ "$(adb get-state 2>/dev/null)" != device ]]; then
  echo "No device: start the emulator (or connect a phone) first." >&2
  exit 1
fi

prebuilt=false
only=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --prebuilt) prebuilt=true ;;
    --only)
      only=(--test-name-pattern "$2")
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
  shift
done

if [[ "$prebuilt" == false ]]; then
  abi="$(adb shell getprop ro.product.cpu.abi | tr -d '\r')"
  ../../libs/tooling/scripts/android/install-ndk.sh .
  pnpm run build-apk "-PreactNativeArchitectures=$abi"
fi

adb install -r "$apk"

# The flows run on a 320x640 dp screen whatever the device: the smallest phone the app is for, and
# what CI's emulator has by default, so a control pushed below the fold fails here as it does there.
adb shell wm size 640x1280
adb shell wm density 320
# shellcheck source=../../libs/tooling/scripts/android/e2e-agent.sh
source ../../libs/tooling/scripts/android/e2e-agent.sh
trap 'stop_e2e_agent; adb shell wm size reset; adb shell wm density reset' EXIT
if [[ "$prebuilt" == true ]]; then
  start_e2e_agent --prebuilt
else
  start_e2e_agent
fi

rm -rf "$artifacts"
node --test --test-concurrency=1 ${only[@]+"${only[@]}"} e2e/*.e2e.mts
