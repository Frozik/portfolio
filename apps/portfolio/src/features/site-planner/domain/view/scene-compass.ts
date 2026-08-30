import { normalizeTurnDegrees } from '../units';
import { northNeedleAngleDegrees } from './north-offset';

/**
 * Where geographic north points on the screen of the 3D view, in degrees
 * clockwise from the top of the canvas — the angle its compass needle is turned
 * by.
 *
 * It is the plan's own needle (`view/north-offset.ts`) turned by the camera:
 * the yaw turns the view anticlockwise from due plan north, which leaves
 * everything fixed to the ground — the needle among it — that many degrees
 * clockwise of where the plan draws it.
 */
export function computeSceneNorthAngleDegrees({
  cameraYawDegrees,
  northOffsetDegrees,
}: {
  readonly cameraYawDegrees: number;
  readonly northOffsetDegrees: number;
}): number {
  return normalizeTurnDegrees(cameraYawDegrees + northNeedleAngleDegrees(northOffsetDegrees));
}
