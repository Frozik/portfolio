import type { Vector2 } from '@frozik/utils/math/vector2';

import { SPIKE_HEIGHT_METERS } from '../constants';
import type { Edge, Level, SpikeRow } from '../level';
import { pointAlongEdge } from '../level';
import { createSpikeRow, rowLength } from '../spikes';
import type { Random } from './random';
import { supportsTee } from './tee-support';

const MIN_ROWS = 2;
const MAX_ROWS = 5;
const MIN_TEETH = 1;
const MAX_TEETH = 3;
/** Plain floor kept at both ends of the face, clear of the corner cuts and of the hole's rim. */
const END_MARGIN_METERS = 0.2;
const EXTENDED_AT_START_CHANCE = 0.5;

/**
 * Spike rows for a finished level — the faces are final, surfaces cut and
 * the cup carved, so the rows' edge indices hold. Each goes on a plain
 * horizontal or vertical face on the board, never the tee's own, with
 * floor left at both ends; at most one row per face, two to five per
 * level, one to three teeth each, half of them standing on the tee.
 */
export function placeSpikes(random: Random, level: Level): readonly SpikeRow[] {
  const candidates = level.walls.flatMap((wall, wallIndex) =>
    wall.edges
      .map((face, edgeIndex) => ({ wall: wallIndex, edge: edgeIndex, face }))
      .filter(
        candidate =>
          candidate.face.kind === 'floor' &&
          candidate.face.length >= rowLength(MIN_TEETH) + 2 * END_MARGIN_METERS &&
          isOnBoard(candidate.face, level) &&
          !supportsTee(candidate.face, level.tee)
      )
  );
  const wanted = Math.min(random.int(MIN_ROWS, MAX_ROWS), candidates.length);
  const rows: SpikeRow[] = [];
  while (rows.length < wanted) {
    const index = random.int(0, candidates.length - 1);
    const [chosen] = candidates.splice(index, 1);
    const room = chosen.face.length - 2 * END_MARGIN_METERS;
    const maxTeeth = Math.min(MAX_TEETH, Math.floor(room / rowLength(1)));
    const teeth = random.int(MIN_TEETH, maxTeeth);
    const from = END_MARGIN_METERS + random.next() * (room - rowLength(teeth));
    rows.push(
      createSpikeRow(
        level.walls,
        { wall: chosen.wall, edge: chosen.edge },
        from,
        teeth,
        random.chance(EXTENDED_AT_START_CHANCE)
      )
    );
  }
  return rows;
}

/** The face and the teeth standing on it lie on the board, so every row is in view. */
function isOnBoard(face: Edge, level: Level): boolean {
  const lifted = (point: Vector2): Vector2 => ({
    x: point.x + face.normal.x * SPIKE_HEIGHT_METERS,
    y: point.y + face.normal.y * SPIKE_HEIGHT_METERS,
  });
  const start = pointAlongEdge(face, END_MARGIN_METERS);
  const end = pointAlongEdge(face, face.length - END_MARGIN_METERS);
  return [start, end, lifted(start), lifted(end)].every(
    point => point.x >= 0 && point.y >= 0 && point.x <= level.width && point.y <= level.height
  );
}
