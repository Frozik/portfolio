import { vec3 } from 'wgpu-matrix';
import { STEREOMETRY_STYLES } from './constants';
import type { Vec3 } from './math';
import { extendLine, isPointInsideOrOnSurface, rayTriangleIntersect } from './math';
import { hexToRgb, resolveStyle } from './styles-processor';
import type {
  FigureTopology,
  LineInstanceStyle,
  MarkerInstanceStyle,
  ProcessedSegment,
  ResolvedElementStyle,
  SceneLine,
  SceneState,
  SelectionState,
  StyledMarker,
  StyledSegment,
} from './types';

const COLLINEAR_THRESHOLD = 1e-8;
const POSITION_EPSILON = 1e-6;
const COPLANAR_DISTANCE_THRESHOLD = 1e-4;

/** Sentinel value for topology edge segments (not from a user line) */
const TOPOLOGY_EDGE_SOURCE_INDEX = -1;

/** Sentinel source index for the preview line */
export const PREVIEW_LINE_SOURCE_INDEX = -2;

const TOPOLOGY_VERTEX_EPSILON_SQUARED = 1e-10;
const POINT_ON_LINE_EPSILON_SQUARED = 1e-8;

export interface ProcessedGraphics {
  readonly segments: readonly StyledSegment[];
  readonly markers: readonly StyledMarker[];
}

export function processGraphics(
  topology: FigureTopology,
  scene: SceneState,
  selection: SelectionState,
  previewLine?: SceneLine
): ProcessedGraphics {
  const vertexPositions = scene.vertices.map(vertex => vertex.position);
  const markers = processVertexMarkers(topology, vertexPositions, selection, scene.lines);

  const processedSegments = processSegments(
    topology,
    scene.lines,
    selection,
    vertexPositions,
    previewLine
  );
  const segments = processedSegments.map(segment => toStyledSegment(segment));

  return { segments, markers };
}

/**
 * Converts a resolved element style to a GPU-ready LineInstanceStyle.
 */
