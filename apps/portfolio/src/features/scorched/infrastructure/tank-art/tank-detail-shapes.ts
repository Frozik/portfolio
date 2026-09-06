import type { ShapeInstance } from '../shape-instances';
import { SHAPE_KIND } from '../shape-instances';
import type { ITankBlueprint, ITankPose } from './tank-blueprint';
import { getTurretBase } from './tank-chassis-shapes';
import type { RgbColor } from './tank-paint';
import { HALF, OUTLINE_COLOR, tint, toInstance } from './tank-paint';
import { TURRET_FORWARD_OFFSET_WU } from './tank-turret-shapes';

const HIGHLIGHT_TINT = 0.55;

const HULL_HIGHLIGHT_HALF_HEIGHT_WU = 0.35;

const HULL_HIGHLIGHT_DROP_WU = 0.6;

const HULL_HIGHLIGHT_WIDTH_FRACTION = 0.55;

const TURRET_HIGHLIGHT_X_FRACTION = 0.18;

const TURRET_HIGHLIGHT_WIDTH_FRACTION = 0.14;

const TURRET_HIGHLIGHT_HEIGHT_FRACTION = 0.18;

const TURRET_HIGHLIGHT_RAISE_FRACTION = 0.6;

const ANTENNA_GAP_WU = 0.4;

const ANTENNA_HALF_WIDTH_WU = 0.16;

const ANTENNA_HALF_HEIGHT_WU = 1.6;

const ANTENNA_TIP_RADIUS_WU = 0.4;

export function buildDetailInstances(
  blueprint: ITankBlueprint,
  pose: ITankPose,
  bodyColor: RgbColor
): ShapeInstance[] {
  const facingSign = pose.aim.facing === 'right' ? 1 : -1;
  const highlight = tint(bodyColor, HIGHLIGHT_TINT);
  const turretCenterX = pose.centerXWu + facingSign * TURRET_FORWARD_OFFSET_WU;
  const turretBaseY = getTurretBase(blueprint, pose);
  const instances: ShapeInstance[] = [
    toInstance(
      {
        centerXWu: pose.centerXWu,
        centerYWu: turretBaseY - HULL_HIGHLIGHT_DROP_WU,
        halfWidthWu: blueprint.hullLengthWu * HALF * HULL_HIGHLIGHT_WIDTH_FRACTION,
        halfHeightWu: HULL_HIGHLIGHT_HALF_HEIGHT_WU,
      },
      highlight
    ),
    toInstance(
      {
        centerXWu:
          turretCenterX - facingSign * blueprint.turretWidthWu * TURRET_HIGHLIGHT_X_FRACTION,
        centerYWu: turretBaseY + blueprint.turretHeightWu * TURRET_HIGHLIGHT_RAISE_FRACTION,
        halfWidthWu: blueprint.turretWidthWu * TURRET_HIGHLIGHT_WIDTH_FRACTION,
        halfHeightWu: blueprint.turretHeightWu * TURRET_HIGHLIGHT_HEIGHT_FRACTION,
        kind: SHAPE_KIND.ellipse,
      },
      highlight
    ),
  ];

  if (blueprint.hasAntenna) {
    const antennaX = turretCenterX - facingSign * (blueprint.turretWidthWu * HALF + ANTENNA_GAP_WU);
    const mastCenterY = turretBaseY + blueprint.turretHeightWu + ANTENNA_HALF_HEIGHT_WU;

    instances.push(
      toInstance(
        {
          centerXWu: antennaX,
          centerYWu: mastCenterY,
          halfWidthWu: ANTENNA_HALF_WIDTH_WU,
          halfHeightWu: ANTENNA_HALF_HEIGHT_WU,
        },
        OUTLINE_COLOR
      ),
      toInstance(
        {
          centerXWu: antennaX,
          centerYWu: mastCenterY + ANTENNA_HALF_HEIGHT_WU,
          halfWidthWu: ANTENNA_TIP_RADIUS_WU,
          halfHeightWu: ANTENNA_TIP_RADIUS_WU,
          kind: SHAPE_KIND.ellipse,
        },
        highlight
      )
    );
  }

  return instances;
}
