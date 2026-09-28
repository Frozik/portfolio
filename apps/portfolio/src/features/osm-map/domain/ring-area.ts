import type { Ring } from '@frozik/utils/geometry/polygonTypes';

/** Shoelace area with sign: positive when the ring winds counter-clockwise in the ring's own coordinate frame. */
export function signedArea(ring: Ring): number {
  let doubled = 0;
  for (let index = 0; index < ring.length; index++) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    doubled += current.x * next.y - next.x * current.y;
  }
  return doubled / 2;
}
