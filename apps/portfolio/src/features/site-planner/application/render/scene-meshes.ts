import { isNil } from 'lodash-es';

import { APRON_DEPTH_METERS } from '../../domain/constants';
import { extrudeFootprint, extrudePrism } from '../../domain/geometry/extrude-footprint';
import type { LitMesh, RoofOverlayGeometry } from '../../domain/geometry/lit-mesh';
import { mergeLitMeshes } from '../../domain/geometry/lit-mesh';
import { offsetPolygons } from '../../domain/geometry/offset-polygon';
import {
  intersectPolygons,
  subtractPolygons,
  unionPolygons,
} from '../../domain/geometry/polygon-booleans';
import {
  buildFloorPlate,
  buildRoofPlate,
  SLAB_THICKNESS_METERS,
} from '../../domain/geometry/storey-plates';
import type { BuildingId } from '../../domain/model/site-plan';
import type { StoreyId } from '../../domain/model/storeys';
import { computeFootprintElevations } from '../../domain/terrain/cut-fill';
import type { Heightfield } from '../../domain/terrain/heightfield';
import type { SceneFurniture } from '../../domain/terrain/place-furniture';
import type { Meters } from '../../domain/units';
import { planToWorld } from '../../domain/view/world-frame';
import type { BuildingScene } from '../building-scene';
import { buildHeatingSolids } from '../duct-scenes';
import { buildPitchedRoofSolid } from '../roof-scenes';
import { buildSupportSolids } from '../storey-scenes';

/**
 * Everything the 3D view is handed about the BUILDINGS: their shells, plates,
 * stairs, posts, openings, roofs, flues and foundations, plus the covers laid
 * over the exposed ceilings and the furniture standing on the floors.
 *
 * It lives apart from the store because it is a pure derivation — scenes in,
 * meshes out — and because it was 340 lines of the store's 4400: the single
 * biggest thing in there that had nothing to do with holding state.
 */

/** How thick a terrace or a green cover lies over the roof slab it dresses. */
const ROOF_COVER_THICKNESS_METERS: Meters = 0.12;

/**
 * The foundation stands this much proud of the walls all round — the real
 * цоколь detail, and what keeps its faces off the walls' in the depth buffer.
 */
const FOUNDATION_LEDGE_METERS = 0.05;

/** Which storeys this pass draws: the one being edited, or all the others. */
export interface GhostPass {
  /** True for the blended pass — the storeys the editor is NOT aimed at. */
  readonly ghosted: boolean;
  /** The building whose editor is open; nothing means none is. */
  readonly editedBuildingId: BuildingId | undefined;
  readonly activeStoreyId: StoreyId | undefined;
}

