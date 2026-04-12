import {
  FACE_POSITION_FLOATS,
  FLOATS_PER_EDGE_INSTANCE,
  VERTICES_PER_TRIANGLE,
} from './stereometry-constants';
import type { FigureTopology, PuzzleDefinition } from './stereometry-types';

export interface FigureWireframe {
  /** Instance buffer: 6 floats per edge (startPos + endPos) */
  readonly edgeInstances: Float32Array;
  readonly edgeCount: number;
  /** Face positions for depth-only rendering (position vec3 per vertex) */
  readonly facePositions: Float32Array;
  readonly faceVertexCount: number;
}

/**
 * Builds the topology from a puzzle definition.
 * Computes derived data: face-edge mapping, triangulated faces, triangle-to-face index.
 */
export function createTopologyFromPuzzle(puzzle: PuzzleDefinition): FigureTopology {
  const { vertices, edges, faces } = puzzle;

  const faceEdges = computeFaceEdges(faces, edges);
  const { faceTriangles, triangleFaceIndex } = triangulateFaces(faces);

  return {
    vertices,
    edges,
    faces,
    faceEdges,
    faceTriangles,
    triangleFaceIndex,
  };
}

/**
 * Creates wireframe + face data from a topology for GPU rendering.
 */
export function createWireframeFromTopology(topology: FigureTopology): FigureWireframe {
  const { vertices, edges } = topology;

  const edgeInstances = new Float32Array(edges.length * FLOATS_PER_EDGE_INSTANCE);

  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
    const [vertexIndexA, vertexIndexB] = edges[edgeIndex];
    const positionA = vertices[vertexIndexA];
    const positionB = vertices[vertexIndexB];
    const offset = edgeIndex * FLOATS_PER_EDGE_INSTANCE;

    edgeInstances[offset] = positionA[0];
    edgeInstances[offset + 1] = positionA[1];
    edgeInstances[offset + 2] = positionA[2];
    edgeInstances[offset + 3] = positionB[0];
    edgeInstances[offset + 4] = positionB[1];
    edgeInstances[offset + 5] = positionB[2];
  }

  const { faceTriangles } = topology;
  const faceVertexCount = faceTriangles.length * VERTICES_PER_TRIANGLE;
  const facePositions = new Float32Array(faceVertexCount * FACE_POSITION_FLOATS);
  let faceVertexOffset = 0;

  for (const [indexA, indexB, indexC] of faceTriangles) {
    writePosition(facePositions, faceVertexOffset, vertices[indexA]);
    writePosition(facePositions, faceVertexOffset + 1, vertices[indexB]);
    writePosition(facePositions, faceVertexOffset + 2, vertices[indexC]);
    faceVertexOffset += VERTICES_PER_TRIANGLE;
  }

  return {
    edgeInstances,
    edgeCount: edges.length,
    facePositions,
    faceVertexCount,
  };
}

/**
 * For each face, computes which edge indices belong to it.
 * An edge belongs to a face if both its vertices are in the face's vertex list.
 */
function computeFaceEdges(
  faces: readonly (readonly number[])[],
  edges: readonly [number, number][]
): (readonly number[])[] {
  return faces.map(faceVertices => {
    const vertexSet = new Set(faceVertices);
    const matchingEdges: number[] = [];

    for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
      const [vertexA, vertexB] = edges[edgeIndex];
      if (vertexSet.has(vertexA) && vertexSet.has(vertexB)) {
        matchingEdges.push(edgeIndex);
      }
    }

    return matchingEdges;
  });
}

/**
 * Triangulates all faces using fan triangulation.
 * Returns the triangles and a mapping from each triangle to its source face index.
 */
function triangulateFaces(faces: readonly (readonly number[])[]): {
  faceTriangles: [number, number, number][];
  triangleFaceIndex: number[];
} {
  const faceTriangles: [number, number, number][] = [];
  const triangleFaceIndex: number[] = [];

  for (let faceIndex = 0; faceIndex < faces.length; faceIndex++) {
    const faceVertices = faces[faceIndex];

    if (faceVertices.length < 3) {
      continue;
    }

    // Fan triangulation from vertex 0
    const fanCenter = faceVertices[0];
    for (let triangleIndex = 1; triangleIndex < faceVertices.length - 1; triangleIndex++) {
      faceTriangles.push([fanCenter, faceVertices[triangleIndex], faceVertices[triangleIndex + 1]]);
      triangleFaceIndex.push(faceIndex);
    }
  }

  return { faceTriangles, triangleFaceIndex };
}

function writePosition(
  buffer: Float32Array,
  vertexIndex: number,
  position: readonly [number, number, number]
): void {
  const offset = vertexIndex * FACE_POSITION_FLOATS;

  buffer[offset] = position[0];
  buffer[offset + 1] = position[1];
  buffer[offset + 2] = position[2];
}
