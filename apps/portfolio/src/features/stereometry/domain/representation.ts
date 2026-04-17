import { assertNever } from '@frozik/utils';
import { vec3 } from 'wgpu-matrix';
import { NO_CONNECTED_VERTEX_INDEX, STEREOMETRY_STYLES } from './constants';
import {
  isCollinearWithLine,
  POINT_ON_LINE_EPSILON_SQ,
  positionsMatch,
  projectPointOntoLine,
  VERTEX_MATCH_EPSILON_SQ,
} from './geometry-utils';
import { extendLine, isNearAnyPoint, isPointInsideOrOnSurface, rayTriangleIntersect } from './math';
import {
  deduplicateParameters,
  isDuplicateParameter,
  isInAnyInterval,
  isRangeInAnyInterval,
  mergeIntervals,
  POSITION_EPSILON,
} from './parametric-utils';
import type {
  LineInstanceStyle,
  MarkerInstanceStyle,
  RenderSegment,
  ResolvedElementStyle,
  SceneRepresentation,
  SolutionFaceRenderData,
  StyledMarker,
  StyledSegment,
} from './render-types';
import type { SolutionStatus } from './solution-check';
import { isSubSegmentInSolutionRange } from './solution-check';
import { hexToRgb, resolveStyle } from './styles-processor';
import type {
  FigureTopology,
  SelectionState,
  TopologyLine,
  TopologyVertex,
  Vec3Array,
} from './topology-types';
import { NO_VERTEX_ID } from './topology-types';

const COPLANAR_DISTANCE_THRESHOLD = 1e-4;

/**
 * Builds a complete scene representation from topology data.
 * Replaces the old processGraphics function.
 */
export function buildRepresentation(
  figureTopology: FigureTopology,
  lines: readonly TopologyLine[],
  vertices: readonly TopologyVertex[],
  selection: SelectionState,
  previewLine?: { readonly pointA: Vec3Array; readonly pointB: Vec3Array },
  solutionStatus?: SolutionStatus
): SceneRepresentation {
  const markers = buildMarkers(figureTopology, vertices, selection, solutionStatus);

  const renderSegments = buildSegments(
    figureTopology,
    lines,
    vertices,
    selection,
    previewLine,
    solutionStatus
  );
  const segments = renderSegments.map(segment => toStyledSegment(segment));

  const solutionFace = buildSolutionFace(solutionStatus);

  return { segments, markers, solutionFace };
}

/** Floats per solution-face vertex: position(3) + rgba(4) */
const SOLUTION_FACE_VERTEX_FLOATS = 7;

/**
 * Triangulates solution face polygons using fan triangulation from the first vertex.
 * Works for convex polygons (cross-section polygons are always convex).
 * Returns undefined when there are no faces to render.
 */
function buildSolutionFace(
  solutionStatus: SolutionStatus | undefined
): SolutionFaceRenderData | undefined {
  if (!solutionStatus?.isSolved) {
    return undefined;
  }
  const faces = solutionStatus.solutionFaces ?? [];
  if (faces.length === 0) {
    return undefined;
  }

  const resolved = resolveStyle(STEREOMETRY_STYLES, 'face', ['solution']);
  const [red, green, blue] = hexToRgb(resolved.color);
  const alpha = resolved.alpha;

  let totalTriangles = 0;
  for (const face of faces) {
    if (face.length >= 3) {
      totalTriangles += face.length - 2;
    }
  }

  if (totalTriangles === 0) {
    return undefined;
  }

  const vertexCount = totalTriangles * 3;
  const vertices = new Float32Array(vertexCount * SOLUTION_FACE_VERTEX_FLOATS);
  let writeOffset = 0;

  const writeVertex = (position: Vec3Array): void => {
    vertices[writeOffset] = position[0];
    vertices[writeOffset + 1] = position[1];
    vertices[writeOffset + 2] = position[2];
    vertices[writeOffset + 3] = red;
    vertices[writeOffset + 4] = green;
    vertices[writeOffset + 5] = blue;
    vertices[writeOffset + 6] = alpha;
    writeOffset += SOLUTION_FACE_VERTEX_FLOATS;
  };

  for (const face of faces) {
    if (face.length < 3) {
      continue;
    }
    const anchor = face[0];
    for (let index = 1; index < face.length - 1; index++) {
      writeVertex(anchor);
      writeVertex(face[index]);
      writeVertex(face[index + 1]);
    }
  }

  return { vertices, vertexCount };
}

