import type { Vector2 } from '@frozik/utils/math/vector2';

/**
 * `floor`: a horizontal or vertical face — touching it turns gravity into it.
 * `deflector`: a 45° face — reflects only, gravity is untouched.
 * `bounce`: a horizontal or vertical face with a stronger rebound; the floor rule still applies.
 * `cup`: one segment of the hole's rounded rim — an ordinary wall the ball can rest on, gravity untouched.
 */
export type FaceKind = 'floor' | 'deflector' | 'bounce' | 'cup';

/** One face of a wall, with everything the sweep needs precomputed. */
export interface Edge {
  readonly from: Vector2;
  readonly to: Vector2;
  /** Unit vector from `from` to `to`. */
  readonly direction: Vector2;
  /** Unit outward normal. */
  readonly normal: Vector2;
  readonly length: number;
  readonly kind: FaceKind;
}

interface Bounds {
  readonly min: Vector2;
  readonly max: Vector2;
}

/** A polygon with counter-clockwise vertices; every edge is horizontal, vertical, diagonal or part of the cup's rim. */
export interface Wall {
  readonly vertices: readonly Vector2[];
  readonly edges: readonly Edge[];
  /** Axis-aligned box around the vertices, for skipping walls a motion cannot reach. */
  readonly bounds: Bounds;
}

export interface EdgeRef {
  readonly wall: number;
  readonly edge: number;
}

/** A row of spikes standing on part of a floor edge; its state flips with every stroke. */
export interface SpikeRow extends EdgeRef {
  /** Start of the row along the edge, metres from the edge's first vertex. */
  readonly from: number;
  readonly length: number;
  /** State during stroke 1; it flips with every stroke after that. */
  readonly extendedOnOddStrokes: boolean;
}

/**
 * The hole: a half-disc notch carved into a horizontal or vertical edge,
 * centred `at` metres along it. `edge` stays the index of the face the notch
 * was cut into (its first remaining part), so the face's line and normal are
 * still read from it.
 */
export interface Cup extends EdgeRef {
  readonly at: number;
  readonly radius: number;
}

export type PickupShape = 'diamond' | 'square' | 'ring';

/** A collectible floating in open space; it is gone once the ball has touched it. */
export interface Pickup {
  readonly position: Vector2;
  readonly shape: PickupShape;
}

export interface Level {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly walls: readonly Wall[];
  readonly spikes: readonly SpikeRow[];
  readonly pickups: readonly Pickup[];
  /** Where the ball starts, resting on a floor with gravity pointing down. */
  readonly tee: Vector2;
  readonly cup: Cup;
  /** Strokes the generator's own solution took. */
  readonly par: number;
}

/** Whether a ball centred at `point` is wholly outside the board — the board has no walls around it. */
export function isBeyondBoard(level: Level, point: Vector2, radius: number): boolean {
  return (
    point.x < -radius ||
    point.y < -radius ||
    point.x > level.width + radius ||
    point.y > level.height + radius
  );
}

export function edgeOf(level: Level, ref: EdgeRef): Edge {
  return level.walls[ref.wall].edges[ref.edge];
}

/** The point `at` metres along an edge from its first vertex. */
export function pointAlongEdge(edge: Edge, at: number): Vector2 {
  return { x: edge.from.x + edge.direction.x * at, y: edge.from.y + edge.direction.y * at };
}
