#!/usr/bin/env bash
# The e2e tests against the running emulator, as CI runs them: a release APK for the device's ABI
# with the e2e command channel built in, the screening role and permissions granted over adb,
# then `node --test` over e2e/*.e2e.mts.
#
#   e2e-android.sh [--prebuilt] [--only <name pattern>] [suite ...]
#
# --prebuilt skips the build (CI builds before it starts the emulator; locally, when only e2e/
# changed). A suite is a file of e2e/ without `.e2e.mts` (screening, screens); none runs them all.
# --only keeps the tests whose name matches.
#
# Every test seeds the app over the channel and calls with its own numbers, so any test runs
# alone. Each one is bounded as a hang guard, not a speed budget, and a failure leaves the screen,
# the view tree and logcat in e2e-artifacts/.
set -euo pipefail

cd "$(dirname "$0")"
apk=android/app/build/outputs/apk/release/app-release.apk
package=io.github.frozik.callsfilter
artifacts=e2e-artifacts

if [[ "$(adb get-state 2>/dev/null)" != device ]]; then
  echo "No device: start the emulator first." >&2
  exit 1
fi

prebuilt=false
only=()
suites=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --prebuilt) prebuilt=true ;;
    --only)
      only=(--test-name-pattern "$2")
      shift
      ;;
    *) suites+=("e2e/$1.e2e.mts") ;;
  esac
  shift
done
if [[ ${#suites[@]} -eq 0 ]]; then
  suites=(e2e/*.e2e.mts)
fi

if [[ "$prebuilt" == false ]]; then
  abi="$(adb shell getprop ro.product.cpu.abi | tr -d '\r')"
  ../../libs/tooling/scripts/android/install-ndk.sh .
  CALLS_FILTER_E2E=1 pnpm run build-apk "-PreactNativeArchitectures=$abi"
fi

adb uninstall "$package" >/dev/null 2>&1 || true
adb install -r "$apk"
adb shell cmd role add-role-holder android.app.role.CALL_SCREENING "$package"
for permission in READ_CONTACTS READ_CALENDAR READ_CALL_LOG READ_PHONE_STATE POST_NOTIFICATIONS \
  ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION ACCESS_BACKGROUND_LOCATION; do
  adb shell pm grant "$package" "android.permission.$permission"
done

# The phone's position comes from test providers the tests move; the emulator's own comes back after.
location_providers=(gps network)
adb shell appops set com.android.shell android:mock_location allow
for provider in "${location_providers[@]}"; do
  adb shell cmd location providers add-test-provider "$provider"
  adb shell cmd location providers set-test-provider-enabled "$provider" true
done
release_location() {
  local provider
  for provider in "${location_providers[@]}"; do
    adb shell cmd location providers remove-test-provider "$provider" || true
  done
}
# A call that rang leaves the dialer's and the app's notices popping up over the next test's
# screen, where they take its taps; they still post, only without the pop-up.
heads_up="$(adb shell settings get global heads_up_notifications_enabled | tr -d '\r')"
adb shell settings put global heads_up_notifications_enabled 0
restore_heads_up() {
  if [[ "$heads_up" == "null" ]]; then
    adb shell settings delete global heads_up_notifications_enabled || true
  else
    adb shell settings put global heads_up_notifications_enabled "$heads_up" || true
  fi
}
# shellcheck source=../../libs/tooling/scripts/android/e2e-agent.sh
source ../../libs/tooling/scripts/android/e2e-agent.sh
trap 'stop_e2e_agent; release_location; restore_heads_up' EXIT
if [[ "$prebuilt" == true ]]; then
  start_e2e_agent --prebuilt
else
  start_e2e_agent
fi

rm -rf "$artifacts"
node --test --test-concurrency=1 ${only[@]+"${only[@]}"} "${suites[@]}"
