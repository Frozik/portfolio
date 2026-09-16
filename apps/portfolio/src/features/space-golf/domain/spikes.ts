import type { Vector2 } from '@frozik/utils/math/vector2';

import type { SegmentHit } from './collision';
import { sweepCircleAgainstSegment } from './collision';
import {
  BALL_RADIUS_METERS,
  SPIKE_FREEZE_CLEARANCE_METERS,
  SPIKE_HEIGHT_METERS,
  SPIKE_WIDTH_METERS,
} from './constants';
import type { EdgeRef, Level, Segment, SpikeRow, Wall } from './level';
import { pointAlongEdge } from './level';
import { distance, dot, normalize, rightNormal, subtract } from './vector';

export function rowLength(teeth: number): number {
  return teeth * SPIKE_WIDTH_METERS;
}

/** A row on a face of `walls`: the sides of its teeth are laid out once here, for the sweep and the renderer alike. */
export function createSpikeRow(
  walls: readonly Wall[],
  ref: EdgeRef,
  from: number,
  teeth: number,
  extendedAtStart: boolean
): SpikeRow {
  const edge = walls[ref.wall].edges[ref.edge];
  const sides: Segment[] = [];
  for (let tooth = 0; tooth < teeth; tooth += 1) {
    const base = from + tooth * SPIKE_WIDTH_METERS;
    const left = pointAlongEdge(edge, base);
    const right = pointAlongEdge(edge, base + SPIKE_WIDTH_METERS);
    const apex = pointAlongEdge(edge, base + SPIKE_WIDTH_METERS / 2);
    const tip = {
      x: apex.x + edge.normal.x * SPIKE_HEIGHT_METERS,
      y: apex.y + edge.normal.y * SPIKE_HEIGHT_METERS,
    };
    sides.push(segment(left, tip), segment(tip, right));
  }
  return { ...ref, from, teeth, extendedAtStart, sides };
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
 * The rows after a stroke is played: every row flips, except one whose
 * teeth would rise into the ball where it lies — that row keeps its state
 * until the ball has left it.
 */
export function toggleSpikes(
  level: Level,
  extended: readonly boolean[],
  ball: Vector2
): readonly boolean[] {
  return level.spikes.map((row, index) =>
    touchesBall(row, ball) ? extended[index] : !extended[index]
  );
}

function touchesBall(row: SpikeRow, ball: Vector2): boolean {
  const reach = BALL_RADIUS_METERS + SPIKE_FREEZE_CLEARANCE_METERS;
  return row.sides.some(side => distanceToSegment(ball, side) <= reach);
}

function distanceToSegment(point: Vector2, side: Segment): number {
  const offset = subtract(point, side.from);
  const along = Math.min(Math.max(dot(offset, side.direction), 0), side.length);
  return distance(point, pointAlongEdge(side, along));
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
  level.spikes.forEach((row, index) => {
    if (!extended[index]) {
      return;
    }
    for (const side of row.sides) {
      const hit = sweepCircleAgainstSegment(from, to, radius, side);
      if (hit !== undefined && (best === undefined || hit.time < best.time)) {
        best = hit;
      }
    }
  });
  return best;
}
