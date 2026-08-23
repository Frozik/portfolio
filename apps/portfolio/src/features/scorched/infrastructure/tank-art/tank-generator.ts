import { random } from 'lodash-es';

import type { ITankBlueprint, TurretStyle } from './tank-blueprint';

const TURRET_STYLES: readonly TurretStyle[] = ['angular', 'box', 'rounded'];

const MIN_HULL_LENGTH_WU = 13;
const MAX_HULL_LENGTH_WU = 16;
const MIN_HULL_HEIGHT_WU = 3.2;
const MAX_HULL_HEIGHT_WU = 4.2;
const MIN_TRACK_HEIGHT_WU = 2.8;
const MAX_TRACK_HEIGHT_WU = 3.6;
const MIN_WHEEL_COUNT = 4;
const MAX_WHEEL_COUNT = 6;
const MIN_TURRET_WIDTH_WU = 8;
const MAX_TURRET_WIDTH_WU = 11;
const MIN_TURRET_HEIGHT_WU = 2.8;
const MAX_TURRET_HEIGHT_WU = 3.6;
/** Kept tight around the domain's `GUN_BARREL_LENGTH_WU`, so shells spawn at the visual muzzle. */
const MIN_GUN_LENGTH_WU = 11.5;
const MAX_GUN_LENGTH_WU = 13;
const MIN_GUN_THICKNESS_WU = 1.3;
const MAX_GUN_THICKNESS_WU = 1.9;
const MUZZLE_BRAKE_CHANCE = 0.5;
const ANTENNA_CHANCE = 0.6;

function draw(chance: number): boolean {
  return random(1, true) < chance;
}

/** Rolls one cartoon tank: chunky chassis, a turret of one of three shapes, a gun to match. */
export function createTankBlueprint(): ITankBlueprint {
  return {
    hullLengthWu: random(MIN_HULL_LENGTH_WU, MAX_HULL_LENGTH_WU, true),
    hullHeightWu: random(MIN_HULL_HEIGHT_WU, MAX_HULL_HEIGHT_WU, true),
    trackHeightWu: random(MIN_TRACK_HEIGHT_WU, MAX_TRACK_HEIGHT_WU, true),
    wheelCount: random(MIN_WHEEL_COUNT, MAX_WHEEL_COUNT),
    turretStyle: TURRET_STYLES[random(TURRET_STYLES.length - 1)],
    turretWidthWu: random(MIN_TURRET_WIDTH_WU, MAX_TURRET_WIDTH_WU, true),
    turretHeightWu: random(MIN_TURRET_HEIGHT_WU, MAX_TURRET_HEIGHT_WU, true),
    gunLengthWu: random(MIN_GUN_LENGTH_WU, MAX_GUN_LENGTH_WU, true),
    gunThicknessWu: random(MIN_GUN_THICKNESS_WU, MAX_GUN_THICKNESS_WU, true),
    hasMuzzleBrake: draw(MUZZLE_BRAKE_CHANCE),
    hasAntenna: draw(ANTENNA_CHANCE),
  };
}
