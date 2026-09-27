import type { Vector2 } from '@frozik/utils/math/vector2';

import type { DustWindow } from './particles';

/** The window with `margin` metres added on every side. */
export function grownBy(window: DustWindow, margin: number): DustWindow {
  return {
    min: { x: window.min.x - margin, y: window.min.y - margin },
    max: { x: window.max.x + margin, y: window.max.y + margin },
  };
}

export function middleOf(window: DustWindow): Vector2 {
  return { x: (window.min.x + window.max.x) / 2, y: (window.min.y + window.max.y) / 2 };
}

export function isWithin(window: DustWindow, point: Vector2): boolean {
  return (
    point.x >= window.min.x &&
    point.x <= window.max.x &&
    point.y >= window.min.y &&
    point.y <= window.max.y
  );
}

/** How far a line through `point` along `heading` runs inside `bounds`, backwards and forwards. */
export function reachOf(
  point: Vector2,
  heading: Vector2,
  bounds: DustWindow
): readonly [back: number, ahead: number] {
  let back = Number.NEGATIVE_INFINITY;
  let ahead = Number.POSITIVE_INFINITY;
  for (const axis of ['x', 'y'] as const) {
    if (heading[axis] === 0) {
      continue;
    }
    const toMin = (bounds.min[axis] - point[axis]) / heading[axis];
    const toMax = (bounds.max[axis] - point[axis]) / heading[axis];
    back = Math.max(back, Math.min(toMin, toMax));
    ahead = Math.min(ahead, Math.max(toMin, toMax));
  }
  return [back, ahead];
}