function getEdgeEndpoints(
  figureTopology: FigureTopology,
  edgeIndex: number
): [Vec3Array, Vec3Array] {
  const [vertexA, vertexB] = figureTopology.edges[edgeIndex];
  return [figureTopology.vertices[vertexA], figureTopology.vertices[vertexB]];
}

function createRenderSegment(
  startPosition: Vec3Array,
  endPosition: Vec3Array,
  modifiers: readonly string[],
  lineId: number,
  startVertexIndex: number,
  endVertexIndex: number
): RenderSegment {
  return {
    startPosition,
    endPosition,
    modifiers,
    lineId,
    startVertexIndex,
    endVertexIndex,
  };
}

function resolvedToLineInstanceStyle(resolved: ResolvedElementStyle): LineInstanceStyle {
  const [red, green, blue] = hexToRgb(resolved.color);
  return {
    width: resolved.width,
    color: [red, green, blue],
    alpha: resolved.alpha,
    lineType: resolved.line.type === 'dashed' ? 1 : 0,
    dash: resolved.line.type === 'dashed' ? resolved.line.dash : 0,
    gap: resolved.line.type === 'dashed' ? resolved.line.gap : 0,
  };
}

function toStyledSegment(segment: RenderSegment): StyledSegment {
  const visibleResolved = resolveStyle(STEREOMETRY_STYLES, 'line', segment.modifiers);
  const hiddenResolved = resolveStyle(STEREOMETRY_STYLES, 'line', ['hidden', ...segment.modifiers]);

  return {
    startPosition: segment.startPosition,
    endPosition: segment.endPosition,
    visibleStyle: resolvedToLineInstanceStyle(visibleResolved),
    hiddenStyle: resolvedToLineInstanceStyle(hiddenResolved),
    lineId: segment.lineId,
    startVertexIndex: segment.startVertexIndex,
    endVertexIndex: segment.endVertexIndex,
  };
}

function resolvedToMarkerStyle(resolved: {
  size: number;
  color: string;
  alpha: number;
  strokeColor: string;
  strokeWidth: number;
}): MarkerInstanceStyle {
  const [red, green, blue] = hexToRgb(resolved.color);
  const [strokeR, strokeG, strokeB] = hexToRgb(resolved.strokeColor);
  return {
    size: resolved.size,
    color: [red, green, blue],
    alpha: resolved.alpha,
    strokeColor: [strokeR, strokeG, strokeB],
    strokeWidth: resolved.strokeWidth,
  };
}

function buildMarkers(
  figureTopology: FigureTopology,
  sceneVertices: readonly TopologyVertex[],
  selection: SelectionState,
  solutionStatus: SolutionStatus | undefined
): readonly StyledMarker[] {
  const markers: StyledMarker[] = [];

  for (let markerIndex = 0; markerIndex < sceneVertices.length; markerIndex++) {
    const vertex = sceneVertices[markerIndex];
    const position = vertex.position;
    const modifiers: string[] = [];

    if (vertex.kind === 'input') {
      modifiers.push('input');
    }

    const isTopologyVertex = isNearAnyPoint(
      position,
      figureTopology.vertices,
      VERTEX_MATCH_EPSILON_SQ
    );
    if (
      isTopologyVertex ||
      figureTopology.figureFaceTriangles.some(figureTriangles =>
        isPointInsideOrOnSurface(position, figureTriangles, figureTopology.vertices)
      )
    ) {
      modifiers.push('inner');
    }

    if (isVertexOnSelectedElement(vertex, selection)) {
      modifiers.push('selected');
    }

    if (
      solutionStatus?.isSolved &&
      solutionStatus.solutionVertexPositions.some(solutionPosition =>
        isNearAnyPoint(position, [solutionPosition], VERTEX_MATCH_EPSILON_SQ)
      )
    ) {
      modifiers.push('solution');
    }

    const visibleResolved = resolveStyle(STEREOMETRY_STYLES, 'vertex', modifiers);
    const hiddenResolved = resolveStyle(STEREOMETRY_STYLES, 'vertex', ['hidden', ...modifiers]);

    markers.push({
      position,
      markerType: visibleResolved.markerType === 'circle' ? 1 : 0,
      visibleStyle: resolvedToMarkerStyle(visibleResolved),
      hiddenStyle: resolvedToMarkerStyle(hiddenResolved),
      vertexIndex: markerIndex,
    });
  }

  return markers;
}

