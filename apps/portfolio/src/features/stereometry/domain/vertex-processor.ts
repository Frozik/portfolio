import { STEREOMETRY_STYLES } from './constants';
import type { Vec3 } from './math';
import { distanceSquared3, dot3, isPointInsideOrOnSurface, subtractVec3 } from './math';
import { hexToRgb, resolveStyle } from './styles-processor';
import type {
  FigureTopology,
  MarkerInstanceStyle,
  SceneLine,
  SelectionState,
  StyledMarker,
} from './types';

const TOPOLOGY_VERTEX_EPSILON_SQUARED = 1e-10;
const POINT_ON_LINE_EPSILON_SQUARED = 1e-8;

/**
 * Processes vertex markers for rendering, applying modifiers based on
 * geometry and selection state. Produces both visible and hidden styles
 * per marker — GPU depth test decides which to use.
 *
 * Modifiers:
 * - `inner` — vertex is inside or on a face of the figure (not a topology vertex)
 * - `selected` — vertex lies on a currently selected line or edge
 */
export function processVertexMarkers(
  topology: FigureTopology,
  vertexPositions: readonly Vec3[],
  selection: SelectionState,
  sceneLines: readonly SceneLine[]
): readonly StyledMarker[] {
  const markers: StyledMarker[] = [];

  for (const position of vertexPositions) {
    const modifiers: string[] = [];

    const isTopologyVertex = isTopologyVertexPosition(position, topology.vertices);
    if (
      !isTopologyVertex &&
      isPointInsideOrOnSurface(position, topology.faceTriangles, topology.vertices)
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
  const segmentDirection = subtractVec3(segmentEnd, segmentStart);
  const segmentLengthSquared = dot3(segmentDirection, segmentDirection);

  if (segmentLengthSquared < TOPOLOGY_VERTEX_EPSILON_SQUARED) {
    return distanceSquared3(point, segmentStart) < TOPOLOGY_VERTEX_EPSILON_SQUARED;
  }

  const toPoint = subtractVec3(point, segmentStart);
  const parameter = dot3(toPoint, segmentDirection) / segmentLengthSquared;

  if (parameter < -0.001 || parameter > 1.001) {
    return false;
  }

  const projection: Vec3 = [
    segmentStart[0] + parameter * segmentDirection[0],
    segmentStart[1] + parameter * segmentDirection[1],
    segmentStart[2] + parameter * segmentDirection[2],
  ];

  return distanceSquared3(point, projection) < POINT_ON_LINE_EPSILON_SQUARED;
}

function isPointOnInfiniteLine(point: Vec3, linePointA: Vec3, linePointB: Vec3): boolean {
  const lineDirection = subtractVec3(linePointB, linePointA);
  const lineLengthSquared = dot3(lineDirection, lineDirection);

  if (lineLengthSquared < TOPOLOGY_VERTEX_EPSILON_SQUARED) {
    return distanceSquared3(point, linePointA) < TOPOLOGY_VERTEX_EPSILON_SQUARED;
  }

  const toPoint = subtractVec3(point, linePointA);
  const parameter = dot3(toPoint, lineDirection) / lineLengthSquared;

  const projection: Vec3 = [
    linePointA[0] + parameter * lineDirection[0],
    linePointA[1] + parameter * lineDirection[1],
    linePointA[2] + parameter * lineDirection[2],
  ];

  return distanceSquared3(point, projection) < POINT_ON_LINE_EPSILON_SQUARED;
}

function positionsMatch(positionA: Vec3, positionB: Vec3): boolean {
  return distanceSquared3(positionA, positionB) < TOPOLOGY_VERTEX_EPSILON_SQUARED;
}

function isTopologyVertexPosition(position: Vec3, topologyVertices: readonly Vec3[]): boolean {
  for (const vertex of topologyVertices) {
    if (distanceSquared3(position, vertex) < TOPOLOGY_VERTEX_EPSILON_SQUARED) {
      return true;
    }
  }
  return false;
}
