import { computeAllIntersections } from './stereometry-intersection';
import type { Vec3 } from './stereometry-math';
import { distanceSquared3 } from './stereometry-math';
import type {
  FigureTopology,
  IntersectionEntity,
  SceneState,
  VertexEntity,
} from './stereometry-types';

/** Squared distance threshold for matching positions to topology vertices */
const POSITION_MATCH_THRESHOLD_SQUARED = 0.0001;

/**
 * Creates the initial scene state with all topology edges as segments,
 * no lines, no user segments, and no intersections.
 */
export function createInitialScene(topology: FigureTopology): SceneState {
  const vertices = topology.vertices.map((position, vertexIndex) => ({
    position,
    topologyIndex: vertexIndex,
  }));

  const segments = topology.edges.map((_, edgeIndex) => ({
    edgeIndex,
  }));

  return {
    vertices,
    segments,
    lines: [],
    userSegments: [],
    intersections: [],
  };
}

/**
 * Toggles an extended line for the given edge index.
 * If a line or user segment exists for this edge, removes it. Otherwise, adds a line.
 * Returns a new immutable SceneState.
 */
export function toggleLine(
  scene: SceneState,
  edgeIndex: number,
  topology: FigureTopology
): SceneState {
  const lineExists = scene.lines.some(line => line.edgeIndex === edgeIndex);

  // Check if a user segment covers this topology edge
  const matchingUserSegmentIndex = findUserSegmentForEdge(scene, edgeIndex, topology);

  // If either a line or user segment exists, remove it; otherwise add a line
  const shouldRemove = lineExists || matchingUserSegmentIndex !== undefined;

  const updatedLines = lineExists
    ? scene.lines.filter(line => line.edgeIndex !== edgeIndex)
    : shouldRemove
      ? scene.lines
      : [...scene.lines, { edgeIndex }];

  const updatedUserSegments =
    matchingUserSegmentIndex !== undefined
      ? scene.userSegments.filter((_, index) => index !== matchingUserSegmentIndex)
      : scene.userSegments;

  return finalizeScene(
    { ...scene, lines: updatedLines, userSegments: updatedUserSegments },
    topology
  );
}

/**
 * Adds a user-created segment between two 3D positions.
 * If the positions match the vertices of a topology edge, toggles the line
 * for that edge instead of creating a user segment.
 * Returns a new immutable SceneState.
 */
export function addUserSegment(
  scene: SceneState,
  startPosition: Vec3,
  endPosition: Vec3,
  topology: FigureTopology
): SceneState {
  // Check if this segment coincides with a topology edge
  const edgeIndex = findEdgeForPositions(startPosition, endPosition, topology);
  if (edgeIndex !== undefined) {
    return toggleLine(scene, edgeIndex, topology);
  }

  return finalizeScene(
    { ...scene, userSegments: [...scene.userSegments, { startPosition, endPosition }] },
    topology
  );
}

/**
 * Removes a user segment by index.
 * Returns a new immutable SceneState.
 */
export function removeUserSegment(
  scene: SceneState,
  userSegmentIndex: number,
  topology: FigureTopology
): SceneState {
  return finalizeScene(
    { ...scene, userSegments: scene.userSegments.filter((_, index) => index !== userSegmentIndex) },
    topology
  );
}

/**
 * Recomputes intersections and rebuilds the unified vertex list for a scene
 * after any mutation to lines or userSegments.
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
 * Finds the index of a user segment whose endpoints match the vertices
 * of the given topology edge. Returns undefined if no match is found.
 */
function findUserSegmentForEdge(
  scene: SceneState,
  edgeIndex: number,
  topology: FigureTopology
): number | undefined {
  const [vertexIndexA, vertexIndexB] = topology.edges[edgeIndex];
  const vertexA = topology.vertices[vertexIndexA];
  const vertexB = topology.vertices[vertexIndexB];

  for (let index = 0; index < scene.userSegments.length; index++) {
    const segment = scene.userSegments[index];

    if (segmentEndpointsMatch(segment.startPosition, segment.endPosition, vertexA, vertexB)) {
      return index;
    }
  }

  return undefined;
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
