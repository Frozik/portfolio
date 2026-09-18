import type { Vector2 } from '@frozik/utils/math/vector2';

import { CUP_RADIUS_METERS } from '../constants';
import type { Bounds, Cup, Edge, Wall } from '../level';
import { pointAlongEdge } from '../level';
import { distance } from '../vector';
import type { Random } from './random';
import { supportsTee } from './tee-support';

/** Flat face kept on either side of the notch, clear of the corner cuts. */
const CUP_MARGIN_METERS = 0.2;
const MIN_FACE_METERS = 2 * (CUP_RADIUS_METERS + CUP_MARGIN_METERS);
/**
 * The cup goes on one of the far faces: those at least this share of the
 * farthest face's distance from the ball, so the way to it is long and still
 * not always to the same corner.
 */
const FAR_FACE_SHARE = 0.8;
/**
 * The cup goes on a horizontal or vertical face inside `region` — never an
 * underside, which would need gravity to point up — at the far end of the
 * region from where the ball is, never on the face the ball rests on, and
 * never on a face something already stands on: `isTaken` knows the spike
 * rows and the rods' plates. The notch is centred somewhere along the face
 * with a margin to both ends. Nothing when the region has no such face.
 */
export function placeCup(
  random: Random,
  walls: readonly Wall[],
  region: Bounds,
  ball: Vector2,
  isTaken: (face: Edge) => boolean
): Cup | undefined {
  const faces = walls.flatMap((wall, wallIndex) =>
    wall.edges
      .map((face, edgeIndex) => ({ wall: wallIndex, edge: edgeIndex, face }))
      .filter(
        candidate =>
          candidate.face.kind === 'floor' &&
          candidate.face.normal.y >= 0 &&
          candidate.face.length >= MIN_FACE_METERS &&
          isInside(candidate.face, region) &&
          !supportsTee(candidate.face, ball) &&
          !isTaken(candidate.face)
      )
  );
  if (faces.length === 0) {
    return undefined;
  }
  const fromBall = (face: Edge): number => distance(midpoint(face), ball);
  const farthest = Math.max(...faces.map(candidate => fromBall(candidate.face)));
  const chosen = random.pick(
    faces.filter(candidate => fromBall(candidate.face) >= farthest * FAR_FACE_SHARE)
  );
  const span = chosen.face.length - 2 * (CUP_RADIUS_METERS + CUP_MARGIN_METERS);
  return {
    wall: chosen.wall,
    edge: chosen.edge,
    at: CUP_RADIUS_METERS + CUP_MARGIN_METERS + random.next() * span,
    radius: CUP_RADIUS_METERS,
  };
}

/** The face, notch included, lies in the region. */
function isInside(face: Edge, region: Bounds): boolean {
  const inset = CUP_RADIUS_METERS;
  return [face.from, face.to].every(
    point =>
      point.x >= region.min.x + inset &&
      point.y >= region.min.y + inset &&
      point.x <= region.max.x - inset &&
      point.y <= region.max.y - inset
  );
}

function midpoint(face: Edge): Vector2 {
  return pointAlongEdge(face, face.length / 2);
}
