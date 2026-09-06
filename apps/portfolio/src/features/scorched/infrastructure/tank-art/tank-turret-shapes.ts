import { toDialDegrees } from '../../domain/aim-dial';
import { SHAPE_KIND } from '../shape-instances';
import type { ITankBlueprint, ITankPose } from './tank-blueprint';
import { getTurretBase } from './tank-chassis-shapes';
import type { PartShape } from './tank-paint';
import { HALF } from './tank-paint';

const DEGREES_TO_RADIANS = Math.PI / 180;

export const TURRET_FORWARD_OFFSET_WU = 0.5;

/** The gun mounts on the turret's front face, not its centre — like the mantlet on a real tank. */
const GUN_MOUNT_EDGE_FRACTION = 0.85;

/** The mount sits at this height up the turret's face, and the gun tilts around it. */
const GUN_PIVOT_HEIGHT_FRACTION = 0.55;

/** How deep the gun's base tucks behind the mantlet so the joint never shows. */
const GUN_BASE_TUCK_WU = 0.8;

const MANTLET_LENGTH_WU = 1;

const MANTLET_EXTRA_RADIUS_WU = 0.4;

const MUZZLE_LENGTH_WU = 1.1;

const MUZZLE_EXTRA_RADIUS_WU = 0.45;

/** The angular turret: a slab with sloped cheek plates closing towards a narrower roof. */
const ANGULAR_SLAB_WIDTH_FRACTION = 0.36;

const ANGULAR_CHEEK_WIDTH_FRACTION = 0.2;

const ANGULAR_CHEEK_HEIGHT_FRACTION = 0.42;

const ANGULAR_CHEEK_OFFSET_FRACTION = 0.33;

const ANGULAR_CHEEK_SLOPE_RADIANS = 0.38;

const BOX_SLAB_WIDTH_FRACTION = 0.95;

const ROUNDED_TURRET_BODY_FRACTION = 0.85;

const ROUNDED_TURRET_TOP_FRACTION = 0.5;

const ROUNDED_TURRET_TOP_CENTER_FRACTION = 0.72;

/** The commander's cupola stacked on angular and box turrets. */
const CUPOLA_WIDTH_FRACTION = 0.17;

const CUPOLA_HALF_HEIGHT_WU = 0.5;

const CUPOLA_CAP_WIDTH_FRACTION = 0.12;

const CUPOLA_CAP_HALF_HEIGHT_WU = 0.25;

const CUPOLA_REAR_OFFSET_FRACTION = 0.08;

function buildCupolaShapes(centerX: number, roofY: number, turretWidthWu: number): PartShape[] {
  return [
    {
      centerXWu: centerX,
      centerYWu: roofY + CUPOLA_HALF_HEIGHT_WU,
      halfWidthWu: turretWidthWu * CUPOLA_WIDTH_FRACTION,
      halfHeightWu: CUPOLA_HALF_HEIGHT_WU,
    },
    {
      centerXWu: centerX,
      centerYWu: roofY + CUPOLA_HALF_HEIGHT_WU * 2 + CUPOLA_CAP_HALF_HEIGHT_WU,
      halfWidthWu: turretWidthWu * CUPOLA_CAP_WIDTH_FRACTION,
      halfHeightWu: CUPOLA_CAP_HALF_HEIGHT_WU,
    },
  ];
}

