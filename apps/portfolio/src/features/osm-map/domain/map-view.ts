/** A camera pose in geographic terms — what the URL hash and the reset button speak. */
export interface MapView {
  readonly lat: number;
  readonly lon: number;
  readonly zoom: number;
  readonly bearingDeg: number;
  readonly pitchDeg: number;
}

/** The opening pose over a place: the default zoom and tilt, north up. */
export function viewAround(position: { readonly lat: number; readonly lon: number }): MapView {
  return { ...DEFAULT_VIEW, lat: position.lat, lon: position.lon };
}

/** Moscow centre, tilted enough to show the horizon; used when neither the hash nor geolocation says where. */
export const DEFAULT_VIEW: MapView = {
  lat: 55.7539,
  lon: 37.6208,
  zoom: 14,
  bearingDeg: 0,
  pitchDeg: 50,
};
