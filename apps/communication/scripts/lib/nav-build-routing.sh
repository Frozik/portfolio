#!/usr/bin/env bash
# nav-build-routing.sh — GraphHopper config for car / foot / bike and the
# graph import. Three profiles in one JVM: one process to feed on a 4 GB VM.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=nav-versions.sh
source "${SCRIPT_DIR}/nav-versions.sh"

PBF="${NAV_DATA}/osm/${EXTRACT_NAME}.osm.pbf"
GH_DIR="${NAV_DATA}/graphhopper"
JAR="${NAV_ROOT}/lib/graphhopper-web-${GRAPHHOPPER_VERSION}.jar"
HEAP="${NAV_BUILD_HEAP:-1600m}"

info "Rendering ${GH_DIR}/config.yml"
cat > "${GH_DIR}/config.yml" <<YAML
graphhopper:
  datareader.file: ${PBF}
  graph.location: ${GH_DIR}/graph-cache
  profiles:
    - name: car
      custom_model_files: [car.json]
    - name: foot
      custom_model_files: [foot.json]
    - name: bike
      custom_model_files: [bike.json]
  profiles_ch:
    - profile: car
    - profile: foot
    - profile: bike
  profiles_lm: []
  graph.encoded_values: car_access|block_private=false, car_average_speed, road_access, foot_access, foot_priority, foot_average_speed, foot_road_access, bike_priority, bike_access, roundabout, bike_average_speed, bike_road_access, average_slope, mtb_rating, hike_rating, country, road_class
  # Empty on purpose: the default drops footways and cycleways, which the
  # foot and bike profiles route over.
  import.osm.ignored_highways: ""
  prepare.min_network_size: 200
  prepare.subnetworks.threads: 1
  routing.snap_preventions_default: tunnel, bridge, ferry
  routing.non_ch.max_waypoint_distance: 1000000
  graph.dataaccess.default_type: RAM_STORE
server:
  application_connectors:
    - type: http
      port: ${GRAPHHOPPER_PORT}
      bind_host: 127.0.0.1
      max_request_header_size: 50k
  request_log:
    appenders: []
  admin_connectors: []
logging:
  appenders:
    - type: console
      time_zone: UTC
      log_format: "%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n"
  loggers:
    "com.graphhopper.osm_warnings":
      level: WARN
YAML
chown "${NAV_USER}:${NAV_USER}" "${GH_DIR}/config.yml"

if [[ "${NAV_SKIP_BUILD:-false}" == "true" && -d "${GH_DIR}/graph-cache" ]]; then
  ok "Graph present, import skipped"
  exit 0
fi
[[ -f "${PBF}" ]] || die "Extract missing: ${PBF}"

info "Importing routing graph (heap ${HEAP})"
rm -rf "${GH_DIR}/graph-cache"
sudo -u "${NAV_USER}" nice -n 10 bash -c "cd '${GH_DIR}' && '${NAV_ROOT}/jre/bin/java' -Xmx${HEAP} -jar '${JAR}' import config.yml"
ok "Graph: $(du -sh "${GH_DIR}/graph-cache" | cut -f1)"
