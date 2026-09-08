import type { Vector2 } from '@frozik/utils/math/vector2';

import { SPIKE_HEIGHT_METERS } from './constants';
import type { Level, SpikeRow } from './level';
import { edgeOf, pointAlongEdge } from './level';
import { add, scale } from './vector';

/** The whole spike clock: nothing ticks, the state follows the parity of the strokes played. */
export function isExtended(row: SpikeRow, stroke: number): boolean {
  return row.extendedOnOddStrokes === (stroke % 2 === 1);
}

export interface Hazard {
  readonly from: Vector2;
  readonly to: Vector2;
  readonly direction: Vector2;
  readonly normal: Vector2;
  readonly length: number;
}

/** The tips of an extended row: a segment lifted off the edge by the spike height. */
function hazardOf(level: Level, row: SpikeRow): Hazard {
  const edge = edgeOf(level, row);
  const lift = scale(edge.normal, SPIKE_HEIGHT_METERS);
  return {
    from: add(pointAlongEdge(edge, row.from), lift),
    to: add(pointAlongEdge(edge, row.from + row.length), lift),
    direction: edge.direction,
    normal: edge.normal,
    length: row.length,
  };
}

const ODD = 1;
const EVEN = 2;
const hazardCache = new WeakMap<Level, Readonly<Record<number, readonly Hazard[]>>>();

/** The rows that can destroy the ball during the given stroke; two sets per level, built once. */
export function activeHazards(level: Level, stroke: number): readonly Hazard[] {
  let sets = hazardCache.get(level);
  if (sets === undefined) {
    const build = (parity: number): readonly Hazard[] =>
      level.spikes.filter(row => isExtended(row, parity)).map(row => hazardOf(level, row));
    sets = { [ODD]: build(ODD), [EVEN]: build(EVEN) };
    hazardCache.set(level, sets);
  }
  return sets[stroke % 2 === 1 ? ODD : EVEN];
}