/** Sentinel lineId for the preview line (not associated with any topology line) */
const PREVIEW_LINE_ID = -2;

function buildSegments(
  figureTopology: FigureTopology,
  lines: readonly TopologyLine[],
  vertices: readonly TopologyVertex[],
  selection: SelectionState,
  previewLine: { readonly pointA: Vec3Array; readonly pointB: Vec3Array } | undefined,
  solutionStatus: SolutionStatus | undefined
): readonly RenderSegment[] {
  const selectedLineId = getSelectedLineId(selection);
  const selectedEdgeIndices = findSelectedEdgeIndices(selection, lines, figureTopology);

  const lineSegments: RenderSegment[] = [];

  for (const line of lines) {
    // Skip edges -- they are rendered by buildTopologyEdgeSegments
    if (line.kind === 'edge') {
      continue;
    }

    const segments = processLine(line, figureTopology, vertices);
    const isSelected = selectedLineId !== undefined && line.lineId === selectedLineId;

    for (const segment of segments) {
      // For infinite lines, sub-segments coincident with a collinear figure edge are marked 'segment' by processLine.
      // - 'edge-extended': this coincident portion IS the original edge — keep it and promote to 'edge' styling
      //   (buildTopologyEdgeSegments skips the extended edge to avoid duplicate render).
      // - 'line' and 'segment-extended': drop the coincident portion to avoid overlap with the finite element.
      const isInfiniteLine =
        line.kind === 'line' || line.kind === 'edge-extended' || line.kind === 'segment-extended';
      const isOnCollinearEdge = segment.modifiers.includes('segment');
      if (isInfiniteLine && isOnCollinearEdge && line.kind !== 'edge-extended') {
        continue;
      }

      const modifiers = [...segment.modifiers];

      if (line.kind === 'edge-extended' && isOnCollinearEdge && !modifiers.includes('edge')) {
        modifiers.push('edge');
      }

      if (line.isInput && line.kind !== 'edge-extended') {
        // For segment-extended: only the part within the original segment range gets 'input'
        if (line.kind === 'segment-extended') {
          if (isSubSegmentWithinRange(segment, line.pointA, line.pointB)) {
            modifiers.push('input');
          }
        } else {
          modifiers.push('input');
        }
      }

      if (line.kind === 'segment' && !modifiers.includes('segment')) {
        modifiers.push('segment');
      }

      if (isSelected) {
        modifiers.push('selected');
      }

      if (isSubSegmentInSolution(segment, solutionStatus)) {
        modifiers.push('solution');
      }

      lineSegments.push({ ...segment, modifiers });
    }
  }

  if (previewLine !== undefined) {
    const previewTopologyLine: TopologyLine = {
      lineId: PREVIEW_LINE_ID,
      pointA: previewLine.pointA,
      pointB: previewLine.pointB,
      kind: 'line',
      isInput: false,
      startVertexId: NO_VERTEX_ID,
      endVertexId: NO_VERTEX_ID,
    };
    const segments = processLine(previewTopologyLine, figureTopology, vertices);

    for (const segment of segments) {
      if (segment.modifiers.includes('segment')) {
        continue;
      }

      lineSegments.push({
        ...segment,
        modifiers: [...segment.modifiers, 'preview'],
      });
    }
  }

  const topologySegments = buildTopologyEdgeSegments(
    figureTopology,
    lines,
    vertices,
    selectedEdgeIndices,
    solutionStatus
  );

  return deduplicateSegments([...topologySegments, ...lineSegments]);
}

function isSubSegmentInSolution(
  segment: RenderSegment,
  solutionStatus: SolutionStatus | undefined
): boolean {
  if (!solutionStatus?.isSolved) {
    return false;
  }
  return solutionStatus.solutionLineRanges.some(([rangeStart, rangeEnd]) =>
    isSubSegmentInSolutionRange(segment.startPosition, segment.endPosition, rangeStart, rangeEnd)
  );
}