export function buildBuildingMeshes({
  scenes,
  heightfield,
  pass,
}: {
  readonly scenes: readonly BuildingScene[];
  readonly heightfield: Heightfield;
  readonly pass: GhostPass;
}): LitMesh | undefined {
  const { ghosted } = pass;
  const meshes = scenes.flatMap(scene => {
    const { building, polygons, padElevation, storeys } = scene;

    if (isNil(padElevation) || polygons.length === 0) {
      return [];
    }

    const elevations = computeFootprintElevations(heightfield, polygons);

    if (isNil(elevations)) {
      return [];
    }

    const apronBaseElevation = Math.min(elevations.minElevation, padElevation) - APRON_DEPTH_METERS;
    const hasAnyWalls = storeys.some(storeyScene => storeyScene.wallBodies.length > 0);

    // A canopy — a carport, a porch roof — is a storey with posts and no
    // walls. Extruding its whole footprint as a block would put a solid cube
    // where the cars park, and would cast a cube's shadow (plan O-S2).
    const canopy = storeys.find(
      storeyScene => storeyScene.wallBodies.length === 0 && storeyScene.supports.length > 0
    );

    if (!hasAnyWalls && !isNil(canopy) && !isNil(canopy.baseElevation)) {
      if (ghosted) {
        return [];
      }

      const deck = buildRoofPlate({
        exposedCeiling: canopy.footprint,
        cutouts: [],
        ceilingElevation: canopy.baseElevation + canopy.storey.heightMeters,
      });

      return [
        ...buildSupportSolids(canopy),
        ...(isNil(deck)
          ? []
          : [
              extrudePrism({
                polygons: deck.polygons,
                baseElevation: deck.baseElevation,
                topElevation: deck.topElevation,
              }),
            ]),
      ];
    }

    // A building drawn only as a footprint keeps the classic massing block.
    if (!hasAnyWalls) {
      if (ghosted) {
        return [];
      }

      return [
        extrudeFootprint({
          polygons,
          padElevation,
          wallHeight: building.wallHeight,
          // A pad sunk below the ground it covers still needs a skirt going
          // down, so the apron starts from whichever of the two is lower.
          apronBaseElevation,
        }),
      ];
    }

    return storeys.flatMap(storeyScene => {
      const { storey, level, wallBodies, openingShapes, baseElevation, footprint, roofZones } =
        storeyScene;

      if (isNil(baseElevation) || wallBodies.length === 0) {
        return [];
      }

      if (isGhosted(scene, storey.id, pass) !== ghosted) {
        return [];
      }

      // The slab this storey stands on and the roof over whatever it does
      // not carry (plan O-A3): without them a house of walls is an open box
      // whose shadow is a ring, and there is nothing for a stair to pierce.
      // The stairs of the storey BELOW pierce this floor — that is the
      // stairwell, derived rather than drawn (the Sweet Home 3D model).
      // The plate reaches the walls' OUTER plane, not the drawn footprint:
      // wall bodies stand half a thickness proud of the outline, and a plate
      // stopping at the outline left an open 0.19 m slit around every storey —
      // read from outside as the upper floor overhanging the lower.
      const floorPlate = buildFloorPlate({
        footprint: unionPolygons([footprint, wallBodies]),
        // A shaft is a hole through the house: the floor it crosses is
        // opened for it exactly as it is for a stair.
        cutouts: [...storeyScene.stairCutouts, ...storeyScene.ductCutouts],
        floorElevation: baseElevation,
      });
      const exposedCeiling = roofZones.flatMap(zone => zone.polygons);
      const roofPlate = buildRoofPlate({
        exposedCeiling,
        cutouts: [...storeyScene.ownStairCutouts, ...storeyScene.ownDuctCutouts],
        ceilingElevation: baseElevation + storey.heightMeters,
      });
      const plates = [floorPlate, roofPlate].flatMap(plate =>
        isNil(plate)
          ? []
          : [
              extrudePrism({
                polygons: plate.polygons,
                baseElevation: plate.baseElevation,
                topElevation: plate.topElevation,
              }),
            ]
      );

      // Openings cut full-height slots; the masonry under each sill and the
      // lintel over each head come back as closed prisms.
      const slotted = subtractPolygons(
        wallBodies,
        openingShapes.flatMap(shape => shape.polygons)
      );
      const walls = slotted.length > 0 ? slotted : wallBodies;
      const shell =
        level === 0
          ? extrudeFootprint({
              polygons: walls,
              padElevation: baseElevation,
              wallHeight: storey.heightMeters,
              apronBaseElevation,
            })
          : extrudePrism({
              polygons: walls,
              baseElevation,
              topElevation: baseElevation + storey.heightMeters,
            });
      const pieces = storey.openings.flatMap(opening => {
        const shape = openingShapes.find(candidate => candidate.id === opening.id);

        if (isNil(shape) || shape.polygons.length === 0) {
          return [];
        }

        // The cutter overshoots the wall faces (its contract); the sill and
        // lintel fill only the slot itself, so they are the cutter clipped
        // back to the wall — used raw they would stand proud of every face.
        const slotFill = intersectPolygons(shape.polygons, wallBodies);

        if (slotFill.length === 0) {
          return [];
        }

        const prisms: LitMesh[] = [];

        if (opening.sillMeters > 0) {
          prisms.push(
            extrudePrism({
              polygons: slotFill,
              baseElevation,
              topElevation: baseElevation + Math.min(opening.sillMeters, storey.heightMeters),
            })
          );
        }

        if (opening.headMeters < storey.heightMeters) {
          prisms.push(
            extrudePrism({
              polygons: slotFill,
              baseElevation: baseElevation + opening.headMeters,
              topElevation: baseElevation + storey.heightMeters,
            })
          );
        }

        return prisms;
      });

      // Every step is a solid from the floor up: the classic staircase,
      // shadows and all, re-derived whenever the storey height changes.
      const stairSolids = storeyScene.stairs.flatMap(stairScene => {
        const stairBase = stairScene.baseElevation ?? baseElevation;

        return stairScene.steps.map(step =>
          extrudePrism({
            polygons: [step.polygon],
            baseElevation: stairBase,
            topElevation: stairBase + step.topOffsetMeters,
          })
        );
      });

      const postSolids = buildSupportSolids(storeyScene);

      return [shell, ...plates, ...stairSolids, ...postSolids, ...pieces];
    });
  });
  // A roof belongs to the storey it crowns and a shaft to the storey it rises
  // from, so both follow that storey between the two passes. Emitting them in
  // BOTH — as this did before it moved here — drew every chimney twice, once
  // solid and once blended over itself.
  const crowns = scenes.flatMap(scene => {
    const crownedStoreyId = scene.pitchedRoof?.crownedStoreyId;
    const roof =
      isNil(crownedStoreyId) || isGhosted(scene, crownedStoreyId, pass) !== ghosted
        ? undefined
        : buildPitchedRoofSolid(scene.pitchedRoof);
    const storeys = scene.storeys.filter(
      storeyScene => isGhosted(scene, storeyScene.storey.id, pass) === ghosted
    );
    const runs = scene.ducts.filter(run => isGhosted(scene, run.storeyId, pass) === ghosted);

    return [...(isNil(roof) ? [] : [roof]), ...buildHeatingSolids(storeys, runs)];
  });

  return mergeLitMeshes([...meshes, ...crowns]);
}

