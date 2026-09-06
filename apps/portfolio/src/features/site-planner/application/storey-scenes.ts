import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import {
  interiorPointOf,
  isPointInMultiPolygon,
  subtractPolygons,
} from '../domain/geometry/polygon-booleans';
import type { MultiPolygon } from '../domain/geometry/polygon-types';
import { distanceToMultiPolygonEdge } from '../domain/geometry/segment-distance';
import { slabsOutline } from '../domain/geometry/slab-geometry';
import { floorToFloorMeters, SLAB_THICKNESS_METERS } from '../domain/geometry/storey-plates';
import type { DoorSwingGeometry } from '../domain/geometry/wall-geometry';
import {
  buildDoorSwing,
  buildOpeningBody,
  buildWallBodies,
  buildWallBody,
  buildWallHull,
} from '../domain/geometry/wall-geometry';
import { foundationOf, storeysOf } from '../domain/model/building';
import type { Building } from '../domain/model/building';
import type { DeviceId, DeviceKind } from '../domain/model/electrical';
import type { FurnitureInstance } from '../domain/model/furniture';
import type { OpeningId } from '../domain/model/openings';
import type { Slab } from '../domain/model/slabs';
import type { Storey } from '../domain/model/storeys';
import { devicesOf, furnitureOf, slabsOf } from '../domain/model/storeys';
import type { Meters } from '../domain/units';
import type { PlanWallBody } from './render/plan-draw/draw-wall-bodies';
import type { BuildingRoom, RoofZoneScene } from './room-scenes';
import { deriveRoofZones, deriveRooms } from './room-scenes';
import type { DuctSection, FireplaceScene } from './shaft-scenes';
import { deriveDuctSectionsByLevel, deriveFireplaceScenes } from './shaft-scenes';
import type { StairScene } from './stair-scenes';
import { deriveStairScenes } from './stair-scenes';
import type { SupportScene } from './support-scenes';
import { deriveSupportScenes } from './support-scenes';
import type { PlanWire } from './wire-scenes';
import { devicePlanPosition, deriveWires } from './wire-scenes';

/** One opening resolved for the plan: its cut body, named and kinded. */
interface PlanOpeningShape {
  readonly id: OpeningId;
  readonly kind: 'door' | 'window';
  readonly polygons: MultiPolygon;
  /** The leaf and its quarter sweep; nothing for a window. */
  readonly swing: DoorSwingGeometry | undefined;
}

/** One device resolved onto the plan, its symbol point placed. */
interface PlanDevice {
  readonly id: DeviceId;
  readonly kind: DeviceKind;
  readonly position: Vector2;
}

/** One storey resolved for drawing and stacking — see `buildingScenes`. */
export interface StoreyScene {
  readonly storey: Storey;
  readonly level: number;
  /**
   * What this storey stands on. The ground storey stands on the building's
   * composition; an upper one stands on its own SLABS, and only falls back to
   * the hull of its walls while it has none — which is how storeys drawn
   * before slabs existed keep their outline.
   */
  readonly footprint: MultiPolygon;
  /** This storey's own floor slabs, drawn and picked as objects. */
  readonly slabs: readonly Slab[];
  /** Bottom of this storey's walls; nothing while the building has no pad. */
  readonly baseElevation: Meters | undefined;
  readonly wallShapes: readonly PlanWallBody[];
  readonly wallBodies: MultiPolygon;
  readonly openingShapes: readonly PlanOpeningShape[];
  readonly rooms: readonly BuildingRoom[];
  /** This storey's exposed ceiling — what no storey above covers — zoned. */
  readonly roofZones: readonly RoofZoneScene[];
  readonly furniture: readonly FurnitureInstance[];
  readonly devices: readonly PlanDevice[];
  /** The wiring, derived: along the walls wherever they connect. */
  readonly wires: readonly PlanWire[];
  /** This storey's own stairs, with their derived steps and cutout. */
  readonly stairs: readonly StairScene[];
  /** The posts standing on this storey, each with both ends derived. */
  readonly supports: readonly SupportScene[];
  /** What this storey's OWN stairs open in the ceiling above them. */
  readonly ownStairCutouts: MultiPolygon;
  /** What the storey BELOW opens in this storey's floor — the stairwell. */
  readonly stairCutouts: MultiPolygon;
  /** The fireplaces and stoves standing on this storey (R34). */
  readonly fireplaces: readonly FireplaceScene[];
  /**
   * Every shaft crossing this storey — its own and every one rising from
   * below. A flue is a hole through the house, so the plan of an upper floor
   * has to show the chimney passing through it (R34/R35).
   */
  readonly ducts: readonly DuctSection[];
  /** What those shafts open in this storey's floor. */
  readonly ductCutouts: MultiPolygon;
  /** What they open in its ceiling — every shaft that starts at or below it. */
  readonly ownDuctCutouts: MultiPolygon;
}

/**
 * Where a region's seed label lands: the centroid while it actually lies in
 * the region, an interior fallback otherwise — an annular exposed ceiling
 * centres on its own hole.
 */
export function seedPointOf(
  polygons: MultiPolygon,
  centroid: Vector2 | undefined
): Vector2 | undefined {
  if (!isNil(centroid) && isPointInMultiPolygon(polygons, centroid)) {
    return centroid;
  }

  return interiorPointOf(polygons);
}

function storeyFootprint({
  level,
  groundFootprint,
  storey,
  wallBodies,
}: {
  readonly level: number;
  readonly groundFootprint: MultiPolygon;
  readonly storey: Storey;
  readonly wallBodies: MultiPolygon;
}): MultiPolygon {
  if (level === 0) {
    return groundFootprint;
  }

  const slabs = slabsOf(storey);

  return slabs.length === 0 ? buildWallHull(wallBodies) : slabsOutline(slabs);
}

