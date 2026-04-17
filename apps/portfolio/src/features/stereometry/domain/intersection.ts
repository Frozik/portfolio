import { assert } from '@frozik/utils';
import { vec3 } from 'wgpu-matrix';
import { LINE_INTERSECTION_MAX_DISTANCE } from './constants';
import { isNearAnyPoint } from './math';
import type { FigureTopology, IntersectionEntity, TopologyLine, Vec3Array } from './topology-types';

/** Minimum denominator to consider lines non-parallel */
const PARALLEL_EPSILON = 1e-10;

/** Distance squared threshold to consider a point coincident with an existing vertex.
 * Keep tight to avoid filtering valid nearby intersections (e.g., line crossing edge near vertex). */
const VERTEX_COINCIDENCE_THRESHOLD_SQUARED = 1e-5;

/** Distance squared threshold to consider two intersection points as duplicates */
const DUPLICATE_THRESHOLD_SQUARED = 0.0001;

const POSITION_KEY_PRECISION = 6;

interface LineDefinition {
  readonly point: Vec3Array;
  readonly direction: Vec3Array;
  readonly isSegment: boolean;
  readonly lineId: number;
}

interface CachedIntersection {
  readonly position: Vec3Array;
  readonly sourceLineIds: readonly number[];
}

interface ClosestPointResult {
  readonly midpoint: Vec3Array;
  readonly parameterA: number;
  readonly parameterB: number;
}

function lineKey(line: TopologyLine): string {
  const pointA = line.pointA;
  const pointB = line.pointB;
  const isInfinite =
    line.kind === 'line' || line.kind === 'edge-extended' || line.kind === 'segment-extended';
  const kindSuffix = isInfinite ? 'l' : 's';
  return `${pointA[0].toFixed(POSITION_KEY_PRECISION)},${pointA[1].toFixed(POSITION_KEY_PRECISION)},${pointA[2].toFixed(POSITION_KEY_PRECISION)}|${pointB[0].toFixed(POSITION_KEY_PRECISION)},${pointB[1].toFixed(POSITION_KEY_PRECISION)},${pointB[2].toFixed(POSITION_KEY_PRECISION)}|${kindSuffix}`;
}

function pairKey(keyA: string, keyB: string): string {
  return keyA < keyB ? `${keyA}||${keyB}` : `${keyB}||${keyA}`;
}

function edgePairKey(lineKeyValue: string, edgeIndex: number): string {
  return `${lineKeyValue}||e:${edgeIndex}`;
}

/**
 * Incremental intersection cache. Tracks line identity by content (pointA, pointB, isSegment).
 * On each compute(), diffs current lines against the previous set:
 * - Added lines: compute intersections with all other lines + all edges
 * - Removed lines: discard cached results involving those lines
 * - Unchanged lines: reuse cached results
 */
export class IntersectionCache {
  /** Cached intersection per pair key (line-line or line-edge). undefined = no intersection */
  private readonly cache = new Map<string, CachedIntersection | undefined>();

  /** Line keys from the previous compute() call */
  private previousLineKeys = new Set<string>();