export function buildTurretShapes(blueprint: ITankBlueprint, pose: ITankPose): PartShape[] {
  const facingSign = pose.aim.facing === 'right' ? 1 : -1;
  const centerX = pose.centerXWu + facingSign * TURRET_FORWARD_OFFSET_WU;
  const baseY = getTurretBase(blueprint, pose);
  const halfWidth = blueprint.turretWidthWu * HALF;
  const cupolaX = centerX - facingSign * blueprint.turretWidthWu * CUPOLA_REAR_OFFSET_FRACTION;
  const roofY = baseY + blueprint.turretHeightWu;

  switch (blueprint.turretStyle) {
    case 'angular':
      return [
        {
          centerXWu: centerX,
          centerYWu: baseY + blueprint.turretHeightWu * HALF,
          halfWidthWu: blueprint.turretWidthWu * ANGULAR_SLAB_WIDTH_FRACTION,
          halfHeightWu: blueprint.turretHeightWu * HALF,
        },
        ...[-1, 1].map(side => ({
          centerXWu: centerX + side * blueprint.turretWidthWu * ANGULAR_CHEEK_OFFSET_FRACTION,
          centerYWu: baseY + blueprint.turretHeightWu * ANGULAR_CHEEK_HEIGHT_FRACTION,
          halfWidthWu: blueprint.turretWidthWu * ANGULAR_CHEEK_WIDTH_FRACTION,
          halfHeightWu: blueprint.turretHeightWu * ANGULAR_CHEEK_HEIGHT_FRACTION,
          rotationRadians: side * ANGULAR_CHEEK_SLOPE_RADIANS,
        })),
        ...buildCupolaShapes(cupolaX, roofY, blueprint.turretWidthWu),
      ];
    case 'box':
      return [
        {
          centerXWu: centerX,
          centerYWu: baseY + blueprint.turretHeightWu * HALF,
          halfWidthWu: halfWidth * BOX_SLAB_WIDTH_FRACTION,
          halfHeightWu: blueprint.turretHeightWu * HALF,
        },
        ...buildCupolaShapes(cupolaX, roofY, blueprint.turretWidthWu),
      ];
    case 'rounded':
      return [
        {
          centerXWu: centerX,
          centerYWu: baseY + blueprint.turretHeightWu * HALF,
          halfWidthWu: halfWidth * ROUNDED_TURRET_BODY_FRACTION,
          halfHeightWu: blueprint.turretHeightWu * HALF,
        },
        {
          centerXWu: centerX,
          centerYWu: baseY + blueprint.turretHeightWu * ROUNDED_TURRET_TOP_CENTER_FRACTION,
          halfWidthWu: halfWidth,
          halfHeightWu: blueprint.turretHeightWu * ROUNDED_TURRET_TOP_FRACTION,
          kind: SHAPE_KIND.ellipse,
        },
      ];
    default:
      return [];
  }
}

function getGunPivot(blueprint: ITankBlueprint, pose: ITankPose): { x: number; y: number } {
  const facingSign = pose.aim.facing === 'right' ? 1 : -1;
  const mountOffset =
    TURRET_FORWARD_OFFSET_WU + blueprint.turretWidthWu * HALF * GUN_MOUNT_EDGE_FRACTION;

  return {
    x: pose.centerXWu + facingSign * mountOffset,
    y: getTurretBase(blueprint, pose) + blueprint.turretHeightWu * GUN_PIVOT_HEIGHT_FRACTION,
  };
}

export function buildGunShapes(blueprint: ITankBlueprint, pose: ITankPose): PartShape[] {
  const angle = toDialDegrees(pose.aim) * DEGREES_TO_RADIANS;
  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  const pivot = getGunPivot(blueprint, pose);
  const tuck = GUN_BASE_TUCK_WU;
  const along = (distance: number): { x: number; y: number } => ({
    x: pivot.x + direction.x * distance,
    y: pivot.y + direction.y * distance,
  });
  const barrelCenter = along(tuck + blueprint.gunLengthWu * HALF);
  const mantletCenter = along(tuck + MANTLET_LENGTH_WU);
  const shapes: PartShape[] = [
    {
      centerXWu: barrelCenter.x,
      centerYWu: barrelCenter.y,
      halfWidthWu: blueprint.gunLengthWu * HALF,
      halfHeightWu: blueprint.gunThicknessWu * HALF,
      rotationRadians: angle,
    },
    {
      centerXWu: mantletCenter.x,
      centerYWu: mantletCenter.y,
      halfWidthWu: MANTLET_LENGTH_WU,
      halfHeightWu: blueprint.gunThicknessWu * HALF + MANTLET_EXTRA_RADIUS_WU,
      rotationRadians: angle,
    },
  ];

  if (blueprint.hasMuzzleBrake) {
    const muzzleCenter = along(tuck + blueprint.gunLengthWu - MUZZLE_LENGTH_WU);

    shapes.push({
      centerXWu: muzzleCenter.x,
      centerYWu: muzzleCenter.y,
      halfWidthWu: MUZZLE_LENGTH_WU,
      halfHeightWu: blueprint.gunThicknessWu * HALF + MUZZLE_EXTRA_RADIUS_WU,
      rotationRadians: angle,
    });
  }

  return shapes;
}
