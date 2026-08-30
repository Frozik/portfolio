import type { Vector2 } from '@frozik/utils/math/vector2';

/**
 * A closed ring of plan-coordinate vertices, stored without repeating the first
 * point. Winding carries meaning across the whole geometry pipeline: plan `y`
 * runs north, so a counter-clockwise ring has a positive shoelace area and
 * bounds material, while a clockwise ring bounds a void.
 */
export type Ring = readonly Vector2[];

/** Outer ring counter-clockwise, every hole ring clockwise — see {@link Ring}. */
export interface PolygonWithHoles {
  readonly outer: Ring;
  readonly holes: readonly Ring[];
}

export type MultiPolygon = readonly PolygonWithHoles[];

/** Triangle soup for a GPU buffer pair: `positions` holds interleaved x, y metres. */
export interface TriangleMesh {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
}