const NO_STOREY_SCENES: readonly StoreyScene[] = [];

/**
 * Every storey resolved bottom-up: the ground
 * storey stands on the building's composition, an upper one on the hull its
 * own walls enclose — which is what makes a smaller second floor a надстройка
 * and leaves the rest of the floor below as exposed ceiling. Each storey's
 * exposed ceiling — what the storey above does not cover — is cut into roof
 * zones the way rooms are cut out of a floor.
 */
export function deriveStoreyScenes(
  building: Building,
  groundFootprint: MultiPolygon,
  padElevation: Meters | undefined,
  groundElevationAtPoint: (point: Vector2) => Meters
): readonly StoreyScene[] {
  const storeys = storeysOf(building);

  if (storeys.length === 0) {
    return NO_STOREY_SCENES;
  }

  // ±0.000 stands on the цоколь, not on the ground (plan O-S5): the pad is
  // where the earth is, the foundation carries the floor that much higher.
  // Every hosted height — window sills, socket heights, a stair's climb —
  // is measured from this datum, so getting it wrong shifts all of them.
  // The SLAB rests ON the foundation, so the finished floor is one slab
  // thickness above its top. Setting the floor AT the foundation top once put
  // the plate's top cap and the foundation's top cap in the same plane — two
  // visible coplanar faces, and with `cullMode: 'none'` the whole floor
  // shimmered with z-fighting moiré.
  const groundFloorElevation = isNil(padElevation)
    ? undefined
    : padElevation + foundationOf(building).heightAboveGroundMeters + SLAB_THICKNESS_METERS;

  const resolved: {
    readonly storey: Storey;
    readonly footprint: MultiPolygon;
    readonly wallBodies: MultiPolygon;
  }[] = storeys.map((storey, level) => {
    const wallBodies = buildWallBodies(storey.walls);

    return {
      storey,
      wallBodies,
      footprint: storeyFootprint({ level, groundFootprint, storey, wallBodies }),
    };
  });

  let baseElevation = groundFloorElevation;

  let floorElevation = groundFloorElevation;
  const floorElevationByLevel = resolved.map(({ storey }) => {
    const own = floorElevation;

    if (!isNil(floorElevation)) {
      floorElevation += floorToFloorMeters(storey.heightMeters);
    }

    return own;
  });

  const fireplaceScenesByLevel = resolved.map(({ storey }, level) =>
    deriveFireplaceScenes(storey, floorElevationByLevel[level])
  );
  const ductSectionsByLevel = deriveDuctSectionsByLevel(storeys, fireplaceScenesByLevel);

  const stairScenesByLevel = resolved.map(({ storey, footprint }, level) =>
    deriveStairScenes(storey, footprint, floorElevationByLevel[level], groundElevationAtPoint)
  );

  return resolved.map(({ storey, footprint, wallBodies }, level) => {
    const storeyBase = baseElevation;
    const stairScenes = stairScenesByLevel[level];
    const belowStairCutouts = (stairScenesByLevel[level - 1] ?? []).flatMap(
      stairScene => stairScene.cutout
    );

    if (!isNil(baseElevation)) {
      // Floor to floor, not clear height (O-A4): the slab above this storey
      // is part of the climb to the next one.
      baseElevation += floorToFloorMeters(storey.heightMeters);
    }

    const above = resolved[level + 1]?.footprint ?? [];
    const exposed = subtractPolygons(footprint, above);

    return {
      storey,
      level,
      footprint,
      slabs: slabsOf(storey),
      baseElevation: storeyBase,
      wallShapes: storey.walls.map(wall => ({
        id: wall.id,
        material: wall.material,
        polygons: buildWallBody(wall),
      })),
      wallBodies,
      openingShapes: storey.openings.flatMap(opening => {
        const wall = storey.walls.find(candidate => candidate.id === opening.wallId);

        return isNil(wall)
          ? []
          : [
              {
                id: opening.id,
                kind: opening.kind,
                polygons: buildOpeningBody(wall, opening),
                swing: buildDoorSwing(wall, opening),
              },
            ];
      }),
      rooms: deriveRooms(storey, footprint, wallBodies),
      stairs: stairScenes,
      supports: deriveSupportScenes(
        storey,
        footprint,
        floorElevationByLevel[level],
        groundElevationAtPoint
      ),
      fireplaces: fireplaceScenesByLevel[level],
      ducts: ductSectionsByLevel[level],
      ductCutouts: ductSectionsByLevel[level]
        .filter(section => !section.startsHere)
        .map(section => section.footprint),
      ownDuctCutouts: ductSectionsByLevel[level].map(section => section.footprint),
      ownStairCutouts: stairScenes.flatMap(stairScene => stairScene.cutout),
      stairCutouts: belowStairCutouts,
      roofZones: deriveRoofZones(storey, exposed),
      furniture: furnitureOf(storey),
      devices: devicesOf(storey).flatMap(device => {
        const position = devicePlanPosition(storey, device);

        return isNil(position) ? [] : [{ id: device.id, kind: device.kind, position }];
      }),
      wires: deriveWires(storey),
    };
  });
}

/**
 * How far the overhanging strip reaches past the storey below: the furthest
 * any of its corners lies from that footprint. It is the number the advisory
 * quotes, so it has to be the worst case rather than an average.
 */
export function maxOverhangMeters(overhang: MultiPolygon, footprintBelow: MultiPolygon): Meters {
  let furthest = 0;

  for (const polygon of overhang) {
    for (const point of polygon.outer) {
      if (isPointInMultiPolygon(footprintBelow, point)) {
        continue;
      }

      furthest = Math.max(furthest, distanceToMultiPolygonEdge(footprintBelow, point));
    }
  }

  return furthest;
}
