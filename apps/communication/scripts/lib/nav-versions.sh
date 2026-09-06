#!/usr/bin/env bash
# nav-versions.sh — every third-party artifact the navigation stack pins,
# with the checksum it is verified against. Bump here, nowhere else.
# shellcheck disable=SC2034

NAV_ROOT="/opt/navigation"
NAV_DATA="/srv/navigation"
NAV_USER="navigation"
NAV_VARS="/etc/communication/navigation-vars"

# Eclipse Temurin JRE 21 (linux x64) — runs planetiler and GraphHopper; a
# tarball rather than apt so the deploy needs no package changes.
JRE_URL="https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jre_x64_linux_hotspot_21.0.12.1_1.tar.gz"
JRE_SHA256="2413149700df0f7d440500a84a8f764c535f21e5a5e87d38328b64eec2c5b500"

# go-pmtiles — serves the PMTiles archive as a plain /z/x/y.mvt API.
PMTILES_VERSION="1.31.2"
PMTILES_URL="https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/go-pmtiles_${PMTILES_VERSION}_Linux_x86_64.tar.gz"

# planetiler-openmaptiles — OSM extract → OpenMapTiles-schema PMTiles. The
# release ships its own .sha256 next to the jar, verified at download time.
PLANETILER_VERSION="v3.16"
PLANETILER_URL="https://github.com/openmaptiles/planetiler-openmaptiles/releases/download/${PLANETILER_VERSION}/planetiler-openmaptiles.jar"

# GraphHopper — one JVM routing car, foot and bike from one graph.
GRAPHHOPPER_VERSION="11.0"
GRAPHHOPPER_URL="https://github.com/graphhopper/graphhopper/releases/download/${GRAPHHOPPER_VERSION}/graphhopper-web-${GRAPHHOPPER_VERSION}.jar"
GRAPHHOPPER_SHA256="b59c024afe172ec6ec85b6327006c3138ec58c7d0bcd26253d0e42853f613def"

# The city: BBBike's Saint Petersburg cut (≈53 MB PBF, refreshed weekly).
EXTRACT_NAME="spb"
EXTRACT_URL="https://download.bbbike.org/osm/bbbike/SanktPetersburg/SanktPetersburg.osm.pbf"

# Loopback ports behind HAProxy's TLS-terminating navigation frontend.
PMTILES_PORT=8082
GRAPHHOPPER_PORT=8989
NAV_TLS_PORT=8445
