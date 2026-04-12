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

/** Per-edge instance data: startPosition(3) + endPosition(3) = 6 floats */
const FLOATS_PER_EDGE_INSTANCE = 6;

export interface PyramidWireframe {
  /** Instance buffer: 6 floats per edge (startPos + endPos) */
  readonly edgeInstances: Float32Array;
  readonly edgeCount: number;
  /** Face positions for depth-only rendering (position vec3 per vertex) */
  readonly facePositions: Float32Array;
  readonly faceVertexCount: number;
}

/**
 * Creates wireframe + face data for a pentagonal pyramid.
 *
 * Geometry (centered at origin for rotation around the figure's center):
 * - 5 base vertices on the XZ plane at y = -height/2
 * - 1 apex at (0, +height/2, 0)
 *
 * Edge instances: 10 edges (5 base + 5 lateral), each as startPos + endPos.
 * Face positions: 8 triangles (5 sides + 3 base), positions only for depth buffer.
 */
export function createPentagonalPyramidWireframe(): PyramidWireframe {
  const centerYOffset = PYRAMID_HEIGHT / 2;

  const basePositions: [number, number, number][] = [];
  for (let sideIndex = 0; sideIndex < PENTAGON_SIDES; sideIndex++) {
    const angle = (2 * Math.PI * sideIndex) / PENTAGON_SIDES;
    basePositions.push([
      PYRAMID_BASE_RADIUS * Math.sin(angle),
      -centerYOffset,
      PYRAMID_BASE_RADIUS * Math.cos(angle),
    ]);
  }

  const apex: [number, number, number] = [0, PYRAMID_HEIGHT - centerYOffset, 0];

  // --- Edge instances ---
  const edgeInstances = new Float32Array(EDGE_COUNT * FLOATS_PER_EDGE_INSTANCE);
  let edgeOffset = 0;

  for (let sideIndex = 0; sideIndex < PENTAGON_SIDES; sideIndex++) {
    const nextIndex = (sideIndex + 1) % PENTAGON_SIDES;
    writeEdge(edgeInstances, edgeOffset, basePositions[sideIndex], basePositions[nextIndex]);
    edgeOffset++;
  }

  for (let sideIndex = 0; sideIndex < PENTAGON_SIDES; sideIndex++) {
    writeEdge(edgeInstances, edgeOffset, basePositions[sideIndex], apex);
    edgeOffset++;
  }

  // --- Face positions (for depth buffer) ---
  const facePositions = new Float32Array(FACE_VERTEX_COUNT * FACE_POSITION_FLOATS);
  let faceVertexOffset = 0;

  // Side faces: apex → base[i] → base[i+1] (CCW from outside)
  for (let sideIndex = 0; sideIndex < SIDE_TRIANGLE_COUNT; sideIndex++) {
    const baseA = basePositions[sideIndex];
    const baseB = basePositions[(sideIndex + 1) % PENTAGON_SIDES];

    writePosition(facePositions, faceVertexOffset, apex);
    writePosition(facePositions, faceVertexOffset + 1, baseA);
    writePosition(facePositions, faceVertexOffset + 2, baseB);
    faceVertexOffset += VERTICES_PER_TRIANGLE;
  }

  // Base face: fan triangulation with reversed winding (normal points down)
  for (let triangleIndex = 0; triangleIndex < BASE_TRIANGLE_COUNT; triangleIndex++) {
    const vertA = basePositions[0];
    const vertB = basePositions[triangleIndex + 2];
    const vertC = basePositions[triangleIndex + 1];

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
