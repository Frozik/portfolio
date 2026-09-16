import type { Vector2 } from '@frozik/utils/math/vector2';

import { CUP_RADIUS_METERS } from '../constants';
import type { Cup, Edge, Wall } from '../level';
import { pointAlongEdge } from '../level';
import type { Random } from './random';
import { supportsTee } from './tee-support';

/** Flat face kept on either side of the notch, clear of the corner cuts. */
const CUP_MARGIN_METERS = 0.2;
const MIN_FACE_METERS = 2 * (CUP_RADIUS_METERS + CUP_MARGIN_METERS);
interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * The cup goes on a horizontal or vertical face that lies on the board —
 * never an underside, which would need gravity to point up — in the lower
 * half by preference, and never on the face the ball starts on. The notch
 * is centred somewhere along the face with a margin to both ends.
 */
export function placeCup(random: Random, walls: readonly Wall[], board: Size, tee: Vector2): Cup {
  const faces = walls.flatMap((wall, wallIndex) =>
    wall.edges
      .map((face, edgeIndex) => ({ wall: wallIndex, edge: edgeIndex, face }))
      .filter(
        candidate =>
          candidate.face.kind === 'floor' &&
          candidate.face.normal.y >= 0 &&
          candidate.face.length >= MIN_FACE_METERS &&
          isOnBoard(candidate.face, board) &&
          !supportsTee(candidate.face, tee)
      )
  );
  if (faces.length === 0) {
    throw new Error('placeCup: no face long enough for the cup');
  }
  const lower = faces.filter(candidate => midpoint(candidate.face).y < board.height / 2);
  const chosen = random.pick(lower.length > 0 ? lower : faces);
  const span = chosen.face.length - 2 * (CUP_RADIUS_METERS + CUP_MARGIN_METERS);
  return {
    wall: chosen.wall,
    edge: chosen.edge,
    at: CUP_RADIUS_METERS + CUP_MARGIN_METERS + random.next() * span,
    radius: CUP_RADIUS_METERS,
  };
}

/** The face, notch included, lies on the board: a ball in the cup is never beyond it. */
function isOnBoard(face: Edge, board: Size): boolean {
  const inset = CUP_RADIUS_METERS;
  return [face.from, face.to].every(
    point =>
      point.x >= inset &&
      point.y >= inset &&
      point.x <= board.width - inset &&
      point.y <= board.height - inset
  );
}

function midpoint(face: Edge): Vector2 {
  return pointAlongEdge(face, face.length / 2);
}
