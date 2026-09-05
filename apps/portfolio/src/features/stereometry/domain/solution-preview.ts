import { vec3 } from 'wgpu-matrix';

import { computeMvpMatrix, computeProjectionMatrix, viewportAspect } from './camera-projection';
import { DEPTH_FADE_MIN, DEPTH_FADE_RATE } from './constants';
import { preparePuzzle } from './geometry';
import { positionsMatch } from './geometry-utils';
import { IntersectionCache } from './intersection';
import { rayTriangleIntersect } from './math';
import {
  computeEyePosition,
  computeUpVector,
  computeViewMatrix,
  resolveCameraSettings,
} from './orbit-camera';
import type { StyleModifier } from './render-types';
import { buildRepresentation } from './representation';
import { projectPoint, projectSegment } from './screen-projection';
import { computeSolutionStatus } from './solution-check';
import { createTopologyFromPuzzle } from './topology';
import type { FigureTopology, SceneTopology, TopologyLine, Vec3Array } from './topology-types';
import { SELECTION_NONE } from './topology-types';
import type { PuzzleDefinition } from './types';

/** How close to a face a point may sit and still count as unoccluded by it. */
const OCCLUSION_EPSILON = 1e-4;

export interface Point2 {
  readonly x: number;
  readonly y: number;
}

export interface PreviewSegment {
  readonly start: Point2;
  readonly end: Point2;
  readonly modifiers: readonly StyleModifier[];
  /** Behind a figure face as seen from the camera. */
  readonly hidden: boolean;
  /** Opacity factor of the scene's depth fade: 1 at the camera target and in front of it. */
  readonly depthFade: number;
}

export interface PreviewMarker {
  readonly position: Point2;
  readonly modifiers: readonly StyleModifier[];
  readonly hidden: boolean;
  readonly depthFade: number;
}

export interface SolutionPreview {
  readonly width: number;
  readonly height: number;
  /** Solution polygons in screen space, drawn beneath everything else. */
  readonly faces: readonly (readonly Point2[])[];
  /** Hidden segments first, so the visible ones paint over them. */
  readonly segments: readonly PreviewSegment[];
  readonly markers: readonly PreviewMarker[];
}

/**
 * The scene a solver ends with: expected lines drawn as construction lines and
 * polygon edges as finite construction segments. They enter through the
 * puzzle input so intersections are computed once, and are then released
 * from `isInput` so they style as the solver's own work.
 */
function buildSolvedTopology(
  puzzle: PuzzleDefinition,
  figureTopology: FigureTopology,
  cache: IntersectionCache
): SceneTopology {
  const solutionLines = puzzle.expected.lines ?? [];
  const solutionSegments = (puzzle.expected.faces ?? []).flatMap(face =>
    face.map((point, index): readonly [Vec3Array, Vec3Array] => [
      point,
      face[(index + 1) % face.length],
    ])
  );
  const topology = createTopologyFromPuzzle(
    figureTopology,
    {
      ...puzzle.input,
      lines: [...(puzzle.input.lines ?? []), ...solutionLines],
      segments: [...(puzzle.input.segments ?? []), ...solutionSegments],
    },
    cache
  );
  const isSolutionLine = (line: TopologyLine): boolean =>
    [...solutionLines, ...solutionSegments].some(
      ([pointA, pointB]) =>
        (positionsMatch(line.pointA, pointA) && positionsMatch(line.pointB, pointB)) ||
        (positionsMatch(line.pointA, pointB) && positionsMatch(line.pointB, pointA))
    );

  return {
    ...topology,
    lines: topology.lines.map(line => (isSolutionLine(line) ? { ...line, isInput: false } : line)),
  };
}

/**
 * Whether a figure face stands between the eye and the point. The scene is
 * split at every face crossing, so testing a segment's midpoint decides the
 * whole segment. This is the CPU twin of the depth pre-pass sampling in
 * `line.wgsl` / `vertex-marker.wgsl`: change the occlusion rule in both.
 */
