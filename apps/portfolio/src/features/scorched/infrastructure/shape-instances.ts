import { assert } from '@frozik/utils/assert/assert';

/** `ShapeInstance` in `shapes.wgsl`: three `vec4<f32>` — rect, colour and params. */
export const FLOATS_PER_SHAPE_INSTANCE = 12;
export const SHAPE_INSTANCE_BYTES = FLOATS_PER_SHAPE_INSTANCE * Float32Array.BYTES_PER_ELEMENT;
/** Two triangles, drawn without a vertex buffer. */
export const SHAPE_VERTEX_COUNT = 6;

export const SHAPE_KIND = {
  rectangle: 0,
  ellipse: 1,
  ring: 2,
} as const;

export type ShapeKind = (typeof SHAPE_KIND)[keyof typeof SHAPE_KIND];

const NO_ROTATION = 0;
const OPAQUE = 1;
const NO_INNER_RADIUS = 0;

export interface ShapeInstance {
  readonly centerXWu: number;
  readonly centerYWu: number;
  readonly halfWidthWu: number;
  readonly halfHeightWu: number;
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha?: number;
  /** Counter-clockwise, matching the world's y-up axes. */
  readonly rotationRadians?: number;
  readonly kind?: ShapeKind;
  /** Ring only: the hole's radius as a fraction of the outer radius. */
  readonly innerRadiusFraction?: number;
}

/** Growable staging array for one layer's shapes, written straight into a storage buffer. */
export class ShapeInstanceList {
  private readonly floats: Float32Array;
  private instanceCountValue = 0;

  constructor(private readonly capacity: number) {
    this.floats = new Float32Array(capacity * FLOATS_PER_SHAPE_INSTANCE);
  }

  get data(): Float32Array {
    return this.floats;
  }

  get instanceCount(): number {
    return this.instanceCountValue;
  }

  get hasRoom(): boolean {
    return this.instanceCountValue < this.capacity;
  }

  reset(): void {
    this.instanceCountValue = 0;
  }

  push(instance: ShapeInstance): void {
    assert(this.hasRoom, `shape instance capacity of ${this.capacity} exceeded`);

    const offset = this.instanceCountValue * FLOATS_PER_SHAPE_INSTANCE;

    this.floats[offset] = instance.centerXWu;
    this.floats[offset + 1] = instance.centerYWu;
    this.floats[offset + 2] = instance.halfWidthWu;
    this.floats[offset + 3] = instance.halfHeightWu;
    this.floats[offset + 4] = instance.red;
    this.floats[offset + 5] = instance.green;
    this.floats[offset + 6] = instance.blue;
    this.floats[offset + 7] = instance.alpha ?? OPAQUE;
    this.floats[offset + 8] = instance.rotationRadians ?? NO_ROTATION;
    this.floats[offset + 9] = instance.kind ?? SHAPE_KIND.rectangle;
    this.floats[offset + 10] = instance.innerRadiusFraction ?? NO_INNER_RADIUS;

    this.instanceCountValue++;
  }
}
