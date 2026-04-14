import { FACE_POSITION_FLOATS, VERTICES_PER_TRIANGLE } from './constants';
import type { FigureTopology, PreparedPuzzle, PuzzleDefinition } from './types';

export interface FigureWireframe {
  /** Face positions for depth-only rendering (position vec3 per vertex) */
  readonly facePositions: Float32Array;
  readonly faceVertexCount: number;
}

/**
 * Prepares a puzzle for rendering by merging vertices across figures,
 * deriving edges from faces, and building the full topology.
 */
export function preparePuzzle(puzzle: PuzzleDefinition): PreparedPuzzle {
  const allVertices: [number, number, number][] = [];
  const allFaces: (readonly number[])[] = [];
  const edgeSet = new Set<string>();
  const edges: [number, number][] = [];

  for (const figure of puzzle.input.figures) {
    const vertexOffset = allVertices.length;

    // Add figure vertices to global list
    for (const position of figure.vertices) {
      allVertices.push([position[0], position[1], position[2]]);
    }

    // Remap face indices to global and extract edges
    for (const face of figure.faces) {
      const globalFace = face.map(localIndex => localIndex + vertexOffset);
      allFaces.push(globalFace);

      for (let index = 0; index < globalFace.length; index++) {
        const nextIndex = (index + 1) % globalFace.length;
        const vertexA = Math.min(globalFace[index], globalFace[nextIndex]);
        const vertexB = Math.max(globalFace[index], globalFace[nextIndex]);
        const edgeKey = `${vertexA}-${vertexB}`;

        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push([vertexA, vertexB]);
        }
      }
    }
  }

  const topology = createTopology(allVertices, edges, allFaces);

  return { name: puzzle.name, topology };
}

/**
 * Builds the topology from vertices, edges, and faces.
 * Computes derived data: face-edge mapping, triangulated faces, triangle-to-face index.
 */
function createTopology(
  vertices: readonly (readonly [number, number, number])[],
  edges: readonly [number, number][],
  faces: readonly (readonly number[])[]
): FigureTopology {
  const faceTriangles = triangulateFaces(faces);

  return {
    vertices,
    edges,
    faces,
    faceTriangles,
  };
}

/**
 * Creates wireframe + face data from a topology for GPU rendering.
 */
export function createWireframeFromTopology(topology: FigureTopology): FigureWireframe {
  const { vertices, faceTriangles } = topology;
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
    facePositions,
    faceVertexCount,
  };
}

/**
 * Triangulates all faces using fan triangulation.
 */
function triangulateFaces(faces: readonly (readonly number[])[]): [number, number, number][] {
  const faceTriangles: [number, number, number][] = [];

  for (const faceVertices of faces) {
    if (faceVertices.length < 3) {
      continue;
    }

    // Fan triangulation from vertex 0
    const fanCenter = faceVertices[0];
    for (let triangleIndex = 1; triangleIndex < faceVertices.length - 1; triangleIndex++) {
      faceTriangles.push([fanCenter, faceVertices[triangleIndex], faceVertices[triangleIndex + 1]]);
    }
  }

  return faceTriangles;
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
