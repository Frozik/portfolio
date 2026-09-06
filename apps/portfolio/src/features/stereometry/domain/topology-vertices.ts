import { vec3 } from 'wgpu-matrix';
import { isNearAnyPoint } from './math';
import type {
  FigureTopology,
  IntersectionEntity,
  SceneTopology,
  TopologyLine,
  TopologyVertex,
  Vec3Array,
} from './topology-types';
import { NO_VERTEX_ID } from './topology-types';

/** The vertices of a scene topology: welding positions that coincide and handing every line the ids of the vertices on it. */
/** Squared distance threshold for matching positions to topology vertices */
const POSITION_MATCH_THRESHOLD_SQUARED = 0.0001;

/** Keep tight — must match VERTEX_COINCIDENCE_THRESHOLD_SQUARED in intersection.ts
 * to avoid filtering valid nearby vertices (e.g., intersection near figure vertex). */
const INPUT_VERTEX_DUPLICATE_THRESHOLD_SQUARED = 1e-5;

/**
 * Extracts input vertex positions from existing topology vertices.
 */
export function getInputVertexPositions(topology: SceneTopology): readonly Vec3Array[] {
  return topology.vertices.filter(vertex => vertex.kind === 'input').map(vertex => vertex.position);
}

/**
 * Builds the unified vertex list with IDs but without crossLineIds.
 * Topology vertices first, then input vertices, then intersection points.
 * Input vertices take priority -- intersections that coincide with input
 * vertices are deduplicated away (not the other way around).
 */
export function buildBareVertices(
  figureTopology: FigureTopology,
  inputVertexPositions: readonly Vec3Array[],
  intersections: readonly IntersectionEntity[],
  startVertexId: number
): { vertices: readonly TopologyVertex[]; nextVertexId: number } {
  let vertexIdCounter = startVertexId;

  const figureVertices: TopologyVertex[] = figureTopology.vertices.map(position => ({
    vertexId: vertexIdCounter++,
    position,
    kind: 'figure' as const,
    crossLineIds: [],
  }));

  // Input vertices dedup only against topology (they always survive)
  const uniqueInputVertices: TopologyVertex[] = inputVertexPositions
    .filter(
      position =>
        !isNearAnyPoint(position, figureTopology.vertices, INPUT_VERTEX_DUPLICATE_THRESHOLD_SQUARED)
    )
    .map(position => ({
      vertexId: vertexIdCounter++,
      position,
      kind: 'input' as const,
      crossLineIds: [],
    }));

  // Intersections dedup against both topology vertices and input vertices
  const protectedPositions = [
    ...figureTopology.vertices,
    ...uniqueInputVertices.map(vertex => vertex.position),
  ];

  const uniqueIntersectionVertices: TopologyVertex[] = intersections
    .filter(
      intersection =>
        !isNearAnyPoint(
          intersection.position,
          protectedPositions,
          INPUT_VERTEX_DUPLICATE_THRESHOLD_SQUARED
        )
    )
    .map(intersection => ({
      vertexId: vertexIdCounter++,
      position: intersection.position,
      kind: 'intersection' as const,
      crossLineIds: [],
    }));

  return {
    vertices: [...figureVertices, ...uniqueInputVertices, ...uniqueIntersectionVertices],
    nextVertexId: vertexIdCounter,
  };
}

export function positionKey(position: Vec3Array): string {
  const PRECISION = 6;
  return `${position[0].toFixed(PRECISION)},${position[1].toFixed(PRECISION)},${position[2].toFixed(PRECISION)}`;
}

/**
 * For each topology line, finds the vertex whose position matches pointA (startVertexId)
 * and the vertex whose position matches pointB (endVertexId).
 */
export function assignVertexIdsToLines(
  lines: readonly TopologyLine[],
  vertices: readonly TopologyVertex[]
): readonly TopologyLine[] {
  return lines.map(line => {
    let startVertexId = NO_VERTEX_ID;
    let endVertexId = NO_VERTEX_ID;

    for (const vertex of vertices) {
      if (startVertexId === NO_VERTEX_ID && positionsMatch(vertex.position, line.pointA)) {
        startVertexId = vertex.vertexId;
      }
      if (endVertexId === NO_VERTEX_ID && positionsMatch(vertex.position, line.pointB)) {
        endVertexId = vertex.vertexId;
      }
      if (startVertexId !== NO_VERTEX_ID && endVertexId !== NO_VERTEX_ID) {
        break;
      }
    }

    return { ...line, startVertexId, endVertexId };
  });
}

export function positionsMatch(positionA: Vec3Array, positionB: Vec3Array): boolean {
  return vec3.distSq(positionA, positionB) < POSITION_MATCH_THRESHOLD_SQUARED;
}
