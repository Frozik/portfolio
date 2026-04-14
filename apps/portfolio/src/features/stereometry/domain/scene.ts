import { computeAllIntersections } from './intersection';
import type { Vec3 } from './math';
import { cross3, distanceSquared3, lengthVec3, subtractVec3 } from './math';
import type { FigureTopology, IntersectionEntity, SceneState, VertexEntity } from './types';

/** Squared distance threshold for matching positions to topology vertices */
const POSITION_MATCH_THRESHOLD_SQUARED = 0.0001;

/** Threshold for collinearity check (cross product magnitude) */
const COLLINEAR_THRESHOLD = 1e-8;

/**
 * Creates the initial scene state with no lines and no intersections.
 */
export function createInitialScene(topology: FigureTopology): SceneState {
  const vertices = topology.vertices.map((position, vertexIndex) => ({
    position,
    topologyIndex: vertexIndex,
  }));

  return {
    vertices,
    lines: [],
    intersections: [],
  };
}

/**
 * Toggles a line for the given edge index.
 * If a line coincides with this edge, removes it. Otherwise, adds a line from the edge endpoints.
 * Returns a new immutable SceneState.
 */
export function toggleLine(
  scene: SceneState,
  edgeIndex: number,
  topology: FigureTopology
): SceneState {
  const [vertexIndexA, vertexIndexB] = topology.edges[edgeIndex];
  const edgePointA = topology.vertices[vertexIndexA];
  const edgePointB = topology.vertices[vertexIndexB];

  // Check if any existing line coincides with this edge
  const matchingLineIndex = findCoincidingLineIndex(scene.lines, edgePointA, edgePointB);

  if (matchingLineIndex !== undefined) {
    // Remove the matching line
    const updatedLines = scene.lines.filter((_, index) => index !== matchingLineIndex);
    return finalizeScene({ ...scene, lines: updatedLines }, topology);
  }

  // Add a new line from the edge endpoints
  const newLine = { pointA: edgePointA, pointB: edgePointB };
  return finalizeScene({ ...scene, lines: [...scene.lines, newLine] }, topology);
}

/**
 * Adds a line between two 3D positions.
 * If the positions match the vertices of a topology edge, delegates to toggleLine.
 * Returns a new immutable SceneState.
 */
export function addLine(
  scene: SceneState,
  startPosition: Vec3,
  endPosition: Vec3,
  topology: FigureTopology
): SceneState {
  // Check if this line coincides with a topology edge
  const edgeIndex = findEdgeForPositions(startPosition, endPosition, topology);
  if (edgeIndex !== undefined) {
    return toggleLine(scene, edgeIndex, topology);
  }

  // Don't add if an identical line already exists
  if (findCoincidingLineIndex(scene.lines, startPosition, endPosition) !== undefined) {
    return scene;
  }

  const newLine = { pointA: startPosition, pointB: endPosition };
  return finalizeScene({ ...scene, lines: [...scene.lines, newLine] }, topology);
}

/**
 * Removes a line by index.
 * Returns a new immutable SceneState.
 */
export function removeLine(
  scene: SceneState,
  lineIndex: number,
  topology: FigureTopology
): SceneState {
  return finalizeScene(
    { ...scene, lines: scene.lines.filter((_, index) => index !== lineIndex) },
    topology
  );
}

/**
 * Recomputes intersections and rebuilds the unified vertex list for a scene
 * after any mutation to lines.
 */
function finalizeScene(scene: SceneState, topology: FigureTopology): SceneState {
  const sceneWithoutIntersections: SceneState = { ...scene, intersections: [] };
  const intersections = computeAllIntersections(sceneWithoutIntersections, topology);

  return {
    ...sceneWithoutIntersections,
    intersections,
    vertices: buildUnifiedVertices(topology, intersections),
  };
}

/**
 * Builds the unified vertex list: topology vertices first, then intersection points.
 * Topology vertices have a defined topologyIndex; intersection vertices have undefined.
 */
