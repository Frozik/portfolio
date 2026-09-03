import type { Vector2 } from '@frozik/utils/math/vector2';
import { findLast, isNil } from 'lodash-es';
import type { LitMesh } from '../domain/geometry/lit-mesh';

import type { RoofCrease, RoofFace, RoofFrame, RoofPlane } from '../domain/geometry/pitched-roof';
import {
  roofCreases,
  roofFaces,
  roofFrameOf,
  roofPeakMeters,
  roofPlan,
} from '../domain/geometry/pitched-roof';
import { interiorPointOf, unionPolygons } from '../domain/geometry/polygon-booleans';
import type { MultiPolygon } from '../domain/geometry/polygon-types';
import { buildPitchedRoofMesh } from '../domain/geometry/roof-mesh';
import { SLAB_THICKNESS_METERS } from '../domain/geometry/storey-plates';
import type { PitchedRoof } from '../domain/model/roofs';
import { ROOF_THICKNESS_METERS } from '../domain/model/roofs';
import type { StoreyId } from '../domain/model/storeys';
import type { Meters } from '../domain/units';
import { DEGREES_TO_RADIANS } from '../domain/units';
import type { PlanSlopeArrow } from './render/plan-draw/draw-pitched-roof';
import type { StoreyScene } from './storey-scenes';

/**
 * The building's roof, resolved (`building-editor.md` §5, R33). It crowns the
 * TOP storey — its outline is what the slopes are cut to and its ceiling is
 * where they start, so raising another floor re-cuts the roof onto it rather
 * than leaving it hanging over the storey it was drawn for.
 */
export interface PitchedRoofScene {
  readonly roof: PitchedRoof;
  readonly frame: RoofFrame;
  readonly faces: readonly RoofFace[];
  /** The eaves outline — the storey below grown by the overhang. */
  readonly plan: MultiPolygon;
  readonly creases: readonly RoofCrease[];
  /** One arrow per slope: where it sits and which way the water runs. */
  readonly slopeArrows: readonly PlanSlopeArrow[];
  /** The storey outline the roof stands on; its gable walls close on it. */
  readonly footprint: MultiPolygon;
  /**
   * The ring the GABLE band stands on: the crowned storey's wall bodies
   * unioned with its footprint, so the triangle continues the walls' OUTER
   * face. Built from the drawn outline alone it stood half a wall thickness
   * behind the facade — a recessed gable with a ledge under it.
   */
  readonly gableFootprint: MultiPolygon;
  /** The storey the roof crowns — the highest one that HAS a footprint. */
  readonly crownedStoreyId: StoreyId;
  readonly eaveElevation: Meters | undefined;
  /**
   * Where the crowned storey's masonry ends — one ceiling slab BELOW the
   * eaves. Two датums, deliberately named apart: the roof planes bear on the
   * slab (`eaveElevation`), the gable masonry continues from the wall head.
   */
  readonly wallTopElevation: Meters | undefined;
  /** Where the ridge stands; nothing while the building has no pad. */
  readonly ridgeElevation: Meters | undefined;
}

export function derivePitchedRoofScene(
  roof: PitchedRoof | undefined,
  storeys: readonly StoreyScene[]
): PitchedRoofScene | undefined {
  // The roof crowns the highest storey that exists as built mass. A freshly
  // added storey with no walls and no slabs has no footprint yet — the roof
  // stays on what stands below it rather than vanishing into the empty level,
  // and climbs up on its own once the new storey gains a floor or walls.
  const top = findLast(storeys, storeyScene => storeyScene.footprint.length > 0);

  if (isNil(roof) || isNil(top)) {
    return undefined;
  }

  const frame = roofFrameOf(top.footprint, roof.ridgeDegrees);

  if (isNil(frame)) {
    return undefined;
  }

  const plan = roofPlan(top.footprint, roof.overhangMeters);
  // The slopes start on the ceiling slab, not on the wall head: that slab is
  // what the rafters actually bear on, and half a metre of error here shows up
  // in every elevation the roof takes part in.
  const wallTopElevation = isNil(top.baseElevation)
    ? undefined
    : top.baseElevation + top.storey.heightMeters;
  const eaveElevation = isNil(wallTopElevation)
    ? undefined
    : wallTopElevation + SLAB_THICKNESS_METERS;

  const faces = roofFaces(plan, frame, roof);

  return {
    roof,
    frame,
    faces,
    plan,
    creases: roofCreases(frame, roof),
    slopeArrows: faces.flatMap(face => {
      const at = interiorPointOf(face.polygons);

      return isNil(at) ? [] : [{ at, direction: descentDirection(frame, face.plane) }];
    }),
    footprint: top.footprint,
    gableFootprint:
      top.wallBodies.length === 0 ? top.footprint : unionPolygons([top.footprint, top.wallBodies]),
    crownedStoreyId: top.storey.id,
    eaveElevation,
    wallTopElevation,
    ridgeElevation: isNil(eaveElevation) ? undefined : eaveElevation + roofPeakMeters(frame, roof),
  };
}

/**
 * Which way water runs off a slope, in plan metres: down the gradient of its
 * plane, turned out of the roof's frame into the plan's.
 */
function descentDirection(frame: RoofFrame, plane: RoofPlane): Vector2 {
  const angle = frame.rotationDegrees * DEGREES_TO_RADIANS;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const gradientX = plane.du * cosine - plane.dv * sine;
  const gradientY = plane.du * sine + plane.dv * cosine;
  const length = Math.hypot(gradientX, gradientY);

  return length === 0 ? { x: 0, y: 0 } : { x: -gradientX / length, y: -gradientY / length };
}

/** The roof as the 3D view draws it — nothing while the pad is unknown. */
export function buildPitchedRoofSolid(scene: PitchedRoofScene | undefined): LitMesh | undefined {
  if (isNil(scene) || isNil(scene.eaveElevation)) {
    return undefined;
  }

  return buildPitchedRoofMesh({
    faces: scene.faces,
    frame: scene.frame,
    footprint: scene.gableFootprint,
    eaveElevation: scene.eaveElevation,
    wallTopElevation: scene.wallTopElevation ?? scene.eaveElevation,
    thicknessMeters: ROOF_THICKNESS_METERS,
  });
}
