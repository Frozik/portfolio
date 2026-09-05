import type { SolutionFaceGeometry } from './render-types';
import type { SolutionStatus } from './solution-check';
import type { Vec3Array } from './topology-types';

const FLOATS_PER_POSITION = 3;
const VERTICES_PER_TRIANGLE = 3;

/**
 * Triangulates the solution polygons as fans from their first vertex. Every
 * cross-section polygon is convex, so a fan covers it exactly.
 */
export function buildSolutionFace(
  solutionStatus: SolutionStatus | undefined
): SolutionFaceGeometry | undefined {
  if (!solutionStatus?.isSolved) {
    return undefined;
  }
  const faces = (solutionStatus.solutionFaces ?? []).filter(face => face.length >= 3);
  const triangleCount = faces.reduce((count, face) => count + face.length - 2, 0);
  if (triangleCount === 0) {
    return undefined;
  }

  const vertexCount = triangleCount * VERTICES_PER_TRIANGLE;
  const positions = new Float32Array(vertexCount * FLOATS_PER_POSITION);
  let writeOffset = 0;

  const writeVertex = (position: Vec3Array): void => {
    positions.set(position, writeOffset);
    writeOffset += FLOATS_PER_POSITION;
  };

  for (const face of faces) {
    const anchor = face[0];
    for (let index = 1; index < face.length - 1; index++) {
      writeVertex(anchor);
      writeVertex(face[index]);
      writeVertex(face[index + 1]);
    }
  }

  return { positions, vertexCount };
}
