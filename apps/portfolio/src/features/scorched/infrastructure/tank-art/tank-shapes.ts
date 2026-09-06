import type { ShapeInstance } from '../shape-instances';
import type { ITankBlueprint, ITankPose } from './tank-blueprint';
import { buildHullShapes, buildTrackShapes, buildWheelInstances } from './tank-chassis-shapes';
import { buildDetailInstances } from './tank-detail-shapes';
import type { RgbColor } from './tank-paint';
import { shade, toInstance, toOutline } from './tank-paint';
import { buildGunShapes, buildTurretShapes } from './tank-turret-shapes';

const TRACK_SHADE = 0.45;

const WHEEL_SHADE = 0.2;

const GUN_SHADE = 0.15;

/**
 * Assembles the whole tank for one frame: gun first (its base hides under the turret), then the
 * outlined body, then wheels and details on top.
 */
export function buildTankShapes(blueprint: ITankBlueprint, pose: ITankPose): ShapeInstance[] {
  const bodyColor: RgbColor = pose.color;
  const trackColor = shade(bodyColor, TRACK_SHADE);
  const wheelColor = shade(bodyColor, WHEEL_SHADE);
  const gunColor = shade(bodyColor, GUN_SHADE);

  const gunShapes = buildGunShapes(blueprint, pose);
  const trackShapes = buildTrackShapes(blueprint, pose);
  const hullShapes = buildHullShapes(blueprint, pose);
  const turretShapes = buildTurretShapes(blueprint, pose);
  const bodyShapes = [...trackShapes, ...hullShapes, ...turretShapes];

  return [
    ...gunShapes.map(toOutline),
    ...gunShapes.map(shape => toInstance(shape, gunColor)),
    ...bodyShapes.map(toOutline),
    ...trackShapes.map(shape => toInstance(shape, trackColor)),
    ...hullShapes.map(shape => toInstance(shape, bodyColor)),
    ...turretShapes.map(shape => toInstance(shape, bodyColor)),
    ...buildWheelInstances(blueprint, pose, wheelColor),
    ...buildDetailInstances(blueprint, pose, bodyColor),
  ];
}
