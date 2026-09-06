import type { ShapeInstance } from '../shape-instances';
import { SHAPE_KIND } from '../shape-instances';
import type { ITankBlueprint, ITankPose } from './tank-blueprint';
import type { PartShape, RgbColor } from './tank-paint';
import { HALF, OUTLINE_COLOR, toInstance } from './tank-paint';

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

function getTrackLength(blueprint: ITankBlueprint): number {
  return blueprint.hullLengthWu * TRACK_LENGTH_FRACTION;
}

function getHullBottom(blueprint: ITankBlueprint, pose: ITankPose): number {
  return pose.baseYWu + blueprint.trackHeightWu * HULL_DROP_FRACTION;
}

export function getTurretBase(blueprint: ITankBlueprint, pose: ITankPose): number {
  return getHullBottom(blueprint, pose) + blueprint.hullHeightWu;
}

export function buildTrackShapes(blueprint: ITankBlueprint, pose: ITankPose): PartShape[] {
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

export function buildHullShapes(blueprint: ITankBlueprint, pose: ITankPose): PartShape[] {
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

export function buildWheelInstances(
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
