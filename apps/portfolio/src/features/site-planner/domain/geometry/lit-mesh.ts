/**
 * A shaded triangle mesh in world space: `positions` and `normals` both hold
 * interleaved x, y, z per vertex in the same order, so one index addresses a
 * position and its normal at once — the layout the 3D view binds as a pair of
 * vertex buffers.
 *
 * Distinct from `TriangleMesh`, which is flat plan-space geometry with nothing
 * to shade it: a mesh becomes lit only once it has been given an elevation and
 * a facing, which is what extruding a footprint does.
 */
export interface LitMesh {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
}

/** Shared by every builder that has nothing to extrude. */
export const EMPTY_LIT_MESH: LitMesh = {
  positions: new Float32Array(0),
  normals: new Float32Array(0),
  indices: new Uint32Array(0),
};

/**
 * The paths draped over the ground: one mesh per flat paving, and the seam
 * strips as a painted mesh whose vertex colours carry the fade baked in.
 */
export interface PathDrapeGeometry {
  readonly dirt: LitMesh;
  readonly asphalt: LitMesh;
  readonly blend: ColoredMesh;
}

/** The roof covers over the exposed ceilings, split by material for the 3D view. */
export interface RoofOverlayGeometry {
  readonly green: LitMesh | undefined;
  readonly terrace: LitMesh | undefined;
}

/** The placed pieces as the 3D view stands them, split by category. */

/**
 * One mesh out of many: vertices concatenated, indices rebased. The buildings
 * are all drawn by one pipeline in one call, so the scene carries them merged
 * rather than as a list the GPU layer would have to grow to hold.
 */
export function mergeLitMeshes(meshes: readonly LitMesh[]): LitMesh | undefined {
  if (meshes.length === 0) {
    return undefined;
  }

  if (meshes.length === 1) {
    return meshes[0];
  }

  const positionCount = meshes.reduce((sum, mesh) => sum + mesh.positions.length, 0);
  const indexCount = meshes.reduce((sum, mesh) => sum + mesh.indices.length, 0);
  const positions = new Float32Array(positionCount);
  const normals = new Float32Array(positionCount);
  const indices = new Uint32Array(indexCount);
  const FLOATS_PER_VERTEX = 3;
  let vertexOffset = 0;
  let floatOffset = 0;
  let indexOffset = 0;

  for (const mesh of meshes) {
    positions.set(mesh.positions, floatOffset);
    normals.set(mesh.normals, floatOffset);

    for (let index = 0; index < mesh.indices.length; index += 1) {
      indices[indexOffset + index] = mesh.indices[index] + vertexOffset;
    }

    floatOffset += mesh.positions.length;
    vertexOffset += mesh.positions.length / FLOATS_PER_VERTEX;
    indexOffset += mesh.indices.length;
  }

  return { positions, normals, indices };
}

/**
 * A lit mesh that also paints itself: `colors` holds interleaved r, g, b per
 * vertex, in the same order as the positions.
 *
 * A separate type rather than a colour on {@link LitMesh} that may be missing: a
 * render pipeline's vertex layout is fixed when the pipeline is built, so a mesh
 * carrying colours and one deriving them from its normals are drawn by two
 * pipelines either way — and the type is what says which of the two a mesh is
 * for.
 */
export interface ColoredMesh extends LitMesh {
  readonly colors: Float32Array;
}

/** Shared by every builder that has nothing painted to hand over. */
export const EMPTY_COLORED_MESH: ColoredMesh = {
  ...EMPTY_LIT_MESH,
  colors: new Float32Array(0),
};
