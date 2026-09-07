#!/usr/bin/env bash
# nav-install-runtime.sh — the navigation system user, directories, apt
# tools (osmium for clipping, nginx for the pack files), the JRE, go-pmtiles
# and the planetiler jar. Idempotent: verified artifacts are kept.
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
NAV_STATIC_PORT=${NAV_STATIC_PORT}
NAV_PUBLIC=${NAV_PUBLIC}
VARS

if ! id -u "${NAV_USER}" >/dev/null 2>&1; then
  info "Creating system user ${NAV_USER}"
  useradd --system --home-dir "${NAV_DATA}" --shell /usr/sbin/nologin "${NAV_USER}"
fi
mkdir -p "${NAV_ROOT}/bin" "${NAV_ROOT}/lib" \
  "${NAV_DATA}/osm/sources" "${NAV_DATA}/tiles" "${NAV_DATA}/graphs" \
  "${NAV_DATA}/planetiler-data" "${NAV_PUBLIC}/packs"
chown -R "${NAV_USER}:${NAV_USER}" "${NAV_DATA}"
# nginx (www-data) reads the public tree; everyone else on the box may too.
chmod 755 "${NAV_DATA}" "${NAV_PUBLIC}" "${NAV_PUBLIC}/packs"

missing=()
for package in osmium-tool nginx; do
  dpkg -s "${package}" >/dev/null 2>&1 || missing+=("${package}")
done
if (( ${#missing[@]} > 0 )); then
  info "Installing ${missing[*]}"
  DEBIAN_FRONTEND=noninteractive apt-get install -y -q "${missing[@]}" >/dev/null
fi
# The stock nginx site binds :80 for everyone; certbot's HTTP-01 needs that
# port during renewals, and the navigation site listens on loopback only.
if [[ -e /etc/nginx/sites-enabled/default ]]; then
  rm -f /etc/nginx/sites-enabled/default
fi
ok "osmium $(osmium --version | head -1 | awk '{print $3}'), nginx $(nginx -v 2>&1 | awk -F/ '{print $2}')"

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

[[ -x "$(command -v node)" ]] || die "node is missing on the box; run upgrade.sh first"
[[ -d "${NAV_REPO}/apps/navigation-tools" ]] || die "${NAV_REPO}/apps/navigation-tools missing — push main and run upgrade.sh first"
ok "node $(node -v), pack builder checkout present"
