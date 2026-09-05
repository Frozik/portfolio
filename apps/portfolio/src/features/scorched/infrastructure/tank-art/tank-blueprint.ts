import type { DialAim } from '../../domain/aim-dial';
import { toDialDegrees } from '../../domain/aim-dial';
import type { PlayerColor } from '../../presentation/player-colors';
import type { ShapeInstance } from '../shape-instances';
import { SHAPE_KIND } from '../shape-instances';

export type TurretStyle = 'angular' | 'box' | 'rounded';

/** A generated tank: chassis with tracks, a turret that turns with the aim, a gun that tilts. */
export interface ITankBlueprint {
  readonly hullLengthWu: number;
  readonly hullHeightWu: number;
  readonly trackHeightWu: number;
  readonly wheelCount: number;
  readonly turretStyle: TurretStyle;
  readonly turretWidthWu: number;
  readonly turretHeightWu: number;
  readonly gunLengthWu: number;
  readonly gunThicknessWu: number;
  readonly hasMuzzleBrake: boolean;
  readonly hasAntenna: boolean;
}

export interface ITankPose {
  readonly centerXWu: number;
  readonly baseYWu: number;
  readonly aim: DialAim;
  readonly color: PlayerColor;
}

export interface RgbColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

export function mixColor(startColor: RgbColor, endColor: RgbColor, fraction: number): RgbColor {
  return {
    red: startColor.red + (endColor.red - startColor.red) * fraction,
    green: startColor.green + (endColor.green - startColor.green) * fraction,
    blue: startColor.blue + (endColor.blue - startColor.blue) * fraction,
  };
}

const WHITE: RgbColor = { red: 1, green: 1, blue: 1 };
const BLACK: RgbColor = { red: 0, green: 0, blue: 0 };

function shade(color: RgbColor, fraction: number): RgbColor {
  return mixColor(color, BLACK, fraction);
}

function tint(color: RgbColor, fraction: number): RgbColor {
  return mixColor(color, WHITE, fraction);
}

/** The cartoon look of the reference sheet: a dark contour drawn behind every filled part. */
const OUTLINE_COLOR: RgbColor = { red: 0.07, green: 0.08, blue: 0.14 };
const OUTLINE_WU = 0.7;

const TRACK_SHADE = 0.45;
const WHEEL_SHADE = 0.2;
const GUN_SHADE = 0.15;
const HIGHLIGHT_TINT = 0.55;

const DEGREES_TO_RADIANS = Math.PI / 180;
const HALF = 0.5;

/** The track run is shorter than the hull, which overhangs it at both ends like the real thing. */
const TRACK_LENGTH_FRACTION = 0.88;
/** Idler wheels at the track's ends sit higher than the road wheels, sweeping the band up. */
const IDLER_RAISE_FRACTION = 0.62;
const IDLER_RADIUS_FRACTION = 0.42;
const WHEEL_RADIUS_INSET_WU = 0.25;
/** The hub hole of a wheel ring, as a fraction of its outer radius. */
const WHEEL_HUB_FRACTION = 0.45;
const WHEEL_HUB_DOT_FRACTION = 0.3;
/** The hull drops onto the track run, overlapping its top so no seam shows. */
const HULL_DROP_FRACTION = 0.8;
/** The hull's ends are sloped armour plates, not vertical cuts. */
const HULL_END_SLOPE_RADIANS = 0.45;
const HULL_END_WEDGE_LENGTH_FRACTION = 0.6;
const HULL_END_WEDGE_HEIGHT_FRACTION = 0.32;
const HULL_END_WEDGE_INSET_FRACTION = 0.15;
const TURRET_FORWARD_OFFSET_WU = 0.5;
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
const HULL_HIGHLIGHT_HALF_HEIGHT_WU = 0.35;
const HULL_HIGHLIGHT_DROP_WU = 0.6;
const HULL_HIGHLIGHT_WIDTH_FRACTION = 0.55;
const TURRET_HIGHLIGHT_X_FRACTION = 0.18;
const TURRET_HIGHLIGHT_WIDTH_FRACTION = 0.14;
const TURRET_HIGHLIGHT_HEIGHT_FRACTION = 0.18;
const TURRET_HIGHLIGHT_RAISE_FRACTION = 0.6;
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
const ANTENNA_GAP_WU = 0.4;
const ANTENNA_HALF_WIDTH_WU = 0.16;
const ANTENNA_HALF_HEIGHT_WU = 1.6;
const ANTENNA_TIP_RADIUS_WU = 0.4;

interface PartShape {
  readonly centerXWu: number;
  readonly centerYWu: number;
  readonly halfWidthWu: number;
  readonly halfHeightWu: number;
  readonly kind?: (typeof SHAPE_KIND)[keyof typeof SHAPE_KIND];
  readonly rotationRadians?: number;
}

function toInstance(shape: PartShape, color: RgbColor): ShapeInstance {
  return {
    centerXWu: shape.centerXWu,
    centerYWu: shape.centerYWu,
    halfWidthWu: shape.halfWidthWu,
    halfHeightWu: shape.halfHeightWu,
    kind: shape.kind,
    rotationRadians: shape.rotationRadians,
    red: color.red,
    green: color.green,
    blue: color.blue,
  };
}

