import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { ductFootprint, fireplaceFootprint, fluePosition } from '../domain/geometry/duct-geometry';
import type { PolygonWithHoles } from '../domain/geometry/polygon-types';
import type { VerticalDuct } from '../domain/model/ducts';
import type { Fireplace, FireplaceId } from '../domain/model/fireplaces';
import { FIREPLACE_SPECS, flueOf } from '../domain/model/fireplaces';
import type { Storey } from '../domain/model/storeys';
import { ductsOf, fireplacesOf } from '../domain/model/storeys';
import type { Meters } from '../domain/units';

/** The vertical shafts of a building: fireplaces with the flues rising from them, and the ventilation ducts, storey by storey. */
/** One fireplace resolved for drawing: its body, and where its flue rises. */
export interface FireplaceScene {
  readonly fireplace: Fireplace;
  readonly footprint: PolygonWithHoles;
  readonly fluePosition: Vector2;
  /** Where the top of its body stands; nothing while the building has no pad. */
  readonly topElevation: Meters | undefined;
}

/** One shaft as it crosses one storey. */
export interface DuctSection {
  readonly duct: VerticalDuct;
  readonly footprint: PolygonWithHoles;
  /** Whether it starts on this storey rather than passing through it. */
  readonly startsHere: boolean;
  /** The fireplace it serves, when it is a derived flue rather than a placed shaft. */
  readonly fireplaceId: FireplaceId | undefined;
}

/** The fireplaces of one storey: their bodies, where their flues rise, how high the bodies stand. */
export function deriveFireplaceScenes(
  storey: Storey,
  floor: Meters | undefined
): readonly FireplaceScene[] {
  return fireplacesOf(storey).map(fireplace => ({
    fireplace,
    footprint: fireplaceFootprint(fireplace),
    fluePosition: fluePosition(fireplace),
    topElevation: isNil(floor) ? undefined : floor + FIREPLACE_SPECS[fireplace.kind].heightMeters,
  }));
}

/**
 * Every shaft rises to the roof, so a storey shows its own and every one
 * started below it — which is also what says where its floor must be opened.
 */
export function deriveDuctSectionsByLevel(
  storeys: readonly Storey[],
  fireplaceScenesByLevel: readonly (readonly FireplaceScene[])[]
): readonly (readonly DuctSection[])[] {
  const ductsByLevel = storeys.map((storey, level) => [
    ...fireplaceScenesByLevel[level].map(scene => ({
      duct: flueOf(scene.fireplace, scene.fluePosition),
      fireplaceId: scene.fireplace.id,
    })),
    ...ductsOf(storey).map(duct => ({ duct, fireplaceId: undefined })),
  ]);

  return storeys.map((_, level) =>
    ductsByLevel.slice(0, level + 1).flatMap((ducts, startLevel) =>
      ducts.map(({ duct, fireplaceId }) => ({
        duct,
        fireplaceId,
        footprint: ductFootprint(duct),
        startsHere: startLevel === level,
      }))
    )
  );
}
