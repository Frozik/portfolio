import {
  BASE_TRIANGLE_COUNT,
  EDGE_COUNT,
  FACE_POSITION_FLOATS,
  FACE_VERTEX_COUNT,
  PENTAGON_SIDES,
  PYRAMID_BASE_RADIUS,
  PYRAMID_HEIGHT,
  SIDE_TRIANGLE_COUNT,
  VERTICES_PER_TRIANGLE,
} from './stereometry-constants';
import type { PyramidTopology } from './stereometry-types';

/** Per-edge instance data: startPosition(3) + endPosition(3) = 6 floats */
const FLOATS_PER_EDGE_INSTANCE = 6;

/** Index of the apex vertex in the topology vertices array */
const APEX_VERTEX_INDEX = 5;

export interface PyramidWireframe {
  /** Instance buffer: 6 floats per edge (startPos + endPos) */
  readonly edgeInstances: Float32Array;
  readonly edgeCount: number;
  /** Face positions for depth-only rendering (position vec3 per vertex) */
  readonly facePositions: Float32Array;
  readonly faceVertexCount: number;
}

/**
 * Builds the topological description of a pentagonal pyramid.
 *
 * Geometry (centered at origin for rotation around the figure's center):
 * - 5 base vertices on the XZ plane at y = -height/2
 * - 1 apex at (0, +height/2, 0)
 *
 * Vertices: [base0, base1, base2, base3, base4, apex]
 * Edges 0-4: base edges (base[i] -> base[(i+1)%5])
 * Edges 5-9: lateral edges (base[i] -> apex)
 * Faces 0-4: side triangles (apex, base[i], base[(i+1)%5])
 * Face 5: pentagonal base (base[0..4])
 */
export function createPyramidTopology(): PyramidTopology {
  const centerYOffset = PYRAMID_HEIGHT / 2;

  const vertices: [number, number, number][] = [];

  for (let sideIndex = 0; sideIndex < PENTAGON_SIDES; sideIndex++) {
    const angle = (2 * Math.PI * sideIndex) / PENTAGON_SIDES;
    vertices.push([
      PYRAMID_BASE_RADIUS * Math.sin(angle),
      -centerYOffset,
      PYRAMID_BASE_RADIUS * Math.cos(angle),
    ]);
  }

  vertices.push([0, PYRAMID_HEIGHT - centerYOffset, 0]);

  const edges: [number, number][] = [];
  for (let sideIndex = 0; sideIndex < PENTAGON_SIDES; sideIndex++) {
    const nextIndex = (sideIndex + 1) % PENTAGON_SIDES;
    edges.push([sideIndex, nextIndex]);
  }
  for (let sideIndex = 0; sideIndex < PENTAGON_SIDES; sideIndex++) {
    edges.push([sideIndex, APEX_VERTEX_INDEX]);
  }

  const faces: (readonly number[])[] = [];
  const faceEdges: (readonly number[])[] = [];

  for (let sideIndex = 0; sideIndex < PENTAGON_SIDES; sideIndex++) {
    const nextIndex = (sideIndex + 1) % PENTAGON_SIDES;
    faces.push([APEX_VERTEX_INDEX, sideIndex, nextIndex]);

    const baseEdgeIndex = sideIndex;
    const lateralEdgeA = PENTAGON_SIDES + sideIndex;
    const lateralEdgeB = PENTAGON_SIDES + nextIndex;
    faceEdges.push([baseEdgeIndex, lateralEdgeA, lateralEdgeB]);
  }

  faces.push([0, 1, 2, 3, 4]);
  faceEdges.push([0, 1, 2, 3, 4]);

  const faceTriangles: [number, number, number][] = [];
  const triangleFaceIndex: number[] = [];

  for (let sideIndex = 0; sideIndex < SIDE_TRIANGLE_COUNT; sideIndex++) {
    const nextIndex = (sideIndex + 1) % PENTAGON_SIDES;
    faceTriangles.push([APEX_VERTEX_INDEX, sideIndex, nextIndex]);
    triangleFaceIndex.push(sideIndex);
  }

  const baseFaceIndex = PENTAGON_SIDES;
  for (let triangleIndex = 0; triangleIndex < BASE_TRIANGLE_COUNT; triangleIndex++) {
    faceTriangles.push([0, triangleIndex + 1, triangleIndex + 2]);
    triangleFaceIndex.push(baseFaceIndex);
  }

  return {
    vertices,
    faces,
    edges,
    faceEdges,
    faceTriangles,
    triangleFaceIndex,
  };
}

