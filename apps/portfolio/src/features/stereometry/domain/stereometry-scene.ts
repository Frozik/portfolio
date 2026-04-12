import { computeAllIntersections } from './stereometry-intersection';
import type { FigureTopology, SceneState } from './stereometry-types';

/**
 * Creates the initial scene state with all topology edges as segments,
 * no lines, and no intersections.
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
    intersections: [],
  };
}

/**
 * Toggles an extended line for the given edge index.
 * If a line exists for this edge, removes it. Otherwise, adds it.
 * Recomputes all intersections based on the updated lines.
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

  const updatedScene: SceneState = {
    vertices: scene.vertices,
    segments: scene.segments,
    lines: updatedLines,
    intersections: [],
  };

  return {
    vertices: scene.vertices,
    segments: scene.segments,
    lines: updatedLines,
    intersections: computeAllIntersections(updatedScene, topology),
  };
}