function isOccluded(figureTopology: FigureTopology, eye: Vec3Array, point: Vec3Array): boolean {
  const toPoint = vec3.sub(point, eye);
  const distance = vec3.len(toPoint);
  const direction = vec3.normalize(toPoint) as Vec3Array;

  return figureTopology.faceTriangles.some(([indexA, indexB, indexC]) => {
    const hit = rayTriangleIntersect(
      eye,
      direction,
      figureTopology.vertices[indexA],
      figureTopology.vertices[indexB],
      figureTopology.vertices[indexC]
    );
    return hit !== undefined && hit > OCCLUSION_EPSILON && hit < distance - OCCLUSION_EPSILON;
  });
}

/** The GPU's `computeDepthFade`: only what lies beyond the target along the view axis fades. */
function depthFadeAt(
  point: Vec3Array,
  center: Vec3Array,
  forward: Vec3Array,
  cameraDistance: number
): number {
  const normalizedDepth = vec3.dot(vec3.sub(point, center), forward) / cameraDistance;
  return Math.min(1, Math.max(DEPTH_FADE_MIN, 1 - normalizedDepth * DEPTH_FADE_RATE));
}

function midpoint(pointA: Vec3Array, pointB: Vec3Array): Vec3Array {
  return [(pointA[0] + pointB[0]) / 2, (pointA[1] + pointB[1]) / 2, (pointA[2] + pointB[2]) / 2];
}

/** Projects the solved puzzle through its own camera into a `width` × `height` picture. */
export function buildSolutionPreview(
  puzzle: PuzzleDefinition,
  width: number,
  height: number
): SolutionPreview {
  const { topology: figureTopology } = preparePuzzle(puzzle);
  const cache = new IntersectionCache();
  const topology = buildSolvedTopology(puzzle, figureTopology, cache);
  const solutionStatus = computeSolutionStatus(puzzle.expected, topology);
  const representation = buildRepresentation(
    figureTopology,
    topology.lines,
    topology.vertices,
    SELECTION_NONE,
    undefined,
    solutionStatus
  );

  const camera = resolveCameraSettings(puzzle.camera);
  const eye = computeEyePosition(
    camera.center,
    camera.azimuth,
    camera.elevation,
    camera.initialDistance
  );
  const forward = vec3.normalize(vec3.sub(camera.center, eye)) as Vec3Array;
  const fadeAt = (point: Vec3Array): number =>
    depthFadeAt(point, camera.center, forward, camera.initialDistance);
  const mvp = computeMvpMatrix(
    computeProjectionMatrix(
      camera.projection,
      viewportAspect(width, height),
      camera.initialDistance
    ),
    computeViewMatrix(eye, camera.center, computeUpVector(camera.azimuth, camera.elevation))
  );

  const segments = representation.segments.flatMap((segment): PreviewSegment[] => {
    const projected = projectSegment(
      mvp,
      segment.startPosition,
      segment.endPosition,
      width,
      height
    );
    if (projected.start.behindCamera) {
      return [];
    }
    const middle = midpoint(segment.startPosition, segment.endPosition);
    return [
      {
        start: { x: projected.start.screenX, y: projected.start.screenY },
        end: { x: projected.end.screenX, y: projected.end.screenY },
        modifiers: segment.modifiers,
        hidden: isOccluded(figureTopology, eye, middle),
        depthFade: fadeAt(middle),
      },
    ];
  });

  const markers = representation.markers.flatMap((marker): PreviewMarker[] => {
    const projected = projectPoint(mvp, marker.position, width, height);
    if (projected.behindCamera) {
      return [];
    }
    return [
      {
        position: { x: projected.screenX, y: projected.screenY },
        modifiers: marker.modifiers,
        hidden: isOccluded(figureTopology, eye, marker.position),
        depthFade: fadeAt(marker.position),
      },
    ];
  });

  const faces = (puzzle.expected.faces ?? []).map(face =>
    face
      .map(point => projectPoint(mvp, point, width, height))
      .filter(projected => !projected.behindCamera)
      .map((projected): Point2 => ({ x: projected.screenX, y: projected.screenY }))
  );

  return {
    width,
    height,
    faces,
    segments: [
      ...segments.filter(segment => segment.hidden),
      ...segments.filter(segment => !segment.hidden),
    ],
    markers: [
      ...markers.filter(marker => marker.hidden),
      ...markers.filter(marker => !marker.hidden),
    ],
  };
}
