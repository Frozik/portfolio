#!/usr/bin/env bash
# `expo prebuild --clean` only when what it makes android/ from has changed — native modules,
# config plugins, dependencies, or a variable the app's config reads. A clean prebuild rewrites
# every native file, and Gradle then rebuilds everything (about 85 s against 15 s for a change in
# the JavaScript alone); a repeated build keeps Gradle's incremental work.
#
#   prebuild.sh [ENV_VARIABLE ...]      # run from the app's directory
set -euo pipefail

key_file=android/.prebuild-key
key="$(android-prebuild-key . "$@")"
if [[ -f "$key_file" && "$(cat "$key_file")" == "$key" ]]; then
  echo "android/ is up to date with the app's config: no prebuild."
  exit 0
fi
expo prebuild --platform android --no-install --clean
echo "$key" > "$key_file"
