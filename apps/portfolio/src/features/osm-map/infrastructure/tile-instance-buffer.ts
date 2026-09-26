import type { GroundPoint } from '../domain/mercator';
import type { TileInstance } from '../domain/tile-instances';

/**
 * Storage layout of one `TileInstance` in `ground.wgsl`: three `vec4<f32>`
 *   (originX, originY, size, layer), (fadeStart, baseLayer, baseU, baseV),
 *   (baseScale, 0, 0, 0),
 * with the origin relative to the camera target — see `CameraGeometry`.
 */
export const TILE_INSTANCE_BYTES = 48;
const FLOATS_PER_INSTANCE = TILE_INSTANCE_BYTES / Float32Array.BYTES_PER_ELEMENT;

export function createTileInstanceData(count: number): Float32Array {
  return new Float32Array(count * FLOATS_PER_INSTANCE);
}

/** Packs `instances` from the start of `target`; returns the bytes written. */
export function writeTileInstances(
  target: Float32Array,
  instances: readonly TileInstance[],
  origin: GroundPoint
): number {
  instances.forEach((instance, index) => {
    const base = index * FLOATS_PER_INSTANCE;
    target[base] = instance.origin.x - origin.x;
    target[base + 1] = instance.origin.y - origin.y;
    target[base + 2] = instance.size;
    target[base + 3] = instance.layer;
    target[base + 4] = instance.fadeStart;
    target[base + 5] = instance.baseLayer;
    target[base + 6] = instance.baseUv.x;
    target[base + 7] = instance.baseUv.y;
    target[base + 8] = instance.baseScale;
    target[base + 9] = 0;
    target[base + 10] = 0;
    target[base + 11] = 0;
  });
  return instances.length * TILE_INSTANCE_BYTES;
}
