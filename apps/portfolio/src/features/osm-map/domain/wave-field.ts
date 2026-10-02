import type { GroundPoint } from './mercator';
import { metresPerUnitAtPoint } from './tile-grid';

/** Anchors are the corners of this zoom's tiles: about 20 km apart in a city's latitudes. */
const ANCHOR_ZOOM = 10;
const ANCHOR_CELL = 1 / 2 ** ANCHOR_ZOOM;

/**
 * Where the waves are measured from. The water of every tile must share one
 * wave pattern, or the tiles' edges show as seams; and the pattern must stay
 * put on the ground while the camera moves. So waves are measured in metres
 * from an anchor fixed on the ground near the camera — near, because a
 * `float32` holds a few millimetres over an anchor cell and metres over the
 * whole world. Crossing into the next cell re-anchors the pattern: one jump
 * of the waves every twenty kilometres of panning.
 */
export interface WaveField {
  /** From the anchor to the frame's origin, in Mercator units. */
  readonly offset: GroundPoint;
  /** One scale for the whole frame, taken at the anchor cell's latitude. */
  readonly metresPerUnit: number;
}

function anchorOf(coordinate: number): number {
  return Math.floor(coordinate / ANCHOR_CELL) * ANCHOR_CELL;
}

export function waveFieldAround(origin: GroundPoint): WaveField {
  const anchor: GroundPoint = { x: anchorOf(origin.x), y: anchorOf(origin.y) };
  return {
    offset: { x: origin.x - anchor.x, y: origin.y - anchor.y },
    metresPerUnit: metresPerUnitAtPoint({ x: anchor.x, y: anchor.y + ANCHOR_CELL / 2 }),
  };
}
