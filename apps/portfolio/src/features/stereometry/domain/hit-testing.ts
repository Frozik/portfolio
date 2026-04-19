import { vec4 } from 'wgpu-matrix';

import {
  EDGE_HIT_RADIUS_PIXELS,
  HIT_DEPTH_WEIGHT,
  HIT_LINE_TYPE_BONUS,
  HIT_PROXIMITY_WEIGHT,
  HIT_SEGMENT_TYPE_BONUS,
  HIT_VERTEX_TYPE_BONUS,
  HOMOGENEOUS_W,
  VERTEX_HIT_RADIUS_PIXELS,
} from './constants';
import { extendLine } from './math';
import type { TopologyLine, Vec3Array } from './topology-types';

/** A unified hit result. A vertex hit carries a world-space position; a line hit carries the topology lineId. */
export type SceneHit =
  | { readonly type: 'vertex'; readonly position: Vec3Array }
  | { readonly type: 'line'; readonly lineId: number };

/** Which candidate types participate in a given `hitTestScene` call. */
export type AllowedHitTypes = readonly SceneHit['type'][];
const ALL_HIT_TYPES: AllowedHitTypes = ['vertex', 'line'];

/**
 * Unified CPU hit test. Collects all vertices and lines within their
 * respective screen-space thresholds, scores each candidate by combining
 * 2D cursor proximity, depth (closeness to the viewer), and a per-type
 * bonus, then returns the highest-scoring candidate.
 *
 * Pass `allowedTypes` to restrict which candidate types participate — e.g.
 * during drag-to-connect, use `['vertex']` so lines don't compete for the
 * snap target.
 *
 * Topology edges are non-interactive and must be omitted from `lines`.
 */
export function hitTestScene(
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  devicePixelRatio: number,
  mvpMatrix: Float32Array,
  lines: readonly TopologyLine[],
  vertexPositions: readonly Vec3Array[],
  allowedTypes: AllowedHitTypes = ALL_HIT_TYPES
): SceneHit | undefined {
  const gpuCanvasWidth = canvasWidth * devicePixelRatio;
  const gpuCanvasHeight = canvasHeight * devicePixelRatio;
  const pixelX = screenX * devicePixelRatio;
  const pixelY = screenY * devicePixelRatio;
  const vertexThreshold = VERTEX_HIT_RADIUS_PIXELS * devicePixelRatio;
  const lineThreshold = EDGE_HIT_RADIUS_PIXELS * devicePixelRatio;
  const vertexThresholdSquared = vertexThreshold ** 2;
  const lineThresholdSquared = lineThreshold ** 2;

  const candidates: HitCandidate[] = [];

  if (allowedTypes.includes('vertex')) {
    collectVertexCandidates(
      mvpMatrix,
      vertexPositions,
      pixelX,
      pixelY,
      gpuCanvasWidth,
      gpuCanvasHeight,
      vertexThreshold,
      vertexThresholdSquared,
      candidates
    );
  }

  if (allowedTypes.includes('line')) {
    collectLineCandidates(
      mvpMatrix,
      lines,
      pixelX,
      pixelY,
      gpuCanvasWidth,
      gpuCanvasHeight,
      lineThreshold,
      lineThresholdSquared,
      candidates
    );
  }

  return pickBestCandidate(candidates);
}

interface ProjectedVertex {
  readonly screenX: number;
  readonly screenY: number;
  readonly behindCamera: boolean;
  /** View-space distance from camera (clip.w). Smaller = closer to viewer. */
  readonly depth: number;
}

interface ProjectedSegment {
  readonly start: ProjectedVertex;
  readonly end: ProjectedVertex;
}

interface HitCandidate {
  readonly hit: SceneHit;
  /** 0.0 directly under the cursor, 1.0 at the hit threshold edge. */
  readonly normalizedDistance: number;
  /** View-space distance from camera; smaller = closer to viewer. */
  readonly depth: number;
  /** Additive score bonus for this candidate's type. */
  readonly typeBonus: number;
}

/** Minimum w for near-plane clipping (matches NEAR_CLIP_W in common.wgsl) */
const NEAR_CLIP_W = 0.01;

