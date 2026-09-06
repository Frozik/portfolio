const FLOAT32_BYTES = 4;
const WORLD_FLOATS_PER_VERTEX = 3;
const VERTEX_STRIDE = WORLD_FLOATS_PER_VERTEX * FLOAT32_BYTES;
const UV_FLOATS_PER_VERTEX = 2;
/** A tree instance: where its trunk stands, then its crown radius and its height. */
export const TREE_INSTANCE_FLOATS = 5;
/** A car instance: where it stands, then the turn of its nose off plan east. */
export const CAR_INSTANCE_FLOATS = 4;
/** Both layouts put the world position first, so the second attribute starts here. */
const INSTANCE_TRANSFORM_OFFSET = WORLD_FLOATS_PER_VERTEX * FLOAT32_BYTES;

/** Where a planted tree stands and how big it grew; one per instance. */
export const TREE_INSTANCE_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: TREE_INSTANCE_FLOATS * FLOAT32_BYTES,
  stepMode: 'instance',
  attributes: [
    { shaderLocation: 3, offset: 0, format: 'float32x3' },
    { shaderLocation: 4, offset: INSTANCE_TRANSFORM_OFFSET, format: 'float32x2' },
  ],
};

/** Where a parked car stands and which way it faces; one per instance. */
export const CAR_INSTANCE_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: CAR_INSTANCE_FLOATS * FLOAT32_BYTES,
  stepMode: 'instance',
  attributes: [
    { shaderLocation: 3, offset: 0, format: 'float32x3' },
    { shaderLocation: 4, offset: INSTANCE_TRANSFORM_OFFSET, format: 'float32' },
  ],
};

export function positionLayout(shaderLocation: number): GPUVertexBufferLayout {
  return {
    arrayStride: VERTEX_STRIDE,
    attributes: [{ shaderLocation, offset: 0, format: 'float32x3' }],
  };
}

/** Texture coordinates: two floats per vertex where positions carry three. */
export function uvLayout(shaderLocation: number): GPUVertexBufferLayout {
  return {
    arrayStride: UV_FLOATS_PER_VERTEX * FLOAT32_BYTES,
    attributes: [{ shaderLocation, offset: 0, format: 'float32x2' }],
  };
}
