import { isNil } from 'lodash-es';

import { APRON_DEPTH_METERS } from '../../domain/constants';
import { extrudeFootprint } from '../../domain/geometry/extrude-footprint';
import type { LitMesh } from '../../domain/geometry/lit-mesh';
import { mergeLitMeshes } from '../../domain/geometry/lit-mesh';
import { offsetPolygons } from '../../domain/geometry/offset-polygon';
import { computeFootprintElevations } from '../../domain/terrain/cut-fill';
import type { Heightfield } from '../../domain/terrain/heightfield';
import type { BuildingScene } from '../building-scene';

/**
 * The foundation stands this much proud of the walls all round — the real
 * цоколь detail, and what keeps its faces off the walls' in the depth buffer.
 */
const FOUNDATION_LEDGE_METERS = 0.05;

/**
 * The foundations as the 3D view pours them: one concrete solid per building
 * from below the pad up to the цоколь, its footprint a ledge proud of the
 * walls — the real detail that also keeps the two solids' faces from fighting
 * over the same pixels.
 */
export function buildFoundationSolids({
  scenes,
  heightfield,
}: {
  readonly scenes: readonly BuildingScene[];
  readonly heightfield: Heightfield;
}): LitMesh | undefined {
  const meshes = scenes.flatMap(scene => {
    const { polygons, padElevation, foundation } = scene;
    const height = foundation.depthMeters + foundation.heightAboveGroundMeters;

    if (isNil(padElevation) || polygons.length === 0 || height <= 0) {
      return [];
    }

    const outset = offsetPolygons(polygons, FOUNDATION_LEDGE_METERS);

    if (outset.length === 0) {
      return [];
    }

    const elevations = computeFootprintElevations(heightfield, outset);

    if (isNil(elevations)) {
      return [];
    }

    const baseElevation = padElevation - foundation.depthMeters;

    return [
      extrudeFootprint({
        polygons: outset,
        padElevation: baseElevation,
        wallHeight: height,
        apronBaseElevation: Math.min(elevations.minElevation, baseElevation) - APRON_DEPTH_METERS,
      }),
    ];
  });

  return mergeLitMeshes(meshes);
}
