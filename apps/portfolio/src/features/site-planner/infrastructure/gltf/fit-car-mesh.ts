import { CAR_HEIGHT_METERS, CAR_LENGTH_METERS, CAR_WIDTH_METERS } from '../../domain/constants';
import type { TexturedAssetMesh } from './parse-glb';

const COORDINATES_PER_VERTEX = 3;

/**
 * Fits the loaded car into the template frame every parked car is drawn in:
 * nose at `+x`, up `+y`, wheels on `y = 0` — and exactly
 * {@link CAR_LENGTH_METERS} × {@link CAR_WIDTH_METERS} ×
 * {@link CAR_HEIGHT_METERS}, whatever units and stance the asset came in.
 * The kit authors model the nose along `+z`, so the frame turns a quarter
 * around `y` first; the scale is per-axis, which is what pins the plan's
 * footprint and the 3D body to the same real dimensions.
 */
export function fitCarMesh(mesh: TexturedAssetMesh): TexturedAssetMesh {
  const rotatedPositions = new Float32Array(mesh.positions.length);
  const rotatedNormals = new Float32Array(mesh.normals.length);

  for (let offset = 0; offset < mesh.positions.length; offset += COORDINATES_PER_VERTEX) {
    // Model (x, y, z) → template (z, y, −x): +z becomes the nose at +x.
    rotatedPositions[offset] = mesh.positions[offset + 2];
    rotatedPositions[offset + 1] = mesh.positions[offset + 1];
    rotatedPositions[offset + 2] = -mesh.positions[offset];
    rotatedNormals[offset] = mesh.normals[offset + 2];
    rotatedNormals[offset + 1] = mesh.normals[offset + 1];
    rotatedNormals[offset + 2] = -mesh.normals[offset];
  }

  const bounds = boundsOf(rotatedPositions);
  const scaleX = CAR_LENGTH_METERS / (bounds.maxX - bounds.minX);
  const scaleY = CAR_HEIGHT_METERS / (bounds.maxY - bounds.minY);
  const scaleZ = CAR_WIDTH_METERS / (bounds.maxZ - bounds.minZ);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;

  for (let offset = 0; offset < rotatedPositions.length; offset += COORDINATES_PER_VERTEX) {
    rotatedPositions[offset] = (rotatedPositions[offset] - centerX) * scaleX;
    rotatedPositions[offset + 1] = (rotatedPositions[offset + 1] - bounds.minY) * scaleY;
    rotatedPositions[offset + 2] = (rotatedPositions[offset + 2] - centerZ) * scaleZ;

    // Normals under a per-axis scale follow the inverse — then renormalize.
    const normalX = rotatedNormals[offset] / scaleX;
    const normalY = rotatedNormals[offset + 1] / scaleY;
    const normalZ = rotatedNormals[offset + 2] / scaleZ;
    const length = Math.hypot(normalX, normalY, normalZ) || 1;

    rotatedNormals[offset] = normalX / length;
    rotatedNormals[offset + 1] = normalY / length;
    rotatedNormals[offset + 2] = normalZ / length;
  }

  return {
    positions: rotatedPositions,
    normals: rotatedNormals,
    uvs: mesh.uvs,
    indices: mesh.indices,
  };
}

interface MeshBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

function boundsOf(positions: Float32Array): MeshBounds {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let offset = 0; offset < positions.length; offset += COORDINATES_PER_VERTEX) {
    minX = Math.min(minX, positions[offset]);
    maxX = Math.max(maxX, positions[offset]);
    minY = Math.min(minY, positions[offset + 1]);
    maxY = Math.max(maxY, positions[offset + 1]);
    minZ = Math.min(minZ, positions[offset + 2]);
    maxZ = Math.max(maxZ, positions[offset + 2]);
  }

  return { minX, maxX, minY, maxY, minZ, maxZ };
}
