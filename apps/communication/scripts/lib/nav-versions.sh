#!/usr/bin/env bash
# nav-versions.sh — every third-party artifact the navigation stack pins,
# the on-box layout and the loopback ports. Bump here, nowhere else.
# shellcheck disable=SC2034

NAV_ROOT="/opt/navigation"
NAV_DATA="/srv/navigation"
NAV_PUBLIC="${NAV_DATA}/public"
NAV_USER="navigation"
NAV_VARS="/etc/communication/navigation-vars"
# The deploy checkout of this repository; the pack builder runs from it.
NAV_REPO="/opt/communication"

# Eclipse Temurin JRE 21 (linux x64) — runs planetiler; a tarball rather than
# apt so the deploy needs no package changes.
JRE_URL="https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jre_x64_linux_hotspot_21.0.12.1_1.tar.gz"
JRE_SHA256="2413149700df0f7d440500a84a8f764c535f21e5a5e87d38328b64eec2c5b500"

# go-pmtiles — serves every archive in the tiles directory as /<name>/z/x/y.mvt.
PMTILES_VERSION="1.31.2"
PMTILES_URL="https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/go-pmtiles_${PMTILES_VERSION}_Linux_x86_64.tar.gz"

# planetiler-openmaptiles — OSM extract → OpenMapTiles-schema PMTiles. The
# release ships its own .sha256 next to the jar, verified at download time.
PLANETILER_VERSION="v3.16"
PLANETILER_URL="https://github.com/openmaptiles/planetiler-openmaptiles/releases/download/${PLANETILER_VERSION}/planetiler-openmaptiles.jar"

# Zoom split between the world layer and the region archives.
WORLD_MAXZOOM=6
REGION_MINZOOM=7
REGION_MAXZOOM=14

# Loopback ports behind HAProxy's TLS-terminating navigation frontend.
PMTILES_PORT=8082
NAV_STATIC_PORT=8083
NAV_TLS_PORT=8445
