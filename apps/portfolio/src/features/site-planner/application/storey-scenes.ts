import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { multiPolygonArea } from '../domain/geometry/building-outline';
import { ductFootprint, fireplaceFootprint, fluePosition } from '../domain/geometry/duct-geometry';
import { extrudePrism } from '../domain/geometry/extrude-footprint';
import type { LitMesh } from '../domain/geometry/lit-mesh';
import {
  interiorPointOf,
  isPointInMultiPolygon,
  subtractPolygons,
} from '../domain/geometry/polygon-booleans';
import { computeMultiPolygonCentroid } from '../domain/geometry/polygon-centroid';
import type { MultiPolygon, PolygonWithHoles } from '../domain/geometry/polygon-types';
import { distanceToMultiPolygonEdge } from '../domain/geometry/segment-distance';
import { slabsOutline } from '../domain/geometry/slab-geometry';
import type { StairRun } from '../domain/geometry/stair-footprint';
import {
  deriveStairRun,
  isStairRunComfortable,
  stairCutout,
  stairExitPoint,
  stairFootprint,
  stairRotationGrip,
} from '../domain/geometry/stair-footprint';
import type { StairStep } from '../domain/geometry/stair-mesh';
import { stairStepPolygons, supportFootprint } from '../domain/geometry/stair-mesh';
import { floorToFloorMeters, SLAB_THICKNESS_METERS } from '../domain/geometry/storey-plates';
import { supportSpan } from '../domain/geometry/support-span';
import type { DoorSwingGeometry } from '../domain/geometry/wall-geometry';
import {
  buildDoorSwing,
  buildOpeningBody,
  buildWallBodies,
  buildWallBody,
  buildWallHull,
  pointAlongPolyline,
  wallCenterline,
} from '../domain/geometry/wall-geometry';
import type { WireAnchor } from '../domain/geometry/wire-routing';
import { routeWire } from '../domain/geometry/wire-routing';
import type { VerticalDuct } from '../domain/model/ducts';
import type { DeviceId, DeviceKind, ElectricalDevice } from '../domain/model/electrical';
import type { Fireplace, FireplaceId } from '../domain/model/fireplaces';
import { FIREPLACE_SPECS, flueOf } from '../domain/model/fireplaces';
import type { FurnitureInstance } from '../domain/model/furniture';
import type { OpeningId } from '../domain/model/openings';
import type { RoomLabelId, RoomTypeId } from '../domain/model/rooms';
import { isWetRoomType } from '../domain/model/rooms';
import type { Building } from '../domain/model/site-plan';
import { foundationOf, storeysOf } from '../domain/model/site-plan';
import type { Slab } from '../domain/model/slabs';
import type { StairInstance } from '../domain/model/stairs';
import type { RoofCover, RoofZoneLabelId, Storey, StoreyId } from '../domain/model/storeys';
import {
  DEFAULT_ROOF_COVER,
  devicesOf,
  ductsOf,
  fireplacesOf,
  furnitureOf,
  groupsOf,
  slabsOf,
  stairsOf,
  supportsOf,
  switchLinksOf,
} from '../domain/model/storeys';
import type { SupportPost } from '../domain/model/supports';
import type { Meters } from '../domain/units';
import type { PlanWallBody } from './render/plan-draw/draw-walls';

/**
 * The shortest climb an external stair is modelled with. A porch onto a floor
 * barely above grade is still a step, and a zero rise would divide by nothing.
 */
const MIN_EXTERNAL_STAIR_RISE_METERS: Meters = 0.15;

/**
 * How far past its exit a stair's turn grip stands. In metres rather than in
 * pixels because the grip belongs to the scene: the plan draws it and the
 * pointer tests against it, and those two must not drift apart.
 */
const STAIR_ROTATION_GRIP_METERS: Meters = 0.8;

/**
 * Everything one building's storeys resolve into for drawing: the plan bodies,
 * the derived rooms and roof zones, the stairs with their runs and stairwells,
 * the posts with both ends worked out.
 *
 * This is deliberately NOT part of the store. It is a pure function of a
 * `Building`, its ground footprint and the graded ground under it — which is
 * what lets it be read, tested and extended without a MobX instance, and what
 * keeps the store to what a store is for: state and the commands that change
 * it.
 */
