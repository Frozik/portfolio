import { MAX_PITCH_RADIANS, MAX_ZOOM, MIN_ZOOM, DEGREES_PER_RADIAN } from './constants';
import type { MapView } from './map-view';
import { MAX_LATITUDE } from './mercator';

const FIELD_COUNT = 5;
const ZOOM_DIGITS = 2;
const COORDINATE_DIGITS = 5;
const ANGLE_DIGITS = 1;
const MAX_LONGITUDE = 180;
const FULL_TURN_DEGREES = 360;

/** `#zoom/lat/lon/bearing/pitch`, the MapLibre hash shape. */
export function formatViewHash(view: MapView): string {
  return [
    view.zoom.toFixed(ZOOM_DIGITS),
    view.lat.toFixed(COORDINATE_DIGITS),
    view.lon.toFixed(COORDINATE_DIGITS),
    view.bearingDeg.toFixed(ANGLE_DIGITS),
    view.pitchDeg.toFixed(ANGLE_DIGITS),
  ].join('/');
}

/** Anything malformed or out of range yields `undefined`, so the caller falls back to its default. */
export function parseViewHash(hash: string): MapView | undefined {
  const fields = hash.replace(/^#/, '').split('/');
  if (fields.length !== FIELD_COUNT) {
    return undefined;
  }
  const [zoom, lat, lon, bearingDeg, pitchDeg] = fields.map(Number);
  const inRange =
    zoom >= MIN_ZOOM &&
    zoom <= MAX_ZOOM &&
    Math.abs(lat) <= MAX_LATITUDE &&
    Math.abs(lon) <= MAX_LONGITUDE &&
    Math.abs(bearingDeg) <= FULL_TURN_DEGREES &&
    pitchDeg >= 0 &&
    pitchDeg <= MAX_PITCH_RADIANS * DEGREES_PER_RADIAN;
  return inRange ? { zoom, lat, lon, bearingDeg, pitchDeg } : undefined;
}
