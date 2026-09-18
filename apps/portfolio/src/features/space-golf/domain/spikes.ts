import type { Vector2 } from '@frozik/utils/math/vector2';

import type { SegmentHit } from './collision';
import { reachesPoint, sweepCircleAgainstSegment } from './collision';
import {
  BALL_RADIUS_METERS,
  FREEZE_CLEARANCE_METERS,
  SPIKE_HEIGHT_METERS,
  SPIKE_WIDTH_METERS,
} from './constants';
import type { Level, Segment, SpikeRow } from './level';
import { pointAlongEdge } from './level';
import { distance, normalize, rightNormal, subtract } from './vector';

export function rowLength(teeth: number): number {
  return teeth * SPIKE_WIDTH_METERS;
}

/** A row on `face`, `from` metres along it: the sides of its teeth are laid out once here, for the sweep and the renderer alike. */
export function createSpikeRow(
  face: Segment,
  from: number,
  teeth: number,
  extendedAtStart: boolean
): SpikeRow {
  const sides: Segment[] = [];
  for (let tooth = 0; tooth < teeth; tooth += 1) {
    const start = from + tooth * SPIKE_WIDTH_METERS;
    const left = pointAlongEdge(face, start);
    const right = pointAlongEdge(face, start + SPIKE_WIDTH_METERS);
    const apex = pointAlongEdge(face, start + SPIKE_WIDTH_METERS / 2);
    const tip = {
      x: apex.x + face.normal.x * SPIKE_HEIGHT_METERS,
      y: apex.y + face.normal.y * SPIKE_HEIGHT_METERS,
    };
    sides.push(segment(left, tip), segment(tip, right));
  }
  const base: Segment = {
    from: pointAlongEdge(face, from),
    to: pointAlongEdge(face, from + rowLength(teeth)),
    direction: face.direction,
    normal: face.normal,
    length: rowLength(teeth),
  };
  return { base, teeth, extendedAtStart, sides };
}

/** A tooth side run counter-clockwise round the tooth, so its outward normal points away from the solid. */
function segment(from: Vector2, to: Vector2): Segment {
  const direction = normalize(subtract(to, from));
  return { from, to, direction, normal: rightNormal(direction), length: distance(from, to) };
}

export function initialSpikes(level: Level): readonly boolean[] {
  return level.spikes.map(row => row.extendedAtStart);
}

/**
 * The rows after a stroke is played: every row flips, except a retracted
 * one whose teeth would rise into the ball where it lies — that row stays
 * down until the ball has left it. A standing row always sinks: that can
 * hurt nobody.
 */
export function toggleSpikes(
  level: Level,
  extended: readonly boolean[],
  ball: Vector2
): readonly boolean[] {
  return level.spikes.map((row, index) =>
    !extended[index] && touchesBall(row, ball) ? false : !extended[index]
  );
}

/** Whether the row's standing teeth would reach a ball centred at `ball`. */
export function touchesBall(row: SpikeRow, ball: Vector2): boolean {
  return reachesPoint(row.sides, ball, BALL_RADIUS_METERS + FREEZE_CLEARANCE_METERS);
}

/** The earliest extended tooth the moving circle touches, if any. */
export function sweepCircleAgainstSpikes(
  level: Level,
  extended: readonly boolean[],
  from: Vector2,
  to: Vector2,
  radius: number
): SegmentHit | undefined {
  let best: SegmentHit | undefined;
  const { spikes } = level;
  const reach = distance(from, to) + radius + SPIKE_HEIGHT_METERS;
  for (let index = 0; index < spikes.length; index += 1) {
    // The course holds hundreds of rows: only one within its own length of the motion can be met.
    if (
      !extended[index] ||
      distance(spikes[index].base.from, from) > spikes[index].base.length + reach
    ) {
      continue;
    }
    const { sides } = spikes[index];
    for (let sideIndex = 0; sideIndex < sides.length; sideIndex += 1) {
      const hit = sweepCircleAgainstSegment(from, to, radius, sides[sideIndex]);
      if (hit !== undefined && (best === undefined || hit.time < best.time)) {
        best = hit;
      }
    }
  }
  return best;
}