function buildUnifiedVertices(
  topology: FigureTopology,
  intersections: readonly IntersectionEntity[]
): readonly VertexEntity[] {
  const topologyVertices: VertexEntity[] = topology.vertices.map((position, vertexIndex) => ({
    position,
    topologyIndex: vertexIndex,
  }));

  const intersectionVertices: VertexEntity[] = intersections.map(intersection => ({
    position: intersection.position,
    topologyIndex: undefined,
  }));

  return [...topologyVertices, ...intersectionVertices];
}

/**
 * Finds the topology edge index whose vertices match the given positions (in either order).
 * Returns undefined if no matching edge is found.
 */
function findEdgeForPositions(
  positionA: Vec3,
  positionB: Vec3,
  topology: FigureTopology
): number | undefined {
  for (let edgeIndex = 0; edgeIndex < topology.edges.length; edgeIndex++) {
    const [vertexIndexA, vertexIndexB] = topology.edges[edgeIndex];
    const vertexA = topology.vertices[vertexIndexA];
    const vertexB = topology.vertices[vertexIndexB];

    if (segmentEndpointsMatch(positionA, positionB, vertexA, vertexB)) {
      return edgeIndex;
    }
  }

  return undefined;
}

/**
 * Finds the index of a line that coincides with the given segment (collinear + overlapping endpoints).
 */
function findCoincidingLineIndex(
  lines: readonly { readonly pointA: Vec3; readonly pointB: Vec3 }[],
  positionA: Vec3,
  positionB: Vec3
): number | undefined {
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (linesCoincide(line.pointA, line.pointB, positionA, positionB)) {
      return index;
    }
  }
  return undefined;
}

/**
 * Checks if two lines are collinear (same infinite line).
 * Two lines coincide if their directions are parallel AND one line's endpoint
 * lies on the other line.
 */
function linesCoincide(pointA1: Vec3, pointB1: Vec3, pointA2: Vec3, pointB2: Vec3): boolean {
  // First check simple endpoint match
  if (segmentEndpointsMatch(pointA1, pointB1, pointA2, pointB2)) {
    return true;
  }

  // Check collinearity
  const direction1 = subtractVec3(pointB1, pointA1);
  const length1 = lengthVec3(direction1);
  if (length1 === 0) {
    return false;
  }

  const normalizedDirection: Vec3 = [
    direction1[0] / length1,
    direction1[1] / length1,
    direction1[2] / length1,
  ];

  const direction2 = subtractVec3(pointB2, pointA2);
  const length2 = lengthVec3(direction2);
  if (length2 === 0) {
    return false;
  }

  const normalizedDirection2: Vec3 = [
    direction2[0] / length2,
    direction2[1] / length2,
    direction2[2] / length2,
  ];

  // Check parallel directions
  const crossProduct = cross3(normalizedDirection, normalizedDirection2);
  if (lengthVec3(crossProduct) > COLLINEAR_THRESHOLD) {
    return false;
  }

  // Check if they lie on the same line (distance between the lines is near zero)
  const toOtherLine = subtractVec3(pointA2, pointA1);
  const crossToOther = cross3(normalizedDirection, toOtherLine);
  return lengthVec3(crossToOther) < COLLINEAR_THRESHOLD;
}

/** Checks if two segments have matching endpoints in either order. */
function segmentEndpointsMatch(startA: Vec3, endA: Vec3, startB: Vec3, endB: Vec3): boolean {
  const matchForward = positionsMatch(startA, startB) && positionsMatch(endA, endB);
  const matchReverse = positionsMatch(startA, endB) && positionsMatch(endA, startB);
  return matchForward || matchReverse;
}

function positionsMatch(positionA: Vec3, positionB: Vec3): boolean {
  return distanceSquared3(positionA, positionB) < POSITION_MATCH_THRESHOLD_SQUARED;
}
