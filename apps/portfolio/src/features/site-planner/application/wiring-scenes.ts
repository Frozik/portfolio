import { extrudePrism } from '@frozik/utils/geometry/extrudeFootprint';
import type { LitMesh } from '@frozik/utils/geometry/litMesh';
import type { MultiPolygon } from '@frozik/utils/geometry/polygonTypes';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { runHeightMeters } from '../domain/geometry/cable-length';
import type { Meters } from '../domain/units';
import type { StoreyScene } from './storey-scenes';

/** A cable in a conduit reads as a 3 cm tube at the scale of a house. */
const TUBE_METERS: Meters = 0.03;
const HALF = 0.5;

/**
 * The wiring of the given storeys as the 3D view shows it (`wiring.md`
 * §3.5): every run a thin square tube along its level under the ceiling or
 * over the floor, and a drop at either end down to the device's height. The
 * bends stay sharp — at this scale a mitre reads as honestly as a sweep.
 */
export function buildWiringSolids(storeys: readonly StoreyScene[]): readonly LitMesh[] {
  return storeys.flatMap(storeyScene => {
    const { baseElevation, storey } = storeyScene;

    if (isNil(baseElevation)) {
      return [];
    }

    return storeyScene.wires.flatMap(wire => {
      const runElevation = baseElevation + runHeightMeters(wire.level, storey.heightMeters);
      const tubes = wire.points.slice(1).map((point, index) =>
        extrudePrism({
          polygons: segmentTube(wire.points[index], point),
          baseElevation: runElevation - TUBE_METERS * HALF,
          topElevation: runElevation + TUBE_METERS * HALF,
        })
      );
      const drops = [
        [wire.points[0], wire.fromHeightMeters],
        [wire.points[wire.points.length - 1], wire.toHeightMeters],
      ] as const;

      for (const [at, heightMeters] of drops) {
        const deviceElevation = baseElevation + heightMeters;
        const low = Math.min(deviceElevation, runElevation);
        const high = Math.max(deviceElevation, runElevation);

        if (high - low > TUBE_METERS) {
          tubes.push(
            extrudePrism({ polygons: squareTube(at), baseElevation: low, topElevation: high })
          );
        }
      }

      return tubes;
    });
  });
}

/** A rectangle one tube wide along the segment, mitred by nothing — sharp ends. */
function segmentTube(from: Vector2, to: Vector2): MultiPolygon {
  const length = Math.hypot(to.x - from.x, to.y - from.y);

  if (length === 0) {
    return [];
  }

  const nx = (-(to.y - from.y) / length) * TUBE_METERS * HALF;
  const ny = ((to.x - from.x) / length) * TUBE_METERS * HALF;

  return [
    {
      outer: [
        { x: from.x + nx, y: from.y + ny },
        { x: to.x + nx, y: to.y + ny },
        { x: to.x - nx, y: to.y - ny },
        { x: from.x - nx, y: from.y - ny },
      ],
      holes: [],
    },
  ];
}

function squareTube(at: Vector2): MultiPolygon {
  const half = TUBE_METERS * HALF;

  return [
    {
      outer: [
        { x: at.x - half, y: at.y - half },
        { x: at.x + half, y: at.y - half },
        { x: at.x + half, y: at.y + half },
        { x: at.x - half, y: at.y + half },
      ],
      holes: [],
    },
  ];
}
