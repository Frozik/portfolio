/** A camera pose in geographic terms — what the URL hash and the reset button speak. */
export interface MapView {
  readonly lat: number;
  readonly lon: number;
  readonly zoom: number;
  readonly bearingDeg: number;
  readonly pitchDeg: number;
}

/** How the map opens over a place it was told about: city scale, north up, tilted enough to show the horizon. */
const HOME_ZOOM = 14;
const HOME_PITCH_DEG = 50;

export function viewAround(position: { readonly lat: number; readonly lon: number }): MapView {
  return {
    lat: position.lat,
    lon: position.lon,
    zoom: HOME_ZOOM,
    bearingDeg: 0,
    pitchDeg: HOME_PITCH_DEG,
  };
}

/** Central Osaka at street level, among the boxes and the cars; used when neither the hash nor geolocation says where. */
export const DEFAULT_VIEW: MapView = {
  lat: 34.64906,
  lon: 135.50297,
  zoom: 18.39,
  bearingDeg: 109,
  pitchDeg: 64.6,
};
