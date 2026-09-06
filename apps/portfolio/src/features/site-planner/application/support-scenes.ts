import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { extrudePrism } from '../domain/geometry/extrude-footprint';
import type { LitMesh } from '../domain/geometry/lit-mesh';
import { isPointInMultiPolygon } from '../domain/geometry/polygon-booleans';
import type { MultiPolygon, PolygonWithHoles } from '../domain/geometry/polygon-types';
import { supportFootprint } from '../domain/geometry/stair-mesh';
import { supportSpan } from '../domain/geometry/support-span';
import type { Storey } from '../domain/model/storeys';
import { supportsOf } from '../domain/model/storeys';
import type { SupportPost } from '../domain/model/supports';
import type { Meters } from '../domain/units';

/** The posts of a storey with both of their ends worked out. */
/** One post resolved for drawing: its section, and what it actually spans. */
export interface SupportScene {
  readonly post: SupportPost;
  readonly footprint: PolygonWithHoles;
  readonly baseElevation: Meters | undefined;
  readonly topElevation: Meters | undefined;
  /** A post outside the storey's footprint carries an overhang or a canopy. */
  readonly isFreeStanding: boolean;
}

/** Every post of a storey as a solid between its two derived ends. */
export function buildSupportSolids(supports: readonly SupportScene[]): readonly LitMesh[] {
  return supports.flatMap(supportScene =>
    isNil(supportScene.baseElevation) ||
    isNil(supportScene.topElevation) ||
    supportScene.topElevation <= supportScene.baseElevation
      ? []
      : [
          extrudePrism({
            polygons: [supportScene.footprint],
            baseElevation: supportScene.baseElevation,
            topElevation: supportScene.topElevation,
          }),
        ]
  );
}

/**
 * The posts of one storey. Both ends derive — the floor or the graded ground
 * beneath, the storey's ceiling above — so a canopy on a slope gets posts of
 * the right, different lengths.
 */
export function deriveSupportScenes(
  storey: Storey,
  footprint: MultiPolygon,
  floor: Meters | undefined,
  groundElevationAtPoint: (point: Vector2) => Meters
): readonly SupportScene[] {
  const ceiling = isNil(floor) ? undefined : floor + storey.heightMeters;

  return supportsOf(storey).map(post => {
    const span =
      isNil(floor) || isNil(ceiling)
        ? undefined
        : supportSpan({
            post,
            storeyFootprint: footprint,
            floorElevation: floor,
            ceilingElevation: ceiling,
            groundElevationAt: groundElevationAtPoint,
          });

    return {
      post,
      footprint: supportFootprint(post),
      baseElevation: span?.baseElevation,
      topElevation: span?.topElevation,
      isFreeStanding: !isPointInMultiPolygon(footprint, post.position),
    };
  });
}
