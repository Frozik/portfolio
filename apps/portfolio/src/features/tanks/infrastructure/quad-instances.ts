import { assert } from '@frozik/utils/assert/assert';

import type { AtlasUvRect } from './sprite-atlas';

/** `QuadInstance` in `quads.wgsl`: three `vec4<f32>` — rect, uv and params. */
export const FLOATS_PER_QUAD_INSTANCE = 12;
export const QUAD_INSTANCE_BYTES = FLOATS_PER_QUAD_INSTANCE * Float32Array.BYTES_PER_ELEMENT;
/** Two triangles, drawn without a vertex buffer. */
export const QUAD_VERTEX_COUNT = 6;

const NO_ROTATION_TURNS = 0;
const SINGLE_FRAME = 1;

export interface QuadInstance {
  readonly positionXWu: number;
  readonly positionYWu: number;
  readonly widthWu: number;
  readonly heightWu: number;
  readonly uvRect: AtlasUvRect;
  /** Quarter turns clockwise applied to the sprite art. */
  readonly rotationTurns?: number;
  /** Frames packed in `uvRect`; the shader cycles them from the tick uniform. */
  readonly frameCount?: number;
}

/** Growable staging array for one layer's instances, written straight into a storage buffer. */
export class QuadInstanceList {
  private readonly floats: Float32Array;
  private instanceCountValue = 0;

  constructor(private readonly capacity: number) {
    this.floats = new Float32Array(capacity * FLOATS_PER_QUAD_INSTANCE);
  }

  get data(): Float32Array {
    return this.floats;
  }

  get instanceCount(): number {
    return this.instanceCountValue;
  }

  reset(): void {
    this.instanceCountValue = 0;
  }

  push(instance: QuadInstance): void {
    assert(
      this.instanceCountValue < this.capacity,
      `quad instance capacity of ${this.capacity} exceeded`
    );

    const offset = this.instanceCountValue * FLOATS_PER_QUAD_INSTANCE;

    this.floats[offset] = instance.positionXWu;
    this.floats[offset + 1] = instance.positionYWu;
    this.floats[offset + 2] = instance.widthWu;
    this.floats[offset + 3] = instance.heightWu;
    this.floats[offset + 4] = instance.uvRect.minU;
    this.floats[offset + 5] = instance.uvRect.minV;
    this.floats[offset + 6] = instance.uvRect.maxU;
    this.floats[offset + 7] = instance.uvRect.maxV;
    this.floats[offset + 8] = instance.rotationTurns ?? NO_ROTATION_TURNS;
    this.floats[offset + 9] = instance.frameCount ?? SINGLE_FRAME;

    this.instanceCountValue++;
  }
}
