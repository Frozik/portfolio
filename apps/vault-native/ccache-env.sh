#!/usr/bin/env bash
# Routes the native modules' C/C++ compiles through ccache on a GitHub Actions runner: CMake 3.17+
# reads the compiler launcher from the environment, so no module's build files change. The job
# keeps ~/.ccache with actions/cache; a hit needs the same sources, flags and compiler, so it
# yields the object a compile would. __DATE__/__TIME__ stay uncached (no time_macros sloppiness).
set -euo pipefail

if ! command -v ccache >/dev/null; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq --no-install-recommends ccache
fi

{
  echo "CCACHE_DIR=$HOME/.ccache"
  echo "CCACHE_BASEDIR=${GITHUB_WORKSPACE:?only for GitHub Actions}"
  echo "CCACHE_NOHASHDIR=true"
  echo "CCACHE_COMPILERCHECK=content"
  echo "CCACHE_MAXSIZE=2G"
  echo "CMAKE_C_COMPILER_LAUNCHER=ccache"
  echo "CMAKE_CXX_COMPILER_LAUNCHER=ccache"
} >> "${GITHUB_ENV:?only for GitHub Actions}"
