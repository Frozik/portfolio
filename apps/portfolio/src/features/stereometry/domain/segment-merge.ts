import { vec3 } from 'wgpu-matrix';
import { NO_CONNECTED_VERTEX_INDEX } from './constants';
import type { RenderSegment } from './render-types';
import type { Vec3Array } from './topology-types';

/**
 * Cosine tolerance for treating two chained segment directions as co-linear.
 * Sub-segments of one line share their split-point floats bit-for-bit
 * (they come from the same paramToPosition call), so any direction mismatch
 * is pure float arithmetic noise — 1e-6 on the cosine is generous.
 */
const MERGE_COLLINEARITY_EPSILON = 1e-6;

const POSITION_KEY_DECIMALS = 6;

function pointKey(position: Vec3Array): string {
  return `${position[0].toFixed(POSITION_KEY_DECIMALS)},${position[1].toFixed(POSITION_KEY_DECIMALS)},${position[2].toFixed(POSITION_KEY_DECIMALS)}`;
}

/** Only identically styled pieces of the same logical line may merge */
function chainGroupKey(segment: RenderSegment): string {
  return `${segment.lineId}|${[...segment.modifiers].sort().join(':')}`;
}

function flipSegment(segment: RenderSegment): RenderSegment {
  return {
    ...segment,
    startPosition: segment.endPosition,
    endPosition: segment.startPosition,
    startVertexIndex: segment.endVertexIndex,
    endVertexIndex: segment.startVertexIndex,
  };
}

/** Normalized direction; zero-length segments yield a zero vector (never chainable) */
function segmentDirection(segment: RenderSegment): Vec3Array {
  return vec3.normalize(vec3.sub(segment.endPosition, segment.startPosition)) as Vec3Array;
}

/**
 * Checks whether `next` continues `previous` through their shared junction
 * (previous.endPosition == next.startPosition, guaranteed by the caller):
 *
 * - the junction must carry no scene vertex on either side — merging across
 *   a marker would erase its index from the line-id pass and break the
 *   marker's "connected lines don't occlude me" check in vertex-marker.wgsl;
 * - directions must be co-linear and co-oriented (same infinite line).
 */
function areChainable(previous: RenderSegment, next: RenderSegment): boolean {
  if (
    previous.endVertexIndex !== NO_CONNECTED_VERTEX_INDEX ||
    next.startVertexIndex !== NO_CONNECTED_VERTEX_INDEX
  ) {
    return false;
  }

  return (
    vec3.dot(segmentDirection(previous), segmentDirection(next)) > 1 - MERGE_COLLINEARITY_EPSILON
  );
}

/**
 * Extends `chain` forward through merge-eligible junctions at its end point.
 * A junction is eligible when exactly two segment endpoints of the group meet
 * there (no T-junctions) and `areChainable` holds for the oriented pair.
 */
function extendChainForward(
  chain: RenderSegment,
  group: readonly RenderSegment[],
  touchingSegmentIndexes: ReadonlyMap<string, readonly number[]>,
  consumed: boolean[]
): RenderSegment {
  const chainEndingAt = (last: RenderSegment): RenderSegment =>
    last === chain
      ? chain
      : { ...chain, endPosition: last.endPosition, endVertexIndex: last.endVertexIndex };

  let last = chain;
  let guard = group.length;

  while (guard > 0) {
    guard -= 1;

    const junctionKey = pointKey(last.endPosition);
    const touching = touchingSegmentIndexes.get(junctionKey) ?? [];
    if (touching.length !== 2) {
      break;
    }

    const nextIndex = touching.find(candidateIndex => !consumed[candidateIndex]);
    if (nextIndex === undefined) {
      break;
    }

    let next = group[nextIndex];
    if (pointKey(next.startPosition) !== junctionKey) {
      next = flipSegment(next);
    }

    if (!areChainable(chainEndingAt(last), next)) {
      break;
    }

    consumed[nextIndex] = true;
    last = next;
  }

  return chainEndingAt(last);
}

function mergeGroup(group: readonly RenderSegment[]): readonly RenderSegment[] {
  const touchingSegmentIndexes = new Map<string, number[]>();

  const register = (key: string, segmentIndex: number): void => {
    const bucket = touchingSegmentIndexes.get(key);
    if (bucket === undefined) {
      touchingSegmentIndexes.set(key, [segmentIndex]);
    } else {
      bucket.push(segmentIndex);
    }
  };

  for (let segmentIndex = 0; segmentIndex < group.length; segmentIndex++) {
    register(pointKey(group[segmentIndex].startPosition), segmentIndex);
    register(pointKey(group[segmentIndex].endPosition), segmentIndex);
  }

  const merged: RenderSegment[] = [];
  const consumed = new Array<boolean>(group.length).fill(false);

  for (let seedIndex = 0; seedIndex < group.length; seedIndex++) {
    if (consumed[seedIndex]) {
      continue;
    }
    consumed[seedIndex] = true;

    let chain = group[seedIndex];
    chain = extendChainForward(chain, group, touchingSegmentIndexes, consumed);
    // Extend backwards by flipping, extending forward, and flipping back
    chain = flipSegment(
      extendChainForward(flipSegment(chain), group, touchingSegmentIndexes, consumed)
    );

    merged.push(chain);
  }

  return merged;
}

/**
 * Merges chains of co-linear render segments that share endpoints, belong to
 * the same logical line, and carry identical modifier sets into single
 * segments. Junctions occupied by a scene vertex are never merged across
 * (see `areChainable`).
 *
 * Why: each segment is a separate GPU line instance with its own dash phase —
 * a long construction line split at face intersections renders fewer
 * instances and a continuous dash pattern after merging.
 */
export function mergeCollinearSegments(
  segments: readonly RenderSegment[]
): readonly RenderSegment[] {
  if (segments.length < 2) {
    return segments;
  }

  const groups = new Map<string, RenderSegment[]>();
  for (const segment of segments) {
    const key = chainGroupKey(segment);
    const bucket = groups.get(key);
    if (bucket === undefined) {
      groups.set(key, [segment]);
    } else {
      bucket.push(segment);
    }
  }

  const result: RenderSegment[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
    } else {
      result.push(...mergeGroup(group));
    }
  }

  return result;
}
