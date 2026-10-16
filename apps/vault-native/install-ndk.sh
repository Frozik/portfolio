#!/usr/bin/env bash
# Installs the NDK react-native builds with before Gradle asks for it. Gradle downloads it once,
# without a retry, and on CI runners that download sometimes arrives cut short ("Error on ZipFile
# unknown archive"), failing the build.
set -euo pipefail

cd "$(dirname "$0")"
catalog="$(dirname "$(node -p "require.resolve('react-native/package.json')")")/gradle/libs.versions.toml"
version="$(sed -n 's/^ndkVersion = "\(.*\)"$/\1/p' "$catalog")"
if [[ -f "${ANDROID_HOME:?ANDROID_HOME is not set}/ndk/$version/source.properties" ]]; then
  echo "NDK $version is already installed"
  exit 0
fi
sdkmanager="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"

for attempt in 1 2 3; do
  if yes | "$sdkmanager" --install "ndk;$version" >/dev/null; then
    echo "NDK $version installed"
    exit 0
  fi
  echo "NDK $version: attempt $attempt failed" >&2
  sleep $((attempt * 20))
done
exit 1