/**
 * Creates wireframe + face data for a pentagonal pyramid from its topology.
 *
 * Edge instances: 10 edges (5 base + 5 lateral), each as startPos + endPos.
 * Face positions: 8 triangles (5 sides + 3 base), positions only for depth buffer.
 */
export function createPentagonalPyramidWireframe(topology: PyramidTopology): PyramidWireframe {
  const { vertices } = topology;

  const edgeInstances = new Float32Array(EDGE_COUNT * FLOATS_PER_EDGE_INSTANCE);
  let edgeOffset = 0;

  for (let sideIndex = 0; sideIndex < PENTAGON_SIDES; sideIndex++) {
    const nextIndex = (sideIndex + 1) % PENTAGON_SIDES;
    writeEdge(edgeInstances, edgeOffset, vertices[sideIndex], vertices[nextIndex]);
    edgeOffset++;
  }

  for (let sideIndex = 0; sideIndex < PENTAGON_SIDES; sideIndex++) {
    writeEdge(edgeInstances, edgeOffset, vertices[sideIndex], vertices[APEX_VERTEX_INDEX]);
    edgeOffset++;
  }

  const facePositions = new Float32Array(FACE_VERTEX_COUNT * FACE_POSITION_FLOATS);
  let faceVertexOffset = 0;

  for (let sideIndex = 0; sideIndex < SIDE_TRIANGLE_COUNT; sideIndex++) {
    const baseA = vertices[sideIndex];
    const baseB = vertices[(sideIndex + 1) % PENTAGON_SIDES];
    const apex = vertices[APEX_VERTEX_INDEX];

    writePosition(facePositions, faceVertexOffset, apex);
    writePosition(facePositions, faceVertexOffset + 1, baseA);
    writePosition(facePositions, faceVertexOffset + 2, baseB);
    faceVertexOffset += VERTICES_PER_TRIANGLE;
  }

  for (let triangleIndex = 0; triangleIndex < BASE_TRIANGLE_COUNT; triangleIndex++) {
    const vertA = vertices[0];
    const vertB = vertices[triangleIndex + 2];
    const vertC = vertices[triangleIndex + 1];

    writePosition(facePositions, faceVertexOffset, vertA);
    writePosition(facePositions, faceVertexOffset + 1, vertB);
    writePosition(facePositions, faceVertexOffset + 2, vertC);
    faceVertexOffset += VERTICES_PER_TRIANGLE;
  }

  return {
    edgeInstances,
    edgeCount: EDGE_COUNT,
    facePositions,
    faceVertexCount: FACE_VERTEX_COUNT,
  };
}

function writeEdge(
  buffer: Float32Array,
  edgeIndex: number,
  start: [number, number, number],
  end: [number, number, number]
): void {
  const offset = edgeIndex * FLOATS_PER_EDGE_INSTANCE;

  buffer[offset] = start[0];
  buffer[offset + 1] = start[1];
  buffer[offset + 2] = start[2];

  buffer[offset + 3] = end[0];
  buffer[offset + 4] = end[1];
  buffer[offset + 5] = end[2];
}

function writePosition(
  buffer: Float32Array,
  vertexIndex: number,
  position: [number, number, number]
): void {
  const offset = vertexIndex * FACE_POSITION_FLOATS;

  buffer[offset] = position[0];
  buffer[offset + 1] = position[1];
  buffer[offset + 2] = position[2];
}
