import type { Vector2 } from '@frozik/utils/math/vector2';

import { SPIKE_HEIGHT_METERS } from '../constants';
import type { Edge, SpikeRow, Wall } from '../level';
import { pointAlongEdge } from '../level';
import { createSpikeRow, rowLength, touchesBall } from '../spikes';
import type { Random } from './random';
import { supportsTee } from './tee-support';

const MIN_ROWS = 2;
const MAX_ROWS = 5;
const MIN_TEETH = 1;
const MAX_TEETH = 3;
/** Plain floor kept at both ends of the face, clear of the corner cuts and of the hole's rim. */
const END_MARGIN_METERS = 0.2;
const EXTENDED_AT_START_CHANCE = 0.5;

interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * Spike rows for a finished level — the faces are final, surfaces cut and
 * the cup carved, so the rows' edge indices hold. Each goes on a plain
 * horizontal or vertical face on the board, never the tee's own and never
 * within reach of the ball on the tee, with floor left at both ends; at
 * most one row per face, two to five per level, one to three teeth each,
 * half of them standing on the tee.
 */
export function placeSpikes(
  random: Random,
  walls: readonly Wall[],
  board: Size,
  tee: Vector2
): readonly SpikeRow[] {
  const candidates = walls.flatMap((wall, wallIndex) =>
    wall.edges
      .map((face, edgeIndex) => ({ wall: wallIndex, edge: edgeIndex, face }))
      .filter(
        candidate =>
          candidate.face.kind === 'floor' &&
          candidate.face.length >= rowLength(MIN_TEETH) + 2 * END_MARGIN_METERS &&
          rowFitsOnBoard(candidate.face, board) &&
          !supportsTee(candidate.face, tee)
      )
  );
  const wanted = random.int(MIN_ROWS, MAX_ROWS);
  const rows: SpikeRow[] = [];
  while (rows.length < wanted && candidates.length > 0) {
    const index = random.int(0, candidates.length - 1);
    const [chosen] = candidates.splice(index, 1);
    const room = chosen.face.length - 2 * END_MARGIN_METERS;
    const maxTeeth = Math.min(MAX_TEETH, Math.floor(room / rowLength(1)));
    const teeth = random.int(MIN_TEETH, maxTeeth);
    const from = END_MARGIN_METERS + random.next() * (room - rowLength(teeth));
    const row = createSpikeRow(
      walls,
      { wall: chosen.wall, edge: chosen.edge },
      from,
      teeth,
      random.chance(EXTENDED_AT_START_CHANCE)
    );
    if (!touchesBall(row, tee)) {
      rows.push(row);
    }
  }
  return rows;
}

/** The face and the teeth standing on it lie on the board, so every row is in view. */
function rowFitsOnBoard(face: Edge, board: Size): boolean {
  const lifted = (point: Vector2): Vector2 => ({
    x: point.x + face.normal.x * SPIKE_HEIGHT_METERS,
    y: point.y + face.normal.y * SPIKE_HEIGHT_METERS,
  });
  const start = pointAlongEdge(face, END_MARGIN_METERS);
  const end = pointAlongEdge(face, face.length - END_MARGIN_METERS);
  return [start, end, lifted(start), lifted(end)].every(
    point => point.x >= 0 && point.y >= 0 && point.x <= board.width && point.y <= board.height
  );
}