/** One opening resolved for the plan: its cut body, named and kinded. */
interface PlanOpeningShape {
  readonly id: OpeningId;
  readonly kind: 'door' | 'window';
  readonly polygons: MultiPolygon;
  /** The leaf and its quarter sweep; nothing for a window. */
  readonly swing: DoorSwingGeometry | undefined;
}

/** One derived room: a region the walls enclose, with its assigned type. */
export interface BuildingRoom {
  readonly storeyId: StoreyId;
  readonly polygons: MultiPolygon;
  readonly areaSquareMeters: number;
  readonly centroid: Vector2 | undefined;
  readonly roomTypeId: RoomTypeId | undefined;
  readonly labelId: RoomLabelId | undefined;
  readonly isWet: boolean;
}

/** One region of a storey's exposed ceiling, with the cover pinned to it. */
export interface RoofZoneScene {
  readonly storeyId: StoreyId;
  readonly polygons: MultiPolygon;
  readonly cover: RoofCover;
  readonly areaSquareMeters: number;
  readonly centroid: Vector2 | undefined;
  readonly labelId: RoofZoneLabelId | undefined;
}

/** One device resolved onto the plan, its symbol point placed. */
interface PlanDevice {
  readonly id: DeviceId;
  readonly kind: DeviceKind;
  readonly position: Vector2;
}