function collectVertexCandidates(
  mvpMatrix: Float32Array,
  vertexPositions: readonly Vec3Array[],
  pixelX: number,
  pixelY: number,
  gpuCanvasWidth: number,
  gpuCanvasHeight: number,
  vertexThreshold: number,
  vertexThresholdSquared: number,
  candidates: HitCandidate[]
): void {
  for (let index = 0; index < vertexPositions.length; index++) {
    const projected = projectVertexToScreen(
      mvpMatrix,
      vertexPositions[index],
      gpuCanvasWidth,
      gpuCanvasHeight
    );
    if (projected.behindCamera) {
      continue;
    }

    const deltaX = projected.screenX - pixelX;
    const deltaY = projected.screenY - pixelY;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;
    if (distanceSquared >= vertexThresholdSquared) {
      continue;
    }

    candidates.push({
      hit: { type: 'vertex', position: vertexPositions[index] },
      normalizedDistance: Math.sqrt(distanceSquared) / vertexThreshold,
      depth: projected.depth,
      typeBonus: HIT_VERTEX_TYPE_BONUS,
    });
  }
}

function collectLineCandidates(
  mvpMatrix: Float32Array,
  lines: readonly TopologyLine[],
  pixelX: number,
  pixelY: number,
  gpuCanvasWidth: number,
  gpuCanvasHeight: number,
  lineThreshold: number,
  lineThresholdSquared: number,
  candidates: HitCandidate[]
): void {
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const isFiniteSegment = line.kind === 'edge' || line.kind === 'segment';
    const [start, end] = isFiniteSegment
      ? [line.pointA, line.pointB]
      : extendLine(line.pointA, line.pointB);
    const projected = projectSegmentToScreen(
      mvpMatrix,
      start,
      end,
      gpuCanvasWidth,
      gpuCanvasHeight
    );

    if (projected.start.behindCamera || projected.end.behindCamera) {
      continue;
    }

    const { distanceSquared, parameter } = pointToSegmentDistance(
      pixelX,
      pixelY,
      projected.start.screenX,
      projected.start.screenY,
      projected.end.screenX,
      projected.end.screenY
    );
    if (distanceSquared >= lineThresholdSquared) {
      continue;
    }

    // Perspective-correct depth at the cursor's closest point on the projected
    // segment. In perspective projection, `1/depth` is linear in screen-space
    // parameter; naïve linear lerp of `depth` gives nonsense for long segments
    // with very different endpoint depths (e.g. extended construction lines),
    // which then loses the depth-score competition against nearby vertices.
    const depthAtClosest =
      (projected.start.depth * projected.end.depth) /
      ((1 - parameter) * projected.end.depth + parameter * projected.start.depth);

    // `segment-extended` and `edge-extended` are still the same user-facing
    // object as the source segment — just visually elongated. Keep them on
    // the segment bonus so a quick sequence of double-taps (extend → collapse
    // on the same spot) doesn't suddenly lose to a neighbouring vertex.
    // Only pure construction lines (`kind === 'line'`) get the infinite-line bonus.
    const typeBonus = line.kind === 'line' ? HIT_LINE_TYPE_BONUS : HIT_SEGMENT_TYPE_BONUS;

    candidates.push({
      hit: { type: 'line', lineId: line.lineId },
      normalizedDistance: Math.sqrt(distanceSquared) / lineThreshold,
      depth: depthAtClosest,
      typeBonus,
    });
  }
}

function projectVertexToScreen(
  mvpMatrix: Float32Array,
  vertex: Vec3Array,
  gpuCanvasWidth: number,
  gpuCanvasHeight: number
): ProjectedVertex {
  const clipSpace = vec4.transformMat4(
    vec4.fromValues(vertex[0], vertex[1], vertex[2], HOMOGENEOUS_W),
    mvpMatrix
  );

  if (clipSpace[3] <= 0) {
    return {
      screenX: 0,
      screenY: 0,
      behindCamera: true,
      depth: Number.POSITIVE_INFINITY,
    };
  }

  const ndcX = clipSpace[0] / clipSpace[3];
  const ndcY = clipSpace[1] / clipSpace[3];

  return {
    screenX: (ndcX + 1) * 0.5 * gpuCanvasWidth,
    screenY: (1 - ndcY) * 0.5 * gpuCanvasHeight,
    behindCamera: false,
    depth: clipSpace[3],
  };
}

/**
 * Projects two endpoints with near-plane clipping.
 * If one endpoint is behind the camera, interpolates it to the near plane
 * instead of discarding the entire segment.
 */
