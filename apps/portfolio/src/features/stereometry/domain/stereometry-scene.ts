import { computeAllIntersections } from './stereometry-intersection';
import type {
  FigureTopology,
  IntersectionEntity,
  SceneState,
  VertexEntity,
} from './stereometry-types';

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
 * If a line exists for this edge, removes it. Otherwise, adds it.
 * Recomputes all intersections and rebuilds the unified vertex list.
 * Returns a new immutable SceneState.
 */
export function toggleLine(
  scene: SceneState,
  edgeIndex: number,
  topology: FigureTopology
): SceneState {
  const lineExists = scene.lines.some(line => line.edgeIndex === edgeIndex);

  const updatedLines = lineExists
    ? scene.lines.filter(line => line.edgeIndex !== edgeIndex)
    : [...scene.lines, { edgeIndex }];

  const intermediateScene: SceneState = {
    ...scene,
    lines: updatedLines,
    intersections: [],
  };

  const intersections = computeAllIntersections(intermediateScene, topology);

  return {
    ...intermediateScene,
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
 * Adds a user-created segment between two 3D positions.
 * Recomputes all intersections and rebuilds the unified vertex list.
 * Returns a new immutable SceneState.
 */
export function addUserSegment(
  scene: SceneState,
  startPosition: readonly [number, number, number],
  endPosition: readonly [number, number, number],
  topology: FigureTopology
): SceneState {
  const updatedScene: SceneState = {
    ...scene,
    userSegments: [...scene.userSegments, { startPosition, endPosition }],
    intersections: [],
  };

  const intersections = computeAllIntersections(updatedScene, topology);

  return {
    ...updatedScene,
    intersections,
    vertices: buildUnifiedVertices(topology, intersections),
  };
}