function resolvedToInstanceStyle(resolved: ResolvedElementStyle): LineInstanceStyle {
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

/**
 * Converts a ProcessedSegment to a StyledSegment by resolving visible and hidden styles
 * from the segment's modifiers (already includes 'selected' if applicable).
 */
function toStyledSegment(segment: ProcessedSegment): StyledSegment {
  const visibleResolved = resolveStyle(STEREOMETRY_STYLES, 'line', segment.modifiers);
  const hiddenResolved = resolveStyle(STEREOMETRY_STYLES, 'line', ['hidden', ...segment.modifiers]);

  return {
    startPosition: segment.startPosition,
    endPosition: segment.endPosition,
    visibleStyle: resolvedToInstanceStyle(visibleResolved),
    hiddenStyle: resolvedToInstanceStyle(hiddenResolved),
    sourceLineIndex: segment.sourceLineIndex,
    isTopologyEdge: segment.modifiers.includes('segment'),
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

/**
 * Processes vertex markers for rendering, applying modifiers based on
 * geometry and selection state. Produces both visible and hidden styles
 * per marker — GPU depth test decides which to use.
 *
 * Modifiers:
 * - `inner` — vertex is on the surface of or inside the figure (topology vertices or intersection points on faces)
 * - `selected` — vertex lies on a currently selected line or edge
 */
function processVertexMarkers(
  topology: FigureTopology,
  vertexPositions: readonly Vec3[],
  selection: SelectionState,
  sceneLines: readonly SceneLine[]
): readonly StyledMarker[] {
  const markers: StyledMarker[] = [];

  for (let markerIndex = 0; markerIndex < vertexPositions.length; markerIndex++) {
    const position = vertexPositions[markerIndex];
    const modifiers: string[] = [];

    const isTopologyVertex = isTopologyVertexPosition(position, topology.vertices);
    if (
      isTopologyVertex ||
      topology.figureFaceTriangles.some(figureTriangles =>
        isPointInsideOrOnSurface(position, figureTriangles, topology.vertices)
      )
    ) {
      modifiers.push('inner');
    }

    if (isVertexOnSelectedElement(position, selection, topology, sceneLines)) {
      modifiers.push('selected');
    }

    const visibleResolved = resolveStyle(STEREOMETRY_STYLES, 'vertex', modifiers);
    const hiddenResolved = resolveStyle(STEREOMETRY_STYLES, 'vertex', ['hidden', ...modifiers]);

    markers.push({
      position,
      markerType: visibleResolved.markerType === 'circle' ? 1 : 0,
      visibleStyle: resolvedToMarkerStyle(visibleResolved),
      hiddenStyle: resolvedToMarkerStyle(hiddenResolved),
    });
  }

  return markers;
}

/**
 * Produces all renderable segments: topology edges + user lines.
 * Assigns modifiers including 'selected' based on current selection.
 * Line segments that coincide with topology edges are dropped
 * (the topology edge already renders there).
 *
 * Selection propagation:
 * - Edge selected → topology edge + all lines passing through both edge vertices
 * - Line selected → all line segments + topology edges collinear with the line
 */
function processSegments(
  topology: FigureTopology,
  lines: readonly SceneLine[],
  selection: SelectionState,
  vertexPositions: readonly Vec3[],
  previewLine?: SceneLine
): readonly ProcessedSegment[] {
  const selectedLineIndices = findSelectedLineIndices(selection, lines, topology);
  const selectedEdgeIndices = findSelectedEdgeIndices(selection, lines, topology);

  // 1. Process user lines → split into sub-segments with modifiers
  const lineSegments: ProcessedSegment[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const segments = processLine(lines[lineIndex], lineIndex, topology, vertexPositions);
    const isSelected = selectedLineIndices.has(lineIndex);

    for (const segment of segments) {
      if (segment.modifiers.includes('segment')) {
        continue;
      }

      const modifiers = isSelected ? [...segment.modifiers, 'selected'] : segment.modifiers;
      lineSegments.push({ ...segment, modifiers });
    }
  }

  // 2. Process preview line (if dragging)
  if (previewLine !== undefined) {
    const segments = processLine(previewLine, PREVIEW_LINE_SOURCE_INDEX, topology, vertexPositions);

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

  // 3. Build topology edge segments
  const topologySegments = buildTopologyEdgeSegments(topology, selectedEdgeIndices);

  // 4. Deduplicate: if two segments share the same positions, keep the one with more modifiers
  return deduplicateSegments([...topologySegments, ...lineSegments]);
}

/**
 * Removes duplicate segments at the same position.
 * When two segments overlap, keeps the one with more modifiers (more specific styling).
 */
function deduplicateSegments(segments: readonly ProcessedSegment[]): readonly ProcessedSegment[] {
  const segmentMap = new Map<string, ProcessedSegment>();

  for (const segment of segments) {
    const key = segmentPositionKey(segment.startPosition, segment.endPosition);

    const existing = segmentMap.get(key);
    if (existing === undefined || segment.modifiers.length > existing.modifiers.length) {
      segmentMap.set(key, segment);
    }
  }

  return [...segmentMap.values()];
}

function segmentPositionKey(
  start: readonly [number, number, number],
  end: readonly [number, number, number]
): string {
  const startKey = `${start[0].toFixed(6)},${start[1].toFixed(6)},${start[2].toFixed(6)}`;
  const endKey = `${end[0].toFixed(6)},${end[1].toFixed(6)},${end[2].toFixed(6)}`;
  // Normalize direction so A→B and B→A produce the same key
  return startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

/**
 * Determines which line indices should be highlighted.
 * - Line selected → that line
 * - Edge selected → lines whose pointA/pointB match the edge endpoints
 */
function findSelectedLineIndices(
  selection: SelectionState,
  lines: readonly SceneLine[],
  topology: FigureTopology
): ReadonlySet<number> {
  const indices = new Set<number>();

  switch (selection.type) {
    case 'line':
      indices.add(selection.lineIndex);
      break;
    case 'edge': {
      const [vertexA, vertexB] = topology.edges[selection.edgeIndex];
      const edgeStart = topology.vertices[vertexA];
      const edgeEnd = topology.vertices[vertexB];

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        if (
          (positionsEqual(line.pointA, edgeStart) && positionsEqual(line.pointB, edgeEnd)) ||
          (positionsEqual(line.pointA, edgeEnd) && positionsEqual(line.pointB, edgeStart))
        ) {
          indices.add(lineIndex);
        }
      }
      break;
    }
    case 'none':
      break;
  }

  return indices;
}

/**
 * Determines which edge indices should be highlighted.
 * - Edge selected → that edge
 * - Line selected → edges whose endpoints match the line's pointA/pointB
 */
function findSelectedEdgeIndices(
  selection: SelectionState,
  lines: readonly SceneLine[],
  topology: FigureTopology
): ReadonlySet<number> {
  const indices = new Set<number>();

  switch (selection.type) {
    case 'edge':
      indices.add(selection.edgeIndex);
      break;
    case 'line': {
      const line = lines[selection.lineIndex];

      for (let edgeIndex = 0; edgeIndex < topology.edges.length; edgeIndex++) {
        const [vertexA, vertexB] = topology.edges[edgeIndex];
        const edgeStart = topology.vertices[vertexA];
        const edgeEnd = topology.vertices[vertexB];

        if (isEdgeOnLine(edgeStart, edgeEnd, line.pointA, line.pointB)) {
          indices.add(edgeIndex);
        }
      }
      break;
    }
    case 'none':
      break;
  }

  return indices;
}

/**
 * Checks if a topology edge lies on an infinite line (collinear and on the same line).
 */
function isEdgeOnLine(edgeStart: Vec3, edgeEnd: Vec3, linePointA: Vec3, linePointB: Vec3): boolean {
  const lineDir = vec3.sub(linePointB, linePointA);
  const lineLength = vec3.len(lineDir);

  if (lineLength === 0) {
    return false;
  }

  const normalizedLineDir: Vec3 = [
    lineDir[0] / lineLength,
    lineDir[1] / lineLength,
    lineDir[2] / lineLength,
  ];

  // Check both edge endpoints are on the infinite line
  const toEdgeStart = vec3.sub(edgeStart, linePointA);
  const crossStart = vec3.cross(normalizedLineDir, toEdgeStart);
  if (vec3.len(crossStart) > COLLINEAR_THRESHOLD) {
    return false;
  }

  const toEdgeEnd = vec3.sub(edgeEnd, linePointA);
  const crossEnd = vec3.cross(normalizedLineDir, toEdgeEnd);
  return vec3.len(crossEnd) <= COLLINEAR_THRESHOLD;
}

function positionsEqual(
  positionA: readonly [number, number, number],
  positionB: readonly [number, number, number]
): boolean {
  return (
    Math.abs(positionA[0] - positionB[0]) < POSITION_EPSILON &&
    Math.abs(positionA[1] - positionB[1]) < POSITION_EPSILON &&
    Math.abs(positionA[2] - positionB[2]) < POSITION_EPSILON
  );
}

function buildTopologyEdgeSegments(
  topology: FigureTopology,
  selectedEdgeIndices: ReadonlySet<number>
): readonly ProcessedSegment[] {
  return topology.edges.map(([vertexA, vertexB], edgeIndex) => {
    const modifiers: string[] = ['segment'];

    if (selectedEdgeIndices.has(edgeIndex)) {
      modifiers.push('selected');
    }

    return {
      startPosition: topology.vertices[vertexA],
      endPosition: topology.vertices[vertexB],
      modifiers,
      sourceLineIndex: TOPOLOGY_EDGE_SOURCE_INDEX,
    };
  });
}

function processLine(
  line: SceneLine,
  lineIndex: number,
  topology: FigureTopology,
  vertexPositions: readonly Vec3[]
): readonly ProcessedSegment[] {
  const [farStart, farEnd] = extendLine(line.pointA, line.pointB);
  const lineDirection = vec3.sub(farEnd, farStart);
  const lineLength = vec3.len(lineDirection);

  if (lineLength === 0) {
    return [];
  }

  const normalizedDirection: Vec3 = [
    lineDirection[0] / lineLength,
    lineDirection[1] / lineLength,
    lineDirection[2] / lineLength,
  ];

  // Find collinear topology edges (line lies along an edge)
  const collinearEdges = findCollinearEdges(line, topology, normalizedDirection);

  // Collect face intersection parameters as split points (not paired intervals).
  // Pairing breaks when a ray passes through a shared vertex and only some
  // triangles report the intersection, producing an odd count.
  const faceIntersectionParams = findFaceIntersectionParams(
    farStart,
    normalizedDirection,
    lineLength,
    topology
  );

  // Coplanar face intervals (line lies on a face)
  const coplanarIntervals = findCoplanarFaceIntervals(
    farStart,
    normalizedDirection,
    lineLength,
    topology
  );

  // Collect collinear edge intervals (these become 'segment' modifier)
  const segmentIntervals = collinearEdges.map(edgeIndex => {
    const [vertexIndexA, vertexIndexB] = topology.edges[edgeIndex];
    const paramA = projectOntoLine(
      topology.vertices[vertexIndexA],
      farStart,
      normalizedDirection,
      lineLength
    );
    const paramB = projectOntoLine(
      topology.vertices[vertexIndexB],
      farStart,
      normalizedDirection,
      lineLength
    );
    return { start: Math.min(paramA, paramB), end: Math.max(paramA, paramB) };
  });

  // Build all split points from face intersections, coplanar intervals,
  // segment intervals, original line endpoints, and extended line endpoints
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

  // Split at scene vertex positions that lie on this line (e.g., intersections with other user lines)
  for (const vertexPosition of vertexPositions) {
    const vertexParam = projectOntoLine(vertexPosition, farStart, normalizedDirection, lineLength);
    if (vertexParam > POSITION_EPSILON && vertexParam < 1 - POSITION_EPSILON) {
      const projectedPosition = paramToPosition(
        vertexParam,
        farStart,
        normalizedDirection,
        lineLength
      );
      if (vec3.distSq(vertexPosition, projectedPosition) < POINT_ON_LINE_EPSILON_SQUARED) {
        splitParams.add(vertexParam);
      }
    }
  }

  const sortedParams = [...splitParams].sort((paramA, paramB) => paramA - paramB);
  const dedupedParams = deduplicateParameters(sortedParams);

  // Merge coplanar intervals for quick lookup
  const mergedCoplanarIntervals = mergeIntervals(coplanarIntervals);

  // Classify each sub-segment
  const results: ProcessedSegment[] = [];

  for (let index = 0; index < dedupedParams.length - 1; index++) {
    const startParam = dedupedParams[index];
    const endParam = dedupedParams[index + 1];

    if (endParam - startParam < POSITION_EPSILON) {
      continue;
    }

    const midParam = (startParam + endParam) / 2;

    const startPosition = paramToPosition(startParam, farStart, normalizedDirection, lineLength);
    const endPosition = paramToPosition(endParam, farStart, normalizedDirection, lineLength);

    // Check if midpoint is on a collinear edge → 'segment'
    if (isInAnyInterval(midParam, segmentIntervals)) {
      results.push({
        startPosition,
        endPosition,
        modifiers: ['segment'],
        sourceLineIndex: lineIndex,
      });
      continue;
    }

    // Check if midpoint is in a coplanar face region → 'inner'
    if (isInAnyInterval(midParam, mergedCoplanarIntervals)) {
      results.push({
        startPosition,
        endPosition,
        modifiers: ['inner'],
        sourceLineIndex: lineIndex,
      });
      continue;
    }

    // Test midpoint against each figure independently (handles overlapping figures)
    const midpoint = paramToPosition(midParam, farStart, normalizedDirection, lineLength);
    const isInner = topology.figureFaceTriangles.some(figureTriangles =>
      isPointInsideOrOnSurface(midpoint, figureTriangles, topology.vertices)
    );
    results.push({
      startPosition,
      endPosition,
      modifiers: isInner ? ['inner'] : [],
      sourceLineIndex: lineIndex,
    });
  }

  return results;
}

function projectOntoLine(
  point: Vec3,
  farStart: Vec3,
  normalizedDirection: Vec3,
  lineLength: number
): number {
  return vec3.dot(vec3.sub(point, farStart), normalizedDirection) / lineLength;
}

function paramToPosition(
  parameter: number,
  farStart: Vec3,
  normalizedDirection: Vec3,
  lineLength: number
): Vec3 {
  const distance = parameter * lineLength;
  return [
    farStart[0] + normalizedDirection[0] * distance,
    farStart[1] + normalizedDirection[1] * distance,
    farStart[2] + normalizedDirection[2] * distance,
  ];
}

function isInAnyInterval(
  parameter: number,
  intervals: readonly { start: number; end: number }[]
): boolean {
  for (const interval of intervals) {
    if (
      parameter > interval.start + POSITION_EPSILON &&
      parameter < interval.end - POSITION_EPSILON
    ) {
      return true;
    }
  }
  return false;
}

function findCollinearEdges(
  line: SceneLine,
  topology: FigureTopology,
  normalizedLineDirection: Vec3
): readonly number[] {
  const collinearEdges: number[] = [];

  for (let edgeIndex = 0; edgeIndex < topology.edges.length; edgeIndex++) {
    const [vertexIndexA, vertexIndexB] = topology.edges[edgeIndex];
    const edgeStart = topology.vertices[vertexIndexA];
    const edgeEnd = topology.vertices[vertexIndexB];
    const edgeDirection = vec3.sub(edgeEnd, edgeStart);
    const edgeLength = vec3.len(edgeDirection);

    if (edgeLength === 0) {
      continue;
    }

    const normalizedEdgeDirection: Vec3 = [
      edgeDirection[0] / edgeLength,
      edgeDirection[1] / edgeLength,
      edgeDirection[2] / edgeLength,
    ];

    const crossProduct = vec3.cross(normalizedLineDirection, normalizedEdgeDirection);
    if (vec3.len(crossProduct) > COLLINEAR_THRESHOLD) {
      continue;
    }

    const toEdge = vec3.sub(edgeStart, line.pointA);
    const crossToEdge = vec3.cross(normalizedLineDirection, toEdge);
    if (vec3.len(crossToEdge) < COLLINEAR_THRESHOLD) {
      collinearEdges.push(edgeIndex);
    }
  }

  return collinearEdges;
}

/**
 * Returns normalized parameters where the line intersects face triangles.
 * These are used as split points; the actual inside/outside classification
 * is done by testing each sub-segment's midpoint with isPointInsideOrOnSurface.
 */
function findFaceIntersectionParams(
  farStart: Vec3,
  normalizedDirection: Vec3,
  lineLength: number,
  topology: FigureTopology
): readonly number[] {
  const parameters: number[] = [];

  for (const triangleIndices of topology.faceTriangles) {
    const vertexA = topology.vertices[triangleIndices[0]];
    const vertexB = topology.vertices[triangleIndices[1]];
    const vertexC = topology.vertices[triangleIndices[2]];

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
  farStart: Vec3,
  normalizedDirection: Vec3,
  lineLength: number,
  topology: FigureTopology
): readonly { start: number; end: number }[] {
  const intervals: { start: number; end: number }[] = [];

  for (let faceIndex = 0; faceIndex < topology.faces.length; faceIndex++) {
    const faceVertexIndices = topology.faces[faceIndex];
    if (faceVertexIndices.length < 3) {
      continue;
    }

    const faceVertices = faceVertexIndices.map(index => topology.vertices[index]);

    // Compute face normal and plane distance
    const edgeAB = vec3.sub(faceVertices[1], faceVertices[0]);
    const edgeAC = vec3.sub(faceVertices[2], faceVertices[0]);
    const faceNormal = vec3.cross(edgeAB, edgeAC);
    const normalLength = vec3.len(faceNormal);

    if (normalLength < POSITION_EPSILON) {
      continue;
    }

    const unitNormal: Vec3 = [
      faceNormal[0] / normalLength,
      faceNormal[1] / normalLength,
      faceNormal[2] / normalLength,
    ];

    // Check if line direction is perpendicular to face normal (parallel to face)
    if (Math.abs(vec3.dot(normalizedDirection, unitNormal)) > COPLANAR_DISTANCE_THRESHOLD) {
      continue;
    }

    // Check if the line lies on the face plane (distance from farStart to plane ≈ 0)
    const distanceToPlane = vec3.dot(vec3.sub(farStart, faceVertices[0]), unitNormal);
    if (Math.abs(distanceToPlane) > COPLANAR_DISTANCE_THRESHOLD) {
      continue;
    }

    // Line is coplanar with this face — clip against the face polygon
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

/**
 * Clips an infinite line to a convex polygon, returning the parametric interval
 * of the line that lies inside the polygon. Returns undefined if no intersection.
 */
function clipLineToConvexPolygon(
  farStart: Vec3,
  normalizedDirection: Vec3,
  lineLength: number,
  polygonVertices: readonly Vec3[]
): { start: number; end: number } | undefined {
  let tMin = 0;
  let tMax = 1;

  // Compute face normal once (CCW winding → outward normal)
  const faceEdgeAB = vec3.sub(polygonVertices[1], polygonVertices[0]);
  const faceEdgeAC = vec3.sub(polygonVertices[2], polygonVertices[0]);
  const faceNormal = vec3.cross(faceEdgeAB, faceEdgeAC);

  for (let index = 0; index < polygonVertices.length; index++) {
    const nextIndex = (index + 1) % polygonVertices.length;
    const edgeStart = polygonVertices[index];
    const edgeEnd = polygonVertices[nextIndex];
    const edgeDir = vec3.sub(edgeEnd, edgeStart);

    // Inward-facing normal: cross(faceNormal, edgeDir) points inward for CCW-wound faces
    const inwardNormal = vec3.cross(faceNormal, edgeDir);
    const inwardLength = vec3.len(inwardNormal);

    if (inwardLength < POSITION_EPSILON) {
      continue;
    }

    const unitInward: Vec3 = [
      inwardNormal[0] / inwardLength,
      inwardNormal[1] / inwardLength,
      inwardNormal[2] / inwardLength,
    ];

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

function isDuplicateParameter(parameter: number, existing: readonly number[]): boolean {
  for (const existingParam of existing) {
    if (Math.abs(parameter - existingParam) < POSITION_EPSILON) {
      return true;
    }
  }
  return false;
}

function deduplicateParameters(sortedParams: readonly number[]): readonly number[] {
  const result: number[] = [];

  for (const parameter of sortedParams) {
    if (result.length === 0 || Math.abs(parameter - result[result.length - 1]) > POSITION_EPSILON) {
      result.push(parameter);
    }
  }

  return result;
}

function mergeIntervals(
  intervals: readonly { start: number; end: number }[]
): readonly { start: number; end: number }[] {
  if (intervals.length === 0) {
    return [];
  }

  const sorted = [...intervals].sort((intervalA, intervalB) => intervalA.start - intervalB.start);
  const merged: { start: number; end: number }[] = [sorted[0]];

  for (let index = 1; index < sorted.length; index++) {
    const current = sorted[index];
    const previous = merged[merged.length - 1];

    if (current.start <= previous.end + POSITION_EPSILON) {
      merged[merged.length - 1] = {
        start: previous.start,
        end: Math.max(previous.end, current.end),
      };
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function isVertexOnSelectedElement(
  position: Vec3,
  selection: SelectionState,
  topology: FigureTopology,
  sceneLines: readonly SceneLine[]
): boolean {
  switch (selection.type) {
    case 'none':
      return false;
    case 'edge': {
      const [vertexA, vertexB] = topology.edges[selection.edgeIndex];
      const edgeStart = topology.vertices[vertexA];
      const edgeEnd = topology.vertices[vertexB];

      if (isPointOnLineSegment(position, edgeStart, edgeEnd)) {
        return true;
      }

      for (const line of sceneLines) {
        if (
          (positionsMatch(line.pointA, edgeStart) && positionsMatch(line.pointB, edgeEnd)) ||
          (positionsMatch(line.pointA, edgeEnd) && positionsMatch(line.pointB, edgeStart))
        ) {
          return isPointOnInfiniteLine(position, line.pointA, line.pointB);
        }
      }

      return false;
    }
    case 'line': {
      const line = sceneLines[selection.lineIndex];
      return isPointOnInfiniteLine(position, line.pointA, line.pointB);
    }
  }
}

function isPointOnLineSegment(point: Vec3, segmentStart: Vec3, segmentEnd: Vec3): boolean {
  const segmentDirection = vec3.sub(segmentEnd, segmentStart);
  const segmentLengthSquared = vec3.dot(segmentDirection, segmentDirection);

  if (segmentLengthSquared < TOPOLOGY_VERTEX_EPSILON_SQUARED) {
    return vec3.distSq(point, segmentStart) < TOPOLOGY_VERTEX_EPSILON_SQUARED;
  }

  const toPoint = vec3.sub(point, segmentStart);
  const parameter = vec3.dot(toPoint, segmentDirection) / segmentLengthSquared;

  if (parameter < -0.001 || parameter > 1.001) {
    return false;
  }

  const projection: Vec3 = [
    segmentStart[0] + parameter * segmentDirection[0],
    segmentStart[1] + parameter * segmentDirection[1],
    segmentStart[2] + parameter * segmentDirection[2],
  ];

  return vec3.distSq(point, projection) < POINT_ON_LINE_EPSILON_SQUARED;
}

function isPointOnInfiniteLine(point: Vec3, linePointA: Vec3, linePointB: Vec3): boolean {
  const lineDirection = vec3.sub(linePointB, linePointA);
  const lineLengthSquared = vec3.dot(lineDirection, lineDirection);

  if (lineLengthSquared < TOPOLOGY_VERTEX_EPSILON_SQUARED) {
    return vec3.distSq(point, linePointA) < TOPOLOGY_VERTEX_EPSILON_SQUARED;
  }

  const toPoint = vec3.sub(point, linePointA);
  const parameter = vec3.dot(toPoint, lineDirection) / lineLengthSquared;

  const projection: Vec3 = [
    linePointA[0] + parameter * lineDirection[0],
    linePointA[1] + parameter * lineDirection[1],
    linePointA[2] + parameter * lineDirection[2],
  ];

  return vec3.distSq(point, projection) < POINT_ON_LINE_EPSILON_SQUARED;
}

function positionsMatch(positionA: Vec3, positionB: Vec3): boolean {
  return vec3.distSq(positionA, positionB) < TOPOLOGY_VERTEX_EPSILON_SQUARED;
}

function isTopologyVertexPosition(position: Vec3, topologyVertices: readonly Vec3[]): boolean {
  for (const vertex of topologyVertices) {
    if (vec3.distSq(position, vertex) < TOPOLOGY_VERTEX_EPSILON_SQUARED) {
      return true;
    }
  }
  return false;
}
