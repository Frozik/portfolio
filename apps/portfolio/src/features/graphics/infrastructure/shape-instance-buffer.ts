import type { ShapeFillMode, ShapeInstance } from '../domain/chart-shapes';
import { SHAPE_TYPES } from '../domain/chart-shapes';

/**
 * Storage layout of one `ShapeData` in `shapes.wgsl`: three `vec4<f32>`
 *   (x, y, halfSize, spawnTime), (r, g, b, holdDuration), (shapeType, fillMode, maxOpacity, 0).
 */
export const SHAPE_INSTANCE_BYTES = 48;
const FLOATS_PER_SHAPE = SHAPE_INSTANCE_BYTES / Float32Array.BYTES_PER_ELEMENT;

const FLOATS_PER_VEC4 = 4;
const COLOR_OFFSET = FLOATS_PER_VEC4;
const KIND_OFFSET = FLOATS_PER_VEC4 * 2;

const FILL_MODE_CODE: Record<ShapeFillMode, number> = { solid: 0, outline: 1 };

export function createShapeDataBuffer(count: number): Float32Array {
  return new Float32Array(count * FLOATS_PER_SHAPE);
}

/** Packs `shapes` from the start of `target`; returns the bytes written. */
export function writeShapeInstances(
  target: Float32Array,
  shapes: readonly ShapeInstance[]
): number {
  shapes.forEach((shape, index) => {
    const base = index * FLOATS_PER_SHAPE;
    target[base] = shape.x;
    target[base + 1] = shape.y;
    target[base + 2] = shape.halfSize;
    target[base + 3] = shape.spawnTime;
    target[base + COLOR_OFFSET] = shape.color.r;
    target[base + COLOR_OFFSET + 1] = shape.color.g;
    target[base + COLOR_OFFSET + 2] = shape.color.b;
    target[base + COLOR_OFFSET + 3] = shape.holdDuration;
    target[base + KIND_OFFSET] = SHAPE_TYPES.indexOf(shape.shapeType);
    target[base + KIND_OFFSET + 1] = FILL_MODE_CODE[shape.fillMode];
    target[base + KIND_OFFSET + 2] = shape.maxOpacity;
    target[base + KIND_OFFSET + 3] = 0;
  });
  return shapes.length * SHAPE_INSTANCE_BYTES;
}