function projectSegmentToScreen(
  mvpMatrix: Float32Array,
  pointA: Vec3Array,
  pointB: Vec3Array,
  gpuCanvasWidth: number,
  gpuCanvasHeight: number
): ProjectedSegment {
  const clipA = vec4.transformMat4(
    vec4.fromValues(pointA[0], pointA[1], pointA[2], HOMOGENEOUS_W),
    mvpMatrix
  );
  const clipB = vec4.transformMat4(
    vec4.fromValues(pointB[0], pointB[1], pointB[2], HOMOGENEOUS_W),
    mvpMatrix
  );

  // Both behind camera — no visible segment
  if (clipA[3] <= 0 && clipB[3] <= 0) {
    return {
      start: {
        screenX: 0,
        screenY: 0,
        behindCamera: true,
        depth: Number.POSITIVE_INFINITY,
      },
      end: {
        screenX: 0,
        screenY: 0,
        behindCamera: true,
        depth: Number.POSITIVE_INFINITY,
      },
    };
  }

  // Clamp endpoints to near plane if behind camera
  const clampedA = clipA[3] < NEAR_CLIP_W ? clampToNearPlane(clipA, clipB) : clipA;
  const clampedB = clipB[3] < NEAR_CLIP_W ? clampToNearPlane(clipB, clipA) : clipB;

  return {
    start: clipToScreen(clampedA, gpuCanvasWidth, gpuCanvasHeight),
    end: clipToScreen(clampedB, gpuCanvasWidth, gpuCanvasHeight),
  };
}

function clampToNearPlane(point: Float32Array, other: Float32Array): Float32Array {
  const parametricT = (NEAR_CLIP_W - point[3]) / (other[3] - point[3]);
  return vec4.lerp(point, other, parametricT) as Float32Array;
}

function clipToScreen(
  clipSpace: Float32Array,
  gpuCanvasWidth: number,
  gpuCanvasHeight: number
): ProjectedVertex {
  const ndcX = clipSpace[0] / clipSpace[3];
  const ndcY = clipSpace[1] / clipSpace[3];
  return {
    screenX: (ndcX + 1) * 0.5 * gpuCanvasWidth,
    screenY: (1 - ndcY) * 0.5 * gpuCanvasHeight,
    behindCamera: false,
    depth: clipSpace[3],
  };
}

interface PointSegmentDistance {
  readonly distanceSquared: number;
  /** Clamped [0, 1] position along the segment at the nearest point to the query. */
  readonly parameter: number;
}

function pointToSegmentDistance(
  pointX: number,
  pointY: number,
  segmentStartX: number,
  segmentStartY: number,
  segmentEndX: number,
  segmentEndY: number
): PointSegmentDistance {
  const segmentDeltaX = segmentEndX - segmentStartX;
  const segmentDeltaY = segmentEndY - segmentStartY;
  const segmentLengthSquared = segmentDeltaX * segmentDeltaX + segmentDeltaY * segmentDeltaY;

  if (segmentLengthSquared === 0) {
    const deltaX = pointX - segmentStartX;
    const deltaY = pointY - segmentStartY;
    return { distanceSquared: deltaX * deltaX + deltaY * deltaY, parameter: 0 };
  }

  const projectionParameter = Math.max(
    0,
    Math.min(
      1,
      ((pointX - segmentStartX) * segmentDeltaX + (pointY - segmentStartY) * segmentDeltaY) /
        segmentLengthSquared
    )
  );

  const nearestX = segmentStartX + projectionParameter * segmentDeltaX;
  const nearestY = segmentStartY + projectionParameter * segmentDeltaY;

  const deltaX = pointX - nearestX;
  const deltaY = pointY - nearestY;
  return {
    distanceSquared: deltaX * deltaX + deltaY * deltaY,
    parameter: projectionParameter,
  };
}

/**
 * Picks the best-scoring candidate across vertices and lines. Each candidate
 * earns a proximity score (1.0 directly under the cursor, 0.0 at the threshold
 * edge) and a depth score (1.0 for the nearest candidate to the viewer, 0.0
 * for the farthest). A per-type bonus is added. Highest total wins.
 */
function pickBestCandidate(candidates: readonly HitCandidate[]): SceneHit | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  let minDepth = Number.POSITIVE_INFINITY;
  let maxDepth = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    if (candidate.depth < minDepth) {
      minDepth = candidate.depth;
    }
    if (candidate.depth > maxDepth) {
      maxDepth = candidate.depth;
    }
  }
  const depthSpread = maxDepth - minDepth;

  let bestScore = Number.NEGATIVE_INFINITY;
  let bestHit: SceneHit | undefined;
  for (const candidate of candidates) {
    const proximityScore = 1 - candidate.normalizedDistance;
    // When all candidates share the same depth (or there's only one),
    // the depth dimension carries no signal — assign a constant score.
    const depthScore = depthSpread > 0 ? 1 - (candidate.depth - minDepth) / depthSpread : 1;
    const totalScore =
      HIT_PROXIMITY_WEIGHT * proximityScore + HIT_DEPTH_WEIGHT * depthScore + candidate.typeBonus;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestHit = candidate.hit;
    }
  }
  return bestHit;
}
