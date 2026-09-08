import type { IPoint } from '../types';

export const POINTER_PUSH_RADIUS = 500;
/** Peak push right at the pointer, one unit of gravity, fading linearly to nothing at the radius. */
export const POINTER_PUSH_ACCELERATION = 0.001;

const NO_PUSH: IPoint = { x: 0, y: 0 };

/** Acceleration the pointer imparts on a bob at `position`, pointing away from the pointer. */
export function pointerPushAcceleration(pointer: IPoint, position: IPoint): IPoint {
  const x = position.x - pointer.x;
  const y = position.y - pointer.y;
  const distance = Math.hypot(x, y);

  if (distance === 0 || distance >= POINTER_PUSH_RADIUS) {
    return NO_PUSH;
  }

  const magnitude =
    ((POINTER_PUSH_RADIUS - distance) / POINTER_PUSH_RADIUS) * POINTER_PUSH_ACCELERATION;

  return { x: (x / distance) * magnitude, y: (y / distance) * magnitude };
}