function deduplicateSegments(segments: readonly RenderSegment[]): readonly RenderSegment[] {
  const segmentMap = new Map<string, RenderSegment>();

  for (const segment of segments) {
    const key = segmentPositionKey(segment.startPosition, segment.endPosition);

    const existing = segmentMap.get(key);
    if (existing === undefined || segment.modifiers.length > existing.modifiers.length) {
      segmentMap.set(key, segment);
    }
  }

  return [...segmentMap.values()];
}

const POSITION_KEY_DECIMALS = 6;

function segmentPositionKey(start: Vec3Array, end: Vec3Array): string {
  const startKey = `${start[0].toFixed(POSITION_KEY_DECIMALS)},${start[1].toFixed(POSITION_KEY_DECIMALS)},${start[2].toFixed(POSITION_KEY_DECIMALS)}`;
  const endKey = `${end[0].toFixed(POSITION_KEY_DECIMALS)},${end[1].toFixed(POSITION_KEY_DECIMALS)},${end[2].toFixed(POSITION_KEY_DECIMALS)}`;
  return startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function getSelectedLineId(selection: SelectionState): number | undefined {
  switch (selection.type) {
    case 'line':
      return selection.lineId;
    case 'none':
      return undefined;
    default:
      assertNever(selection);
  }
}

function findSelectedEdgeIndices(
  selection: SelectionState,
  lines: readonly TopologyLine[],
  figureTopology: FigureTopology
): ReadonlySet<number> {
  const indices = new Set<number>();

  switch (selection.type) {
    case 'line': {
      const selectedLineId = selection.lineId;

      for (const line of lines) {
        if (line.lineId !== selectedLineId) {
          continue;
        }

        for (let edgeIndex = 0; edgeIndex < figureTopology.edges.length; edgeIndex++) {
          const [edgeStart, edgeEnd] = getEdgeEndpoints(figureTopology, edgeIndex);

          // For edges/segments: match by endpoint equality (avoids float32 precision issues)
          // For infinite lines: match by geometric collinearity
          const isMatch =
            line.kind === 'line'
              ? isCollinearWithLine(edgeStart, edgeEnd, line.pointA, line.pointB)
              : edgeEndpointsMatch(edgeStart, edgeEnd, line.pointA, line.pointB);

          if (isMatch) {
            indices.add(edgeIndex);
          }
        }
      }
      break;
    }
    case 'none':
      break;
    default:
      assertNever(selection);
  }

  return indices;
}

function edgeEndpointsMatch(
  startA: Vec3Array,
  endA: Vec3Array,
  startB: Vec3Array,
  endB: Vec3Array
): boolean {
  return (
    (positionsMatch(startA, startB) && positionsMatch(endA, endB)) ||
    (positionsMatch(startA, endB) && positionsMatch(endA, startB))
  );
}

/**
 * Checks if a render sub-segment's midpoint falls within the original segment range [pointA, pointB].
 * Used to determine if a sub-segment of an extended line is in the "original" part or the "extension" part.
 */
function isSubSegmentWithinRange(
  segment: RenderSegment,
  rangeStart: Vec3Array,
  rangeEnd: Vec3Array
): boolean {
  const midpoint: Vec3Array = [
    (segment.startPosition[0] + segment.endPosition[0]) / 2,
    (segment.startPosition[1] + segment.endPosition[1]) / 2,
    (segment.startPosition[2] + segment.endPosition[2]) / 2,
  ];

  const projection = projectPointOntoLine(midpoint, rangeStart, rangeEnd);
  if (projection === undefined) {
    return positionsMatch(midpoint, rangeStart);
  }

  const ENDPOINT_TOLERANCE = 0.001;
  return (
    projection.parameter >= -ENDPOINT_TOLERANCE && projection.parameter <= 1 + ENDPOINT_TOLERANCE
  );
}

function isVertexOnSelectedElement(vertex: TopologyVertex, selection: SelectionState): boolean {
  switch (selection.type) {
    case 'none':
      return false;
    case 'line': {
      return vertex.crossLineIds.includes(selection.lineId);
    }
    default:
      assertNever(selection);
  }
}

/** Sentinel lineId for topology edge segments rendered by buildTopologyEdgeSegments */
const TOPOLOGY_EDGE_SEGMENT_LINE_ID = -1;

function buildTopologyEdgeSegments(
  figureTopology: FigureTopology,
  lines: readonly TopologyLine[],
  vertices: readonly TopologyVertex[],
  selectedEdgeIndices: ReadonlySet<number>,
  solutionStatus: SolutionStatus | undefined
): readonly RenderSegment[] {
  const results: RenderSegment[] = [];

  // Build a map from lineId to TopologyLine for edge lookup
  const edgeLineByIndex = findEdgeLines(figureTopology, lines);

  // Build vertexId → marker buffer index map for GPU vertex indices
  const vertexIdToMarkerIndex = new Map<number, number>();
  for (let markerIndex = 0; markerIndex < vertices.length; markerIndex++) {
    vertexIdToMarkerIndex.set(vertices[markerIndex].vertexId, markerIndex);
  }

  const pushEdgeSubSegment = (
    startPosition: Vec3Array,
    endPosition: Vec3Array,
    baseModifiers: readonly string[],
    startMarkerIndex: number,
    endMarkerIndex: number
  ): void => {
    const modifiers = [...baseModifiers];
    if (
      solutionStatus?.isSolved &&
      solutionStatus.solutionLineRanges.some(([rangeStart, rangeEnd]) =>
        isSubSegmentInSolutionRange(startPosition, endPosition, rangeStart, rangeEnd)
      )
    ) {
      modifiers.push('solution');
    }
    results.push(
      createRenderSegment(
        startPosition,
        endPosition,
        modifiers,
        TOPOLOGY_EDGE_SEGMENT_LINE_ID,
        startMarkerIndex,
        endMarkerIndex
      )
    );
  };

  for (let edgeIndex = 0; edgeIndex < figureTopology.edges.length; edgeIndex++) {
    const [figureVertexA, figureVertexB] = figureTopology.edges[edgeIndex];
    const edgeStart = figureTopology.vertices[figureVertexA];
    const edgeEnd = figureTopology.vertices[figureVertexB];

    const edgeLine = edgeLineByIndex.get(edgeIndex);

    // Skip extended edges — the line path in buildSegments renders the original edge portion
    // with an 'edge' modifier promotion. Rendering here would duplicate it.
    if (edgeLine?.kind === 'edge-extended') {
      continue;
    }

    const modifiers: string[] = ['edge', 'segment'];
    if (selectedEdgeIndices.has(edgeIndex)) {
      modifiers.push('selected');
    }

    // Map figure vertex indices to marker buffer indices for GPU
    const startMarkerIndex =
      edgeLine !== undefined
        ? (vertexIdToMarkerIndex.get(edgeLine.startVertexId) ?? NO_CONNECTED_VERTEX_INDEX)
        : NO_CONNECTED_VERTEX_INDEX;
    const endMarkerIndex =
      edgeLine !== undefined
        ? (vertexIdToMarkerIndex.get(edgeLine.endVertexId) ?? NO_CONNECTED_VERTEX_INDEX)
        : NO_CONNECTED_VERTEX_INDEX;

    const edgeDir = vec3.sub(edgeEnd, edgeStart);
    const edgeLengthSq = vec3.dot(edgeDir, edgeDir);

    if (edgeLengthSq < POSITION_EPSILON || edgeLine === undefined) {
      pushEdgeSubSegment(edgeStart, edgeEnd, modifiers, startMarkerIndex, endMarkerIndex);
      continue;
    }

    // Find interior split vertices: vertices whose crossLineIds contains this edge's lineId
    // but are NOT the edge's start/end vertices
    const splitPoints: { parameter: number; markerIndex: number }[] = [];

    for (let markerIndex = 0; markerIndex < vertices.length; markerIndex++) {
      const vertex = vertices[markerIndex];

      if (vertex.vertexId === edgeLine.startVertexId || vertex.vertexId === edgeLine.endVertexId) {
        continue;
      }

      if (!vertex.crossLineIds.includes(edgeLine.lineId)) {
        continue;
      }

      // Compute parametric position along the edge for ordering
      const toVertex = vec3.sub(vertex.position, edgeStart);
      const parameter = vec3.dot(toVertex, edgeDir) / edgeLengthSq;

      if (parameter <= POSITION_EPSILON || parameter >= 1 - POSITION_EPSILON) {
        continue;
      }

      splitPoints.push({ parameter, markerIndex });
    }

    if (splitPoints.length === 0) {
      pushEdgeSubSegment(edgeStart, edgeEnd, modifiers, startMarkerIndex, endMarkerIndex);
      continue;
    }

    splitPoints.sort((pointA, pointB) => pointA.parameter - pointB.parameter);

    let currentPosition = edgeStart;
    let currentMarkerIndex = startMarkerIndex;

    for (const split of splitPoints) {
      const splitPosition = vec3.addScaled(edgeStart, edgeDir, split.parameter) as Vec3Array;

      pushEdgeSubSegment(
        currentPosition,
        splitPosition,
        modifiers,
        currentMarkerIndex,
        split.markerIndex
      );

      currentPosition = splitPosition;
      currentMarkerIndex = split.markerIndex;
    }

    pushEdgeSubSegment(currentPosition, edgeEnd, modifiers, currentMarkerIndex, endMarkerIndex);
  }

  return results;
}

/**
 * Finds the TopologyLine for each figure edge by matching endpoints.
 * Returns a map from edge index to the corresponding TopologyLine.
 */
function findEdgeLines(
  figureTopology: FigureTopology,
  lines: readonly TopologyLine[]
): ReadonlyMap<number, TopologyLine> {
  const result = new Map<number, TopologyLine>();
  const edgeLines = lines.filter(line => line.kind === 'edge' || line.kind === 'edge-extended');

  for (let edgeIndex = 0; edgeIndex < figureTopology.edges.length; edgeIndex++) {
    const [figureVertexA, figureVertexB] = figureTopology.edges[edgeIndex];
    const edgeStart = figureTopology.vertices[figureVertexA];
    const edgeEnd = figureTopology.vertices[figureVertexB];

    for (const line of edgeLines) {
      if (edgeEndpointsMatch(edgeStart, edgeEnd, line.pointA, line.pointB)) {
        result.set(edgeIndex, line);
        break;
      }
    }
  }

  return result;
}

function processLine(
  line: TopologyLine,
  figureTopology: FigureTopology,
  vertices: readonly TopologyVertex[]
): readonly RenderSegment[] {
  const isFiniteSegment = line.kind === 'segment' || line.kind === 'edge';
  const [farStart, farEnd] = isFiniteSegment
    ? [line.pointA, line.pointB]
    : extendLine(line.pointA, line.pointB);
  const lineDirection = vec3.sub(farEnd, farStart);
  const lineLength = vec3.len(lineDirection);

  if (lineLength === 0) {
    return [];
  }

  const normalizedDirection = vec3.normalize(lineDirection) as Vec3Array;

  const collinearEdges = findCollinearEdges(line, figureTopology);

  const faceIntersectionParams = findFaceIntersectionParams(
    farStart,
    normalizedDirection,
    lineLength,
    figureTopology
  );

  const coplanarIntervals = findCoplanarFaceIntervals(
    farStart,
    normalizedDirection,
    lineLength,
    figureTopology
  );

  const segmentIntervals = collinearEdges.map(edgeIndex => {
    const [edgeStart, edgeEnd] = getEdgeEndpoints(figureTopology, edgeIndex);
    const paramA = projectOntoLine(edgeStart, farStart, normalizedDirection, lineLength);
    const paramB = projectOntoLine(edgeEnd, farStart, normalizedDirection, lineLength);
    return {
      start: Math.min(paramA, paramB),
      end: Math.max(paramA, paramB),
    };
  });

  const pointAParam = projectOntoLine(line.pointA, farStart, normalizedDirection, lineLength);
  const pointBParam = projectOntoLine(line.pointB, farStart, normalizedDirection, lineLength);

  const splitParams = new Set<number>();
  splitParams.add(0);
  splitParams.add(1);
  splitParams.add(pointAParam);
  splitParams.add(pointBParam);

  for (const parameter of faceIntersectionParams) {
    splitParams.add(parameter);
  }
  for (const interval of coplanarIntervals) {
    splitParams.add(interval.start);
    splitParams.add(interval.end);
  }
  for (const interval of segmentIntervals) {
    splitParams.add(interval.start);
    splitParams.add(interval.end);
  }

  // Split at scene vertex positions that lie on this line and
  // build parameter -> vertex index mapping for topology-based occlusion
  const vertexIndexByParam = new Map<number, number>();

  for (let vertexIndex = 0; vertexIndex < vertices.length; vertexIndex++) {
    const vertexPosition = vertices[vertexIndex].position;
    const vertexParam = projectOntoLine(vertexPosition, farStart, normalizedDirection, lineLength);
    const projectedPosition = paramToPosition(
      vertexParam,
      farStart,
      normalizedDirection,
      lineLength
    );

    if (vec3.distSq(vertexPosition, projectedPosition) < POINT_ON_LINE_EPSILON_SQ) {
      vertexIndexByParam.set(vertexParam, vertexIndex);

      if (vertexParam > POSITION_EPSILON && vertexParam < 1 - POSITION_EPSILON) {
        splitParams.add(vertexParam);
      }
    }
  }

  const sortedParams = [...splitParams].sort((paramA, paramB) => paramA - paramB);
  const dedupedParams = deduplicateParameters(sortedParams);

  const mergedCoplanarIntervals = mergeIntervals(coplanarIntervals);

  const results: RenderSegment[] = [];

  for (let index = 0; index < dedupedParams.length - 1; index++) {
    const startParam = dedupedParams[index];
    const endParam = dedupedParams[index + 1];

    if (endParam - startParam < POSITION_EPSILON) {
      continue;
    }

    const midParam = (startParam + endParam) / 2;

    const startPosition = paramToPosition(startParam, farStart, normalizedDirection, lineLength);
    const endPosition = paramToPosition(endParam, farStart, normalizedDirection, lineLength);

    const startVertexIndex = findVertexIndexForParam(startParam, vertexIndexByParam);
    const endVertexIndex = findVertexIndexForParam(endParam, vertexIndexByParam);

    if (isRangeInAnyInterval(startParam, endParam, segmentIntervals)) {
      results.push(
        createRenderSegment(
          startPosition,
          endPosition,
          ['segment'],
          line.lineId,
          startVertexIndex,
          endVertexIndex
        )
      );
      continue;
    }

    if (isInAnyInterval(midParam, mergedCoplanarIntervals)) {
      results.push(
        createRenderSegment(
          startPosition,
          endPosition,
          ['inner'],
          line.lineId,
          startVertexIndex,
          endVertexIndex
        )
      );
      continue;
    }

    const midpoint = paramToPosition(midParam, farStart, normalizedDirection, lineLength);
    const isInner = figureTopology.figureFaceTriangles.some(figureTriangles =>
      isPointInsideOrOnSurface(midpoint, figureTriangles, figureTopology.vertices)
    );
    results.push(
      createRenderSegment(
        startPosition,
        endPosition,
        isInner ? ['inner'] : [],
        line.lineId,
        startVertexIndex,
        endVertexIndex
      )
    );
  }

  return results;
}

function projectOntoLine(
  point: Vec3Array,
  farStart: Vec3Array,
  normalizedDirection: Vec3Array,
  lineLength: number
): number {
  return vec3.dot(vec3.sub(point, farStart), normalizedDirection) / lineLength;
}

function paramToPosition(
  parameter: number,
  farStart: Vec3Array,
  normalizedDirection: Vec3Array,
  lineLength: number
): Vec3Array {
  return vec3.addScaled(farStart, normalizedDirection, parameter * lineLength) as Vec3Array;
}

function findCollinearEdges(line: TopologyLine, figureTopology: FigureTopology): readonly number[] {
  const collinearEdges: number[] = [];

  for (let edgeIndex = 0; edgeIndex < figureTopology.edges.length; edgeIndex++) {
    const [edgeStart, edgeEnd] = getEdgeEndpoints(figureTopology, edgeIndex);

    if (isCollinearWithLine(edgeStart, edgeEnd, line.pointA, line.pointB)) {
      collinearEdges.push(edgeIndex);
    }
  }

  return collinearEdges;
}

function findFaceIntersectionParams(
  farStart: Vec3Array,
  normalizedDirection: Vec3Array,
  lineLength: number,
  figureTopology: FigureTopology
): readonly number[] {
  const parameters: number[] = [];

  for (const triangleIndices of figureTopology.faceTriangles) {
    const vertexA = figureTopology.vertices[triangleIndices[0]];
    const vertexB = figureTopology.vertices[triangleIndices[1]];
    const vertexC = figureTopology.vertices[triangleIndices[2]];

    const parameterT = rayTriangleIntersect(
      farStart,
      normalizedDirection,
      vertexA,
      vertexB,
      vertexC
    );

    if (parameterT !== undefined && parameterT > 0) {
      const normalizedParameter = parameterT / lineLength;
      if (
        normalizedParameter > POSITION_EPSILON &&
        normalizedParameter < 1 - POSITION_EPSILON &&
        !isDuplicateParameter(normalizedParameter, parameters)
      ) {
        parameters.push(normalizedParameter);
      }
    }
  }

  return parameters;
}

function findCoplanarFaceIntervals(
  farStart: Vec3Array,
  normalizedDirection: Vec3Array,
  lineLength: number,
  figureTopology: FigureTopology
): readonly { start: number; end: number }[] {
  const intervals: { start: number; end: number }[] = [];

  for (let faceIndex = 0; faceIndex < figureTopology.faces.length; faceIndex++) {
    const faceVertexIndices = figureTopology.faces[faceIndex];
    if (faceVertexIndices.length < 3) {
      continue;
    }

    const faceVertices = faceVertexIndices.map(index => figureTopology.vertices[index]);

    const edgeAB = vec3.sub(faceVertices[1], faceVertices[0]);
    const edgeAC = vec3.sub(faceVertices[2], faceVertices[0]);
    const faceNormal = vec3.cross(edgeAB, edgeAC);
    const normalLength = vec3.len(faceNormal);

    if (normalLength < POSITION_EPSILON) {
      continue;
    }

    const unitNormal = vec3.normalize(faceNormal) as Vec3Array;

    if (Math.abs(vec3.dot(normalizedDirection, unitNormal)) > COPLANAR_DISTANCE_THRESHOLD) {
      continue;
    }

    const distanceToPlane = vec3.dot(vec3.sub(farStart, faceVertices[0]), unitNormal);
    if (Math.abs(distanceToPlane) > COPLANAR_DISTANCE_THRESHOLD) {
      continue;
    }

    const interval = clipLineToConvexPolygon(
      farStart,
      normalizedDirection,
      lineLength,
      faceVertices
    );

    if (interval !== undefined) {
      intervals.push(interval);
    }
  }

  return intervals;
}

function clipLineToConvexPolygon(
  farStart: Vec3Array,
  normalizedDirection: Vec3Array,
  lineLength: number,
  polygonVertices: readonly Vec3Array[]
): { start: number; end: number } | undefined {
  let tMin = 0;
  let tMax = 1;

  const faceEdgeAB = vec3.sub(polygonVertices[1], polygonVertices[0]);
  const faceEdgeAC = vec3.sub(polygonVertices[2], polygonVertices[0]);
  const faceNormal = vec3.cross(faceEdgeAB, faceEdgeAC);

  for (let index = 0; index < polygonVertices.length; index++) {
    const nextIndex = (index + 1) % polygonVertices.length;
    const edgeStart = polygonVertices[index];
    const edgeEnd = polygonVertices[nextIndex];
    const edgeDir = vec3.sub(edgeEnd, edgeStart);

    const inwardNormal = vec3.cross(faceNormal, edgeDir);
    const inwardLength = vec3.len(inwardNormal);

    if (inwardLength < POSITION_EPSILON) {
      continue;
    }

    const unitInward = vec3.normalize(inwardNormal) as Vec3Array;

    const startOffset = vec3.dot(vec3.sub(farStart, edgeStart), unitInward);
    const directionDot = vec3.dot(normalizedDirection, unitInward) * lineLength;

    if (Math.abs(directionDot) < POSITION_EPSILON) {
      if (startOffset < -POSITION_EPSILON) {
        return undefined;
      }
      continue;
    }

    const tEdge = -startOffset / directionDot;

    if (directionDot < 0) {
      tMax = Math.min(tMax, tEdge);
    } else {
      tMin = Math.max(tMin, tEdge);
    }

    if (tMin > tMax) {
      return undefined;
    }
  }

  if (tMax - tMin < POSITION_EPSILON) {
    return undefined;
  }

  return { start: tMin, end: tMax };
}

function findVertexIndexForParam(
  parameter: number,
  vertexIndexByParam: ReadonlyMap<number, number>
): number {
  const exactMatch = vertexIndexByParam.get(parameter);
  if (exactMatch !== undefined) {
    return exactMatch;
  }

  for (const [storedParam, vertexIndex] of vertexIndexByParam) {
    if (Math.abs(parameter - storedParam) < POSITION_EPSILON) {
      return vertexIndex;
    }
  }

  return NO_CONNECTED_VERTEX_INDEX;
}