function toOutline(shape: PartShape): ShapeInstance {
  return toInstance(
    {
      ...shape,
      halfWidthWu: shape.halfWidthWu + OUTLINE_WU,
      halfHeightWu: shape.halfHeightWu + OUTLINE_WU,
    },
    OUTLINE_COLOR
  );
}

function getTrackLength(blueprint: ITankBlueprint): number {
  return blueprint.hullLengthWu * TRACK_LENGTH_FRACTION;
}

function getHullBottom(blueprint: ITankBlueprint, pose: ITankPose): number {
  return pose.baseYWu + blueprint.trackHeightWu * HULL_DROP_FRACTION;
}

function getTurretBase(blueprint: ITankBlueprint, pose: ITankPose): number {
  return getHullBottom(blueprint, pose) + blueprint.hullHeightWu;
}

function buildTrackShapes(blueprint: ITankBlueprint, pose: ITankPose): PartShape[] {
  const trackHalf = getTrackLength(blueprint) * HALF;
  const bandHalfLength = trackHalf - blueprint.trackHeightWu * HALF;
  const centerY = pose.baseYWu + blueprint.trackHeightWu * HALF;
  const idlerRadius = blueprint.trackHeightWu * IDLER_RADIUS_FRACTION;
  const idlerY = pose.baseYWu + blueprint.trackHeightWu * IDLER_RAISE_FRACTION;

  return [
    {
      centerXWu: pose.centerXWu,
      centerYWu: centerY,
      halfWidthWu: bandHalfLength,
      halfHeightWu: blueprint.trackHeightWu * HALF,
    },
    ...[-bandHalfLength, bandHalfLength].map(offset => ({
      centerXWu: pose.centerXWu + offset,
      centerYWu: idlerY,
      halfWidthWu: idlerRadius,
      halfHeightWu: idlerRadius,
      kind: SHAPE_KIND.ellipse,
    })),
  ];
}

function buildHullShapes(blueprint: ITankBlueprint, pose: ITankPose): PartShape[] {
  const hullBottom = getHullBottom(blueprint, pose);
  const hullCenterY = hullBottom + blueprint.hullHeightWu * HALF;
  const wedgeHalfLength = blueprint.hullHeightWu * HULL_END_WEDGE_LENGTH_FRACTION;
  const wedgeHalfHeight = blueprint.hullHeightWu * HULL_END_WEDGE_HEIGHT_FRACTION;
  const wedgeX =
    blueprint.hullLengthWu * HALF - blueprint.hullHeightWu * HULL_END_WEDGE_INSET_FRACTION;

  return [
    {
      centerXWu: pose.centerXWu,
      centerYWu: hullCenterY,
      halfWidthWu: blueprint.hullLengthWu * HALF - wedgeHalfHeight,
      halfHeightWu: blueprint.hullHeightWu * HALF,
    },
    ...[-1, 1].map(side => ({
      centerXWu: pose.centerXWu + side * wedgeX,
      centerYWu: hullCenterY,
      halfWidthWu: wedgeHalfLength,
      halfHeightWu: wedgeHalfHeight,
      rotationRadians: -side * HULL_END_SLOPE_RADIANS,
    })),
  ];
}

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

function buildTurretShapes(blueprint: ITankBlueprint, pose: ITankPose): PartShape[] {
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

function buildGunShapes(blueprint: ITankBlueprint, pose: ITankPose): PartShape[] {
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

function buildWheelInstances(
  blueprint: ITankBlueprint,
  pose: ITankPose,
  wheelColor: RgbColor
): ShapeInstance[] {
  const radius = blueprint.trackHeightWu * HALF - WHEEL_RADIUS_INSET_WU;
  const spreadHalf = getTrackLength(blueprint) * HALF - blueprint.trackHeightWu * HALF;
  const centerY = pose.baseYWu + blueprint.trackHeightWu * HALF;
  const instances: ShapeInstance[] = [];

  for (let wheelIndex = 0; wheelIndex < blueprint.wheelCount; wheelIndex++) {
    const spreadFraction =
      blueprint.wheelCount === 1 ? 0 : wheelIndex / (blueprint.wheelCount - 1) - HALF;
    const centerX = pose.centerXWu + spreadFraction * 2 * spreadHalf;

    instances.push({
      ...toInstance(
        {
          centerXWu: centerX,
          centerYWu: centerY,
          halfWidthWu: radius,
          halfHeightWu: radius,
          kind: SHAPE_KIND.ring,
        },
        wheelColor
      ),
      innerRadiusFraction: WHEEL_HUB_FRACTION,
    });
    instances.push(
      toInstance(
        {
          centerXWu: centerX,
          centerYWu: centerY,
          halfWidthWu: radius * WHEEL_HUB_DOT_FRACTION,
          halfHeightWu: radius * WHEEL_HUB_DOT_FRACTION,
          kind: SHAPE_KIND.ellipse,
        },
        OUTLINE_COLOR
      )
    );
  }

  return instances;
}

function buildDetailInstances(
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
