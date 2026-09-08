import { assertNever } from '@frozik/utils/assert/assertNever';

import { PICKUP_RADIUS_METERS } from '../../domain/constants';
import type { Pickup } from '../../domain/level';
import type { MeshWriter, Rgba } from './mesh-writer';

const SQUARE_HALF_METERS = PICKUP_RADIUS_METERS * 0.75;
const OUTLINE_WIDTH_METERS = 0.035;
const CENTRE_DOT_RADIUS_METERS = PICKUP_RADIUS_METERS * 0.25;
const RING_INNER_SHARE = 0.72;

/** The recording's three pickups: a filled diamond, an outlined square and a ring, the last two with a dot inside. */
export function writePickup(writer: MeshWriter, pickup: Pickup, color: Rgba): void {
  const { x, y } = pickup.position;
  const r = PICKUP_RADIUS_METERS;
  switch (pickup.shape) {
    case 'diamond':
      writer.convexPolygon(
        [
          { x, y: y - r },
          { x: x + r, y },
          { x, y: y + r },
          { x: x - r, y },
        ],
        color
      );
      return;
    case 'square': {
      const s = SQUARE_HALF_METERS;
      const corners = [
        { x: x - s, y: y - s },
        { x: x + s, y: y - s },
        { x: x + s, y: y + s },
        { x: x - s, y: y + s },
      ];
      corners.forEach((corner, index) => {
        writer.segment(corner, corners[(index + 1) % corners.length], OUTLINE_WIDTH_METERS, color);
      });
      writer.circle(pickup.position, CENTRE_DOT_RADIUS_METERS, color);
      return;
    }
    case 'ring':
      writer.ring(pickup.position, r * RING_INNER_SHARE, r, color);
      writer.circle(pickup.position, CENTRE_DOT_RADIUS_METERS, color);
      return;
    default:
      assertNever(pickup.shape);
  }
}
