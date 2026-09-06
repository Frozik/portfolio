import { isNil } from 'lodash-es';
import { subtractPolygons } from '../domain/geometry/polygon-booleans';
import { computeMultiPolygonCentroid } from '../domain/geometry/polygon-centroid';
import type { BuildingWarning } from '../domain/model/building-warnings';
import { collectBuildingWarnings } from '../domain/model/building-warnings';
import type { BuildingScene } from './building-scene';
import { maxOverhangMeters } from './storey-scenes';

/**
 * The advisory pass over one resolved building: each storey is handed to the
 * domain's rules with exactly what they judge — overhang past the storey
 * below, the roof it wears, the rooms and the shafts stranded outside the roof.
 */
export function collectSceneWarnings(scene: BuildingScene): readonly BuildingWarning[] {
  return collectBuildingWarnings(
    scene.storeys.map((storeyScene, level) => {
      const below = scene.storeys[level - 1];
      const overhang =
        isNil(below) || storeyScene.footprint.length === 0
          ? undefined
          : subtractPolygons(storeyScene.footprint, below.footprint);
      const overhangAt = isNil(overhang) ? undefined : computeMultiPolygonCentroid(overhang);

      return {
        storeyId: storeyScene.storey.id,
        heightMeters: storeyScene.storey.heightMeters,
        footprint: storeyScene.footprint,
        stairwell: storeyScene.stairCutouts,
        furniture: storeyScene.furniture.map(piece => ({
          id: piece.id,
          position: piece.position,
        })),
        walls: storeyScene.wallShapes.map(wall => ({ id: wall.id, body: wall.polygons })),
        stairs: storeyScene.stairs.map(stairScene => ({
          id: stairScene.stair.id,
          position: stairScene.stair.position,
          isComfortable: stairScene.isComfortable,
        })),
        supportPositions: storeyScene.supports.map(supportScene => supportScene.post.position),
        // The roof's findings belong to the storey it crowns — the highest
        // one with built mass — and that is where the panel travels to.
        roofPitchDegrees:
          storeyScene.storey.id === scene.pitchedRoof?.crownedStoreyId
            ? scene.pitchedRoof.roof.pitchDegrees
            : undefined,
        rooms: storeyScene.rooms.map(room => ({
          roomTypeId: room.roomTypeId,
          polygons: room.polygons,
          at: room.centroid,
        })),
        saunaStovePositions: storeyScene.fireplaces
          .filter(fireplaceScene => fireplaceScene.fireplace.kind === 'saunaStove')
          .map(fireplaceScene => fireplaceScene.fireplace.position),
        ventPositions: storeyScene.ducts
          .filter(section => section.duct.kind === 'vent')
          .map(section => section.duct.position),
        strandedDucts: scene.ducts
          .filter(run => run.isOutsideRoof && run.storeyId === storeyScene.storey.id)
          .map(run => ({ id: run.duct.id, at: run.duct.position })),
        footprintBelow: below?.footprint,
        overhang: overhang ?? [],
        overhangMeters: isNil(overhang) ? 0 : maxOverhangMeters(overhang, below.footprint),
        overhangAt,
      };
    })
  );
}
