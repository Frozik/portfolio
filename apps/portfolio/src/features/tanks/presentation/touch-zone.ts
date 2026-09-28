import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp } from 'lodash-es';

/** The half of the play area a control owns; points inside it are measured from its top-left. */
export interface TouchZoneSize {
  readonly width: number;
  readonly height: number;
}

/** A captured finger travels anywhere on the screen; the control it carries stays in its zone. */
export function clampToZone(point: Vector2, zone: TouchZoneSize): Vector2 {
  return { x: clamp(point.x, 0, zone.width), y: clamp(point.y, 0, zone.height) };
}