  compute(lines: readonly TopologyLine[], topology: FigureTopology): readonly IntersectionEntity[] {
    const currentKeys = new Map<string, LineDefinition>();

    for (const line of lines) {
      const key = lineKey(line);
      if (!currentKeys.has(key)) {
        currentKeys.set(key, {
          point: line.pointA,
          direction: vec3.sub(line.pointB, line.pointA),
          isSegment: line.kind === 'edge' || line.kind === 'segment',
          lineId: line.lineId,
        });
      }
    }

    const currentKeySet = new Set(currentKeys.keys());

    // Find added and removed line keys
    const addedKeys: string[] = [];
    for (const key of currentKeySet) {
      if (!this.previousLineKeys.has(key)) {
        addedKeys.push(key);
      }
    }

    const removedKeys: string[] = [];
    for (const key of this.previousLineKeys) {
      if (!currentKeySet.has(key)) {
        removedKeys.push(key);
      }
    }

    // Invalidate cache entries involving removed lines
    if (removedKeys.length > 0) {
      const removedSet = new Set(removedKeys);
      for (const cacheKey of this.cache.keys()) {
        for (const removed of removedSet) {
          if (cacheKey.includes(removed)) {
            this.cache.delete(cacheKey);
            break;
          }
        }
      }
    }

    // Compute intersections for added lines
    const allKeys = [...currentKeySet];

    for (const addedKey of addedKeys) {
      const addedLine = currentKeys.get(addedKey);
      assert(addedLine !== undefined, `Missing line definition for key: ${addedKey}`);

      // vs all other lines
      for (const otherKey of allKeys) {
        if (otherKey === addedKey) {
          continue;
        }

        const pk = pairKey(addedKey, otherKey);
        if (this.cache.has(pk)) {
          continue;
        }

        const otherLine = currentKeys.get(otherKey);
        assert(otherLine !== undefined, `Missing line definition for key: ${otherKey}`);
        const position = computeBoundedIntersection(addedLine, otherLine);
        this.cache.set(
          pk,
          position !== undefined
            ? { position, sourceLineIds: [addedLine.lineId, otherLine.lineId] }
            : undefined
        );
      }

      // vs all edges
      for (let edgeIndex = 0; edgeIndex < topology.edges.length; edgeIndex++) {
        const ek = edgePairKey(addedKey, edgeIndex);
        if (this.cache.has(ek)) {
          continue;
        }

        const position = computeBoundedIntersection(addedLine, getEdgeLine(edgeIndex, topology));
        this.cache.set(
          ek,
          position !== undefined ? { position, sourceLineIds: [addedLine.lineId] } : undefined
        );
      }
    }

    this.previousLineKeys = currentKeySet;

    // Collect all cached intersection points and deduplicate
    return collectIntersections(this.cache, topology.vertices);
  }
}

/**
 * Computes all intersections from scratch (no caching).
 * Used by tests and one-off computations.
 */
export function computeAllIntersections(
  lines: readonly TopologyLine[],
  topology: FigureTopology
): readonly IntersectionEntity[] {
  const allLines: LineDefinition[] = lines.map(line => ({
    point: line.pointA,
    direction: vec3.sub(line.pointB, line.pointA),
    isSegment: line.kind === 'edge' || line.kind === 'segment',
    lineId: line.lineId,
  }));

  const cache = new Map<string, CachedIntersection | undefined>();

  for (let indexA = 0; indexA < allLines.length; indexA++) {
    for (let indexB = indexA + 1; indexB < allLines.length; indexB++) {
      const position = computeBoundedIntersection(allLines[indexA], allLines[indexB]);
      cache.set(
        `${indexA}||${indexB}`,
        position !== undefined
          ? { position, sourceLineIds: [allLines[indexA].lineId, allLines[indexB].lineId] }
          : undefined
      );
    }

    for (let edgeIndex = 0; edgeIndex < topology.edges.length; edgeIndex++) {
      const position = computeBoundedIntersection(
        allLines[indexA],
        getEdgeLine(edgeIndex, topology)
      );
      cache.set(
        `${indexA}||e:${edgeIndex}`,
        position !== undefined ? { position, sourceLineIds: [allLines[indexA].lineId] } : undefined
      );
    }
  }

  return collectIntersections(cache, topology.vertices);
}

