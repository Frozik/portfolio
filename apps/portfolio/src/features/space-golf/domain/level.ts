import type { Vector2 } from '@frozik/utils/math/vector2';

/**
 * `floor`: a horizontal or vertical face — touching it turns gravity into it.
 * `bounce`: a stretch of floor that springs the ball back hard; the floor rule still applies.
 * `sticky`: a stretch of floor that swallows the impact and holds the ball; the floor rule still applies.
 * `deflector`: a 45° face — reflects only, gravity is untouched.
 * `cup`: one segment of the hole's rounded rim — touching it turns gravity into the face the hole is cut into.
 */
export type FaceKind = 'floor' | 'bounce' | 'sticky' | 'deflector' | 'cup';

/** The face kinds a stretch of a long, deep face may be given, each with its own look. */
export type SurfaceKind = 'bounce' | 'sticky';

/** Something the swept circle can run into, with everything the sweep needs precomputed. */
export interface Segment {
  readonly from: Vector2;
  readonly to: Vector2;
  /** Unit vector from `from` to `to`. */
  readonly direction: Vector2;
  /** Unit outward normal. */
  readonly normal: Vector2;
  readonly length: number;
}

/** One face of a wall. */
export interface Edge extends Segment {
  readonly kind: FaceKind;
}

interface Bounds {
  readonly min: Vector2;
  readonly max: Vector2;
}

/** A simple polygon with counter-clockwise vertices — one island; every edge is horizontal, vertical or diagonal. */
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

/**
 * A row of one to three spike teeth standing on a horizontal or vertical
 * face, `from` metres along it, each a ball's diameter wide. Rows stand
 * extended or retracted and flip with every stroke; `extendedAtStart` is
 * the state on the tee. `sides` are the slanted sides of every tooth when
 * extended, base on the face, apex two diameters out — what the ball must
 * not touch.
 */
export interface SpikeRow extends EdgeRef {
  readonly from: number;
  readonly teeth: number;
  readonly extendedAtStart: boolean;
  readonly sides: readonly Segment[];
}

export interface Level {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly walls: readonly Wall[];
  /** Where the ball starts, resting on a floor with gravity pointing down. */
  readonly tee: Vector2;
  readonly cup: Cup;
  readonly spikes: readonly SpikeRow[];
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

/** The point `at` metres along a segment from its first vertex. */
export function pointAlongEdge(edge: Segment, at: number): Vector2 {
  return { x: edge.from.x + edge.direction.x * at, y: edge.from.y + edge.direction.y * at };
}