/**
 * While a building is open its storeys split between the two passes: the
 * active one solid, the rest ghosted. Every other building — and every storey
 * when nothing is being edited — stays solid.
 */
function isGhosted(scene: BuildingScene, storeyId: StoreyId, pass: GhostPass): boolean {
  return scene.building.id === pass.editedBuildingId && storeyId !== pass.activeStoreyId;
}

/**
 * The green and terrace covers laid over the exposed ceilings, one thin slab
 * each — the plain membrane stays the roof the extrusion already has.
 */
export function buildRoofOverlays(scenes: readonly BuildingScene[]): RoofOverlayGeometry {
  const green: LitMesh[] = [];
  const terrace: LitMesh[] = [];

  for (const scene of scenes) {
    for (const storeyScene of scene.storeys) {
      const { baseElevation, storey } = storeyScene;

      if (isNil(baseElevation)) {
        continue;
      }

      // The cover lies ON the roof slab, not inside it.
      const ceiling = baseElevation + storey.heightMeters + SLAB_THICKNESS_METERS;

      for (const zone of storeyScene.roofZones) {
        if (zone.cover === 'membrane' || zone.polygons.length === 0) {
          continue;
        }

        const slab = extrudePrism({
          polygons: zone.polygons,
          baseElevation: ceiling,
          topElevation: ceiling + ROOF_COVER_THICKNESS_METERS,
        });

        (zone.cover === 'green' ? green : terrace).push(slab);
      }
    }
  }

  return { green: mergeLitMeshes(green), terrace: mergeLitMeshes(terrace) };
}

/**
 * Every placed piece as a template instance for the 3D view — the storey's
 * floor plus the piece's own elevation baked into the world point, the plan
 * turn carried as-is (the car's convention, which the shader shares).
 */
export function buildSceneFurniture(scenes: readonly BuildingScene[]): readonly SceneFurniture[] {
  const instances: SceneFurniture[] = [];

  for (const scene of scenes) {
    for (const storeyScene of scene.storeys) {
      const { baseElevation } = storeyScene;

      if (isNil(baseElevation)) {
        continue;
      }

      for (const item of storeyScene.furniture) {
        instances.push({
          catalogId: item.catalogId,
          position: planToWorld(item.position, baseElevation + item.elevationMeters),
          rotationDegrees: item.rotationDegrees,
        });
      }
    }
  }

  return instances;
}

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