function collectIntersections(
  cache: ReadonlyMap<string, CachedIntersection | undefined>,
  topologyVertices: readonly Vec3Array[]
): readonly IntersectionEntity[] {
  const results: IntersectionEntity[] = [];
  const resultPositions: Vec3Array[] = [];

  for (const cached of cache.values()) {
    if (cached === undefined) {
      continue;
    }

    if (isNearAnyPoint(cached.position, topologyVertices, VERTEX_COINCIDENCE_THRESHOLD_SQUARED)) {
      continue;
    }

    // Check for duplicate — if found, merge sourceLineIds into the existing entry
    const duplicateIndex = findNearPointIndex(
      cached.position,
      resultPositions,
      DUPLICATE_THRESHOLD_SQUARED
    );

    if (duplicateIndex !== undefined) {
      const existing = results[duplicateIndex];
      const mergedIds = [...new Set([...existing.sourceLineIds, ...cached.sourceLineIds])];
      results[duplicateIndex] = { position: existing.position, sourceLineIds: mergedIds };
      continue;
    }

    results.push({ position: cached.position, sourceLineIds: [...cached.sourceLineIds] });
    resultPositions.push(cached.position);
  }

  return results;
}

function findNearPointIndex(
  target: Vec3Array,
  points: readonly Vec3Array[],
  thresholdSquared: number
): number | undefined {
  for (let index = 0; index < points.length; index++) {
    if (vec3.distSq(target, points[index]) < thresholdSquared) {
      return index;
    }
  }
  return undefined;
}

/**
 * Computes the intersection between two lines, respecting segment bounds.
 * Infinite lines have unbounded parameters; segments are bounded to [0, 1].
 */
function computeBoundedIntersection(
  lineA: LineDefinition,
  lineB: LineDefinition
): Vec3Array | undefined {
  const closest = closestPointBetweenLines(
    lineA.point,
    lineA.direction,
    lineB.point,
    lineB.direction
  );

  if (closest === undefined) {
    return undefined;
  }

  if (lineA.isSegment && (closest.parameterA < 0 || closest.parameterA > 1)) {
    return undefined;
  }

  if (lineB.isSegment && (closest.parameterB < 0 || closest.parameterB > 1)) {
    return undefined;
  }

  return closest.midpoint;
}

function getEdgeLine(edgeIndex: number, topology: FigureTopology): LineDefinition {
  const [vertexIndexA, vertexIndexB] = topology.edges[edgeIndex];
  const point = topology.vertices[vertexIndexA];
  const endPoint = topology.vertices[vertexIndexB];
  return { point, direction: vec3.sub(endPoint, point), isSegment: true, lineId: -1 };
}

/**
 * Closest point between two lines: P + s*D and Q + t*E.
 * Returns midpoint of closest approach plus both parameters.
 */
function closestPointBetweenLines(
  pointP: Vec3Array,
  directionD: Vec3Array,
  pointQ: Vec3Array,
  directionE: Vec3Array
): ClosestPointResult | undefined {
  const dotDD = vec3.dot(directionD, directionD);
  const dotDE = vec3.dot(directionD, directionE);
  const dotEE = vec3.dot(directionE, directionE);
  const denominator = dotDD * dotEE - dotDE * dotDE;

  if (Math.abs(denominator) < PARALLEL_EPSILON) {
    return undefined;
  }

  const w = vec3.sub(pointP, pointQ);
  const dotDW = vec3.dot(directionD, w);
  const dotEW = vec3.dot(directionE, w);

  const parameterA = (dotDE * dotEW - dotEE * dotDW) / denominator;
  const parameterB = (dotDD * dotEW - dotDE * dotDW) / denominator;

  const closestOnA = vec3.addScaled(pointP, directionD, parameterA);
  const closestOnB = vec3.addScaled(pointQ, directionE, parameterB);

  if (vec3.distSq(closestOnA, closestOnB) > LINE_INTERSECTION_MAX_DISTANCE ** 2) {
    return undefined;
  }

  return {
    midpoint: [
      (closestOnA[0] + closestOnB[0]) * 0.5,
      (closestOnA[1] + closestOnB[1]) * 0.5,
      (closestOnA[2] + closestOnB[2]) * 0.5,
    ],
    parameterA,
    parameterB,
  };
}
