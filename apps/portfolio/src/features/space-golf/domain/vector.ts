import type { Vector2 } from '@frozik/utils/math/vector2';

export const ZERO: Vector2 = { x: 0, y: 0 };

export function add(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtract(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

/** `+ 0` folds a negative zero into a plain zero, so directions compare by value. */
export function scale(v: Vector2, factor: number): Vector2 {
  return { x: v.x * factor + 0, y: v.y * factor + 0 };
}

export function dot(a: Vector2, b: Vector2): number {
  return a.x * b.x + a.y * b.y;
}

export function length(v: Vector2): number {
  return Math.hypot(v.x, v.y);
}

export function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** The unit vector along `v`; the zero vector stays zero. */
export function normalize(v: Vector2): Vector2 {
  const size = length(v);
  return size === 0 ? ZERO : { x: v.x / size, y: v.y / size };
}

/** `v` turned a quarter turn clockwise — the outward normal of a counter-clockwise edge. */
export function rightNormal(v: Vector2): Vector2 {
  return { x: v.y + 0, y: -v.x + 0 };
}

/** Caps the length of `v` at `maxLength`. */
export function clampLength(v: Vector2, maxLength: number): Vector2 {
  const size = length(v);
  return size > maxLength ? scale(v, maxLength / size) : v;
}
