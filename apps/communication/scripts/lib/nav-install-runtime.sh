#!/usr/bin/env bash
# nav-install-runtime.sh — the navigation system user, directories, JRE,
# go-pmtiles and the two jars. Idempotent: verified artifacts are kept.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=nav-versions.sh
source "${SCRIPT_DIR}/nav-versions.sh"

# shellcheck disable=SC1091
source /etc/communication/deploy-vars
NAV_DOMAIN="${NAV_DOMAIN:-nav-${COMMUNICATION_IP}.sslip.io}"

info "Recording ${NAV_VARS}"
cat > "${NAV_VARS}" <<VARS
NAV_DOMAIN=${NAV_DOMAIN}
NAV_TLS_PORT=${NAV_TLS_PORT}
PMTILES_PORT=${PMTILES_PORT}
GRAPHHOPPER_PORT=${GRAPHHOPPER_PORT}
EXTRACT_NAME=${EXTRACT_NAME}
VARS

if ! id -u "${NAV_USER}" >/dev/null 2>&1; then
  info "Creating system user ${NAV_USER}"
  useradd --system --home-dir "${NAV_DATA}" --shell /usr/sbin/nologin "${NAV_USER}"
fi
mkdir -p "${NAV_ROOT}/bin" "${NAV_ROOT}/lib" "${NAV_DATA}/osm" "${NAV_DATA}/tiles" "${NAV_DATA}/graphhopper" "${NAV_DATA}/planetiler-data"
chown -R "${NAV_USER}:${NAV_USER}" "${NAV_DATA}"

verify_sha256() {
  local file="$1" expected="$2"
  local actual
  actual="$(sha256sum "${file}" | cut -d' ' -f1)"
  [[ "${actual}" == "${expected}" ]] || die "Checksum mismatch for ${file}: ${actual} != ${expected}"
}

if [[ ! -x "${NAV_ROOT}/jre/bin/java" ]]; then
  info "Installing Temurin JRE 21"
  tmp="$(mktemp)"
  curl -fsSL -o "${tmp}" "${JRE_URL}"
  verify_sha256 "${tmp}" "${JRE_SHA256}"
  rm -rf "${NAV_ROOT}/jre" && mkdir -p "${NAV_ROOT}/jre"
  tar -xzf "${tmp}" -C "${NAV_ROOT}/jre" --strip-components=1
  rm -f "${tmp}"
fi
ok "Java: $("${NAV_ROOT}/jre/bin/java" -version 2>&1 | head -1)"

if [[ "$(cat "${NAV_ROOT}/bin/pmtiles.version" 2>/dev/null)" != "${PMTILES_VERSION}" ]]; then
  info "Installing go-pmtiles ${PMTILES_VERSION}"
  tmp="$(mktemp)"
  curl -fsSL -o "${tmp}" "${PMTILES_URL}"
  tar -xzf "${tmp}" -C "${NAV_ROOT}/bin" pmtiles
  chmod 755 "${NAV_ROOT}/bin/pmtiles"
  echo "${PMTILES_VERSION}" > "${NAV_ROOT}/bin/pmtiles.version"
  rm -f "${tmp}"
fi
ok "pmtiles ${PMTILES_VERSION} present"

PLANETILER_JAR="${NAV_ROOT}/lib/planetiler-openmaptiles-${PLANETILER_VERSION}.jar"
if [[ ! -f "${PLANETILER_JAR}" ]]; then
  info "Downloading planetiler-openmaptiles ${PLANETILER_VERSION}"
  curl -fsSL -o "${PLANETILER_JAR}.part" "${PLANETILER_URL}"
  expected="$(curl -fsSL "${PLANETILER_URL}.sha256" | cut -d' ' -f1)"
  verify_sha256 "${PLANETILER_JAR}.part" "${expected}"
  mv "${PLANETILER_JAR}.part" "${PLANETILER_JAR}"
fi
ok "planetiler jar present"

GRAPHHOPPER_JAR="${NAV_ROOT}/lib/graphhopper-web-${GRAPHHOPPER_VERSION}.jar"
if [[ ! -f "${GRAPHHOPPER_JAR}" ]]; then
  info "Downloading GraphHopper ${GRAPHHOPPER_VERSION}"
  curl -fsSL -o "${GRAPHHOPPER_JAR}.part" "${GRAPHHOPPER_URL}"
  verify_sha256 "${GRAPHHOPPER_JAR}.part" "${GRAPHHOPPER_SHA256}"
  mv "${GRAPHHOPPER_JAR}.part" "${GRAPHHOPPER_JAR}"
fi
ok "GraphHopper jar present"
