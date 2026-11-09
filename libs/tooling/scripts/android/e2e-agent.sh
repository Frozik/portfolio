#!/usr/bin/env bash
# Sourced by the apps' e2e-android.sh: the e2e agent (libs/tooling/android-agent) built, installed
# and started on the device, its port forwarded here; stopped again when the run ends.
#
#   source …/e2e-agent.sh
#   start_e2e_agent [--prebuilt]     # --prebuilt: CI built it in an earlier step
#   trap stop_e2e_agent EXIT

e2e_agent_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../android-agent" && pwd)"
e2e_agent_port=8642
e2e_agent_package=io.github.frozik.e2eagent
# The agent connects to accessibility and opens its socket within seconds.
e2e_agent_start_seconds=60
# Android animates windows by itself — a sheet sliding up, a permission dialog growing in — and
# those transforms are not in the positions accessibility reports: a tap taken mid-way lands
# beside the window, outside a dialog even dismisses it. Off for the run, as Espresso and
# UiAutomator advise; the device's own scales come back afterwards.
e2e_animation_scales=(window_animation_scale transition_animation_scale animator_duration_scale)
e2e_saved_scales=()

start_e2e_agent() {
  local scale
  for scale in "${e2e_animation_scales[@]}"; do
    e2e_saved_scales+=("$(adb shell settings get global "$scale" | tr -d '\r')")
    adb shell settings put global "$scale" 0
  done
  if [[ "${1:-}" != --prebuilt ]]; then
    (cd "$e2e_agent_dir" && ./gradlew assembleDebug assembleDebugAndroidTest --no-daemon -q)
  fi
  adb install -r -t "$e2e_agent_dir/build/outputs/apk/debug/e2e-agent-debug.apk" >/dev/null
  adb install -r -t "$e2e_agent_dir/build/outputs/apk/androidTest/debug/e2e-agent-debug-androidTest.apk" >/dev/null
  adb forward "tcp:$e2e_agent_port" "tcp:$e2e_agent_port" >/dev/null
  adb shell am instrument -w -e class "$e2e_agent_package.Agent#serve" \
    "$e2e_agent_package.test/androidx.test.runner.AndroidJUnitRunner" >/dev/null 2>&1 &
  local waited
  for ((waited = 0; waited < e2e_agent_start_seconds * 4; waited++)); do
    if curl -s -m 1 -X POST -d '{"name":"ping"}' "http://127.0.0.1:$e2e_agent_port/" >/dev/null; then
      return 0
    fi
    sleep 0.25
  done
  echo "The e2e agent did not start within ${e2e_agent_start_seconds}s." >&2
  return 1
}

stop_e2e_agent() {
  curl -s -m 5 -X POST -d '{"name":"stop"}' "http://127.0.0.1:$e2e_agent_port/" >/dev/null || true
  adb forward --remove "tcp:$e2e_agent_port" >/dev/null 2>&1 || true
  local index
  for index in "${!e2e_saved_scales[@]}"; do
    if [[ "${e2e_saved_scales[$index]}" == null ]]; then
      adb shell settings delete global "${e2e_animation_scales[$index]}" >/dev/null
    else
      adb shell settings put global "${e2e_animation_scales[$index]}" "${e2e_saved_scales[$index]}"
    fi
  done
}