/** One derived wire run, panel→consumer or switch→light. */
interface PlanWire {
  readonly points: readonly Vector2[];
  /** A switch→light link draws dashed; a circuit run draws solid. */
  readonly isSwitchLink: boolean;
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
  /** The wiring, derived per §8: along the walls wherever they connect. */
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

/** One fireplace resolved for drawing: its body, and where its flue rises. */
interface FireplaceScene {
  readonly fireplace: Fireplace;
  readonly footprint: PolygonWithHoles;
  readonly fluePosition: Vector2;
  /** Where the top of its body stands; nothing while the building has no pad. */
  readonly topElevation: Meters | undefined;
}

/** One shaft as it crosses one storey. */
interface DuctSection {
  readonly duct: VerticalDuct;
  readonly footprint: PolygonWithHoles;
  /** Whether it starts on this storey rather than passing through it. */
  readonly startsHere: boolean;
  /** The fireplace it serves, when it is a derived flue rather than a placed shaft. */
  readonly fireplaceId: FireplaceId | undefined;
}

/** One post resolved for drawing: its section, and what it actually spans. */
interface SupportScene {
  readonly post: SupportPost;
  readonly footprint: PolygonWithHoles;
  readonly baseElevation: Meters | undefined;
  readonly topElevation: Meters | undefined;
  /** A post outside the storey's footprint carries an overhang or a canopy. */
  readonly isFreeStanding: boolean;
}

/** One stair resolved for drawing: its run, its steps and where it tops out. */
export interface StairScene {
  readonly stair: StairInstance;
  readonly run: StairRun;
  readonly steps: readonly StairStep[];
  readonly footprint: MultiPolygon;
  readonly exitPoint: Vector2;
  /** Whether the derived run is comfortable underfoot — the §6.5 advisory. */
  readonly isComfortable: boolean;
  /** Where the turn grip sits: drawn on the plan and hit-tested by the same value. */
  readonly rotationGrip: Vector2;
  /** What it opens in the ceiling above it — the derived stairwell. */
  readonly cutout: MultiPolygon;
  /** A porch: it stands outside the storey and climbs from the ground. */
  readonly isExternal: boolean;
  /** What the steps stand on: the storey floor, or the ground for a porch. */
  readonly baseElevation: Meters | undefined;
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

const NO_ROOMS: readonly BuildingRoom[] = [];
const NO_STOREY_SCENES: readonly StoreyScene[] = [];

/**
 * Every storey resolved bottom-up (`building-editor.md` §5): the ground
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
    fireplacesOf(storey).map(fireplace => {
      const floor = floorElevationByLevel[level];

      return {
        fireplace,
        footprint: fireplaceFootprint(fireplace),
        fluePosition: fluePosition(fireplace),
        topElevation: isNil(floor)
          ? undefined
          : floor + FIREPLACE_SPECS[fireplace.kind].heightMeters,
      };
    })
  );

  // Every shaft rises to the roof, so a storey shows its own and every one
  // started below it — which is also what says where its floor must be opened.
  const ductsByLevel = resolved.map(({ storey }, level) => [
    ...fireplaceScenesByLevel[level].map(scene => ({
      duct: flueOf(scene.fireplace, scene.fluePosition),
      fireplaceId: scene.fireplace.id,
    })),
    ...ductsOf(storey).map(duct => ({ duct, fireplaceId: undefined })),
  ]);
  const ductSectionsByLevel: readonly (readonly DuctSection[])[] = resolved.map((_, level) =>
    ductsByLevel.slice(0, level + 1).flatMap((ducts, startLevel) =>
      ducts.map(({ duct, fireplaceId }) => ({
        duct,
        fireplaceId,
        footprint: ductFootprint(duct),
        startsHere: startLevel === level,
      }))
    )
  );

  const stairScenesByLevel = resolved.map(({ storey, footprint }, level) =>
    stairsOf(storey).map(stair => {
      // A stair standing OUTSIDE its storey's footprint is an external one —
      // the porch every house with a цоколь needs, and the reason a front door
      // otherwise opens onto a drop. Its climb is the real one: from the
      // ground under it up to the floor it serves.
      const ownFloor = floorElevationByLevel[level];
      const isExternal = !isPointInMultiPolygon(footprint, stair.position);
      const climb =
        isExternal && !isNil(ownFloor)
          ? Math.max(
              MIN_EXTERNAL_STAIR_RISE_METERS,
              ownFloor - groundElevationAtPoint(stair.position)
            )
          : floorToFloorMeters(storey.heightMeters);
      const steps = stairStepPolygons(stair, climb);

      return {
        stair,
        run: deriveStairRun(climb),
        steps,
        footprint: stairFootprint(stair, climb),
        exitPoint: stairExitPoint(stair, climb),
        rotationGrip: stairRotationGrip(
          stair,
          stairExitPoint(stair, climb),
          STAIR_ROTATION_GRIP_METERS
        ),
        isComfortable: isStairRunComfortable(deriveStairRun(climb), stair),
        // An external stair pierces nothing: it climbs to the floor, not
        // through it.
        cutout: isExternal ? [] : stairCutout(stair, climb, { steps }),
        isExternal,
        baseElevation: isExternal && !isNil(ownFloor) ? ownFloor - climb : ownFloor,
      };
    })
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
      supports: supportsOf(storey).map(post => {
        const floor = floorElevationByLevel[level];
        const ceiling = isNil(floor) ? undefined : floor + storey.heightMeters;
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
      }),
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

/** Every post of a storey as a solid between its two derived ends. */
export function buildSupportSolids(storeyScene: StoreyScene): readonly LitMesh[] {
  return storeyScene.supports.flatMap(supportScene =>
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

/** Where a device's symbol stands on the plan, its wall host resolved. */
function devicePlanPosition(storey: Storey, device: ElectricalDevice): Vector2 | undefined {
  const { host } = device;

  if (host.kind === 'ceiling') {
    return host.position;
  }

  const wall = storey.walls.find(candidate => candidate.id === host.wallId);

  if (isNil(wall)) {
    return undefined;
  }

  return pointAlongPolyline(wallCenterline(wall), host.offsetMeters);
}

/** An anchor for the wire router: the wall host, or the resolved free point. */
function deviceAnchor(device: ElectricalDevice): WireAnchor | undefined {
  if (device.host.kind === 'wall') {
    return {
      kind: 'wall',
      wallId: device.host.wallId,
      offsetMeters: device.host.offsetMeters,
    };
  }

  return { kind: 'point', position: device.host.position };
}

/**
 * The wiring the circuits imply (`building-editor.md` §7/§8): one run from
 * the panel to every consumer of its группа, walked along the walls, and a
 * dashed link from every switch to the light it commands.
 */
function deriveWires(storey: Storey): readonly PlanWire[] {
  const devices = devicesOf(storey);
  const byId = new Map(devices.map(device => [device.id, device]));
  const wires: PlanWire[] = [];
  const routeBetween = (fromId: DeviceId, toId: DeviceId): readonly Vector2[] | undefined => {
    const from = byId.get(fromId);
    const to = byId.get(toId);

    if (isNil(from) || isNil(to)) {
      return undefined;
    }

    const fromAnchor = deviceAnchor(from);
    const toAnchor = deviceAnchor(to);

    if (isNil(fromAnchor) || isNil(toAnchor)) {
      return undefined;
    }

    const points = routeWire(storey.walls, fromAnchor, toAnchor);

    return points.length > 1 ? points : undefined;
  };

  for (const group of groupsOf(storey)) {
    for (const deviceId of group.deviceIds) {
      const points = routeBetween(group.panelId, deviceId);

      if (!isNil(points)) {
        wires.push({ points, isSwitchLink: false });
      }
    }
  }

  for (const link of switchLinksOf(storey)) {
    const points = routeBetween(link.switchId, link.lightId);

    if (!isNil(points)) {
      wires.push({ points, isSwitchLink: true });
    }
  }

  return wires;
}

/**
 * The rooms the walls cut the footprint into: footprint minus wall bodies,
 * each remaining region one room, its type looked up by which region holds a
 * stored label's seed point.
 */
function deriveRooms(
  storey: Storey,
  footprint: MultiPolygon,
  wallBodies: MultiPolygon
): readonly BuildingRoom[] {
  if (wallBodies.length === 0 || footprint.length === 0) {
    return NO_ROOMS;
  }

  const cut = subtractPolygons(footprint, wallBodies);
  // A room is what the walls ENCLOSE. A footprint slightly wider than the
  // wall ring leaves a hairline frame between the walls and the slab's edge —
  // real leftover concrete, but no room — so regions outside the wall hull
  // are dropped, UNLESS a stored label claims one: a veranda is exactly a
  // deliberate floor outside the walls, and planting its label is how the
  // planner says this leftover is a place, not concrete. Until any enclosure
  // exists (partitions running edge to edge, the pre-ring way of drawing),
  // the footprint boundary stands in for the exterior walls and every cut
  // region counts.
  const hull = buildWallHull(wallBodies);
  const enclosed = new Set(
    cut.filter(region => {
      const probe = interiorPointOf([region]);

      return !isNil(probe) && isPointInMultiPolygon(hull, probe);
    })
  );
  const regions =
    enclosed.size > 0
      ? cut.filter(
          region =>
            enclosed.has(region) ||
            storey.roomLabels.some(candidate => isPointInMultiPolygon([region], candidate.position))
        )
      : cut;

  return regions.map(region => {
    const polygons = [region];
    const label = storey.roomLabels.find(candidate =>
      isPointInMultiPolygon(polygons, candidate.position)
    );

    return {
      storeyId: storey.id,
      polygons,
      areaSquareMeters: multiPolygonArea(polygons),
      centroid: computeMultiPolygonCentroid(polygons),
      roomTypeId: label?.roomTypeId,
      labelId: label?.id,
      isWet: isNil(label) ? false : isWetRoomType(label.roomTypeId),
    };
  });
}

/** The roof-zone counterpart of {@link deriveRooms}, over the exposed ceiling. */
function deriveRoofZones(storey: Storey, exposed: MultiPolygon): readonly RoofZoneScene[] {
  return exposed.map(region => {
    const polygons = [region];
    const label = storey.roofZoneLabels.find(candidate =>
      isPointInMultiPolygon(polygons, candidate.position)
    );

    return {
      storeyId: storey.id,
      polygons,
      cover: label?.cover ?? DEFAULT_ROOF_COVER,
      areaSquareMeters: multiPolygonArea(polygons),
      centroid: computeMultiPolygonCentroid(polygons),
      labelId: label?.id,
    };
  });
}

/** Drops points that repeat the one before them, wherever the repetition came from. */
