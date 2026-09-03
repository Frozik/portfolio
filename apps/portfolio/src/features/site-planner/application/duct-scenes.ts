import { isNil } from 'lodash-es';

import type { DuctRoofContext } from '../domain/geometry/duct-geometry';
import {
  crownHeadHeight,
  ductCrownPieces,
  ductFootprint,
  ductTopElevation,
} from '../domain/geometry/duct-geometry';
import { extrudePrism } from '../domain/geometry/extrude-footprint';
import type { LitMesh } from '../domain/geometry/lit-mesh';
import { isPointInMultiPolygon } from '../domain/geometry/polygon-booleans';
import { SLAB_THICKNESS_METERS } from '../domain/geometry/storey-plates';
import type { VerticalDuct } from '../domain/model/ducts';
import { FIREPLACE_SPECS, flueIdOf } from '../domain/model/fireplaces';
import type { StoreyId } from '../domain/model/storeys';
import type { Meters } from '../domain/units';
import type { PitchedRoofScene } from './roof-scenes';
import type { StoreyScene } from './storey-scenes';

/**
 * One shaft over its whole run (`building-editor.md` §9, R34/R35): where it
 * starts, where it must come out, and whether it comes out through the roof at
 * all. The run is the thing the 3D view draws and the thing the advisory reads,
 * so both answer the same derivation rather than two similar ones.
 */
export interface DuctRun {
  readonly duct: VerticalDuct;
  /** The storey it starts on — where a finding about it belongs. */
  readonly storeyId: StoreyId;
  readonly baseElevation: Meters;
  readonly topElevation: Meters;
  /** A shaft standing beside the roof rather than through it is a mistake. */
  readonly isOutsideRoof: boolean;
}

/**
 * Every shaft of a building, resolved from the storeys it starts on and the
 * roof it has to clear. A flue is derived from its fireplace and starts on top
 * of it; a vent shaft starts on the floor of the storey it was placed on.
 */
export function deriveDuctRuns(
  storeys: readonly StoreyScene[],
  roof: PitchedRoofScene | undefined
): readonly DuctRun[] {
  const roofContext = toRoofContext(roof);
  const top = storeys[storeys.length - 1];
  const ceilingElevation = isNil(top?.baseElevation)
    ? undefined
    : top.baseElevation + top.storey.heightMeters + SLAB_THICKNESS_METERS;

  return storeys.flatMap(storeyScene =>
    storeyScene.ducts
      .filter(section => section.startsHere)
      .flatMap(section => {
        const baseElevation = baseElevationOf(storeyScene, section.duct);

        if (isNil(baseElevation) || isNil(ceilingElevation)) {
          return [];
        }

        return [
          {
            duct: section.duct,
            storeyId: storeyScene.storey.id,
            baseElevation,
            topElevation: ductTopElevation({
              duct: section.duct,
              roof: roofContext,
              fallbackElevation: ceilingElevation,
            }),
            isOutsideRoof: !isNil(roof) && !isPointInMultiPolygon(roof.plan, section.duct.position),
          },
        ];
      })
  );
}

/** Every shaft as a solid, plus the bodies of the fireplaces they serve. */
export function buildHeatingSolids(
  storeys: readonly StoreyScene[],
  runs: readonly DuctRun[]
): readonly LitMesh[] {
  // The shaft stops one head-course short of its mouth: the оголовок band
  // wraps that last course whole, so the two meet on an internal face and the
  // open-air top wears the head, four posts and the floating rain cap.
  const shafts = runs.flatMap(run => [
    extrudePrism({
      polygons: [ductFootprint(run.duct)],
      baseElevation: run.baseElevation,
      topElevation: run.topElevation - crownHeadHeight(),
    }),
    ...ductCrownPieces(run.duct, run.topElevation).map(piece =>
      extrudePrism({
        polygons: piece.polygons,
        baseElevation: piece.baseElevation,
        topElevation: piece.topElevation,
      })
    ),
  ]);
  const bodies = storeys.flatMap(storeyScene =>
    storeyScene.fireplaces.flatMap(fireplaceScene =>
      isNil(storeyScene.baseElevation) || isNil(fireplaceScene.topElevation)
        ? []
        : [
            extrudePrism({
              polygons: [fireplaceScene.footprint],
              baseElevation: storeyScene.baseElevation,
              topElevation: fireplaceScene.topElevation,
            }),
          ]
    )
  );

  return [...bodies, ...shafts];
}

/**
 * A flue starts on top of the fireplace it serves, a vent shaft on the floor.
 * Starting a flue at the floor would bury it inside the stove it comes out of.
 */
function baseElevationOf(storeyScene: StoreyScene, duct: VerticalDuct): Meters | undefined {
  if (isNil(storeyScene.baseElevation)) {
    return undefined;
  }

  const owner = storeyScene.fireplaces.find(
    fireplaceScene => flueIdOf(fireplaceScene.fireplace) === duct.id
  );

  return isNil(owner)
    ? storeyScene.baseElevation
    : storeyScene.baseElevation + FIREPLACE_SPECS[owner.fireplace.kind].heightMeters;
}

function toRoofContext(roof: PitchedRoofScene | undefined): DuctRoofContext | undefined {
  return isNil(roof) || isNil(roof.eaveElevation) || isNil(roof.ridgeElevation)
    ? undefined
    : {
        frame: roof.frame,
        faces: roof.faces,
        creases: roof.creases,
        eaveElevation: roof.eaveElevation,
        ridgeElevation: roof.ridgeElevation,
      };
}
