import type { Vector2 } from '@frozik/utils/math/vector2';

import { isNil } from 'lodash-es';

import {
  interiorPointOf,
  intersectPolygons,
  isPointInMultiPolygon,
} from '../geometry/polygon-booleans';
import type { MultiPolygon } from '../geometry/polygon-types';
import type { Meters } from '../units';
import type { DuctId } from './ducts';
import type { FurnitureId } from './furniture';
import { MIN_SHEDDING_PITCH_DEGREES } from './roofs';
import type { RoomTypeId } from './rooms';
import { isWetRoomType } from './rooms';
import type { StairId } from './stairs';
import type { StoreyId } from './storeys';
import type { WallId } from './walls';

/**
 * How far an upper storey may reach past the one below before the editor asks
 * for a post under it. The prescriptive limit for ordinary framing is about
 * 0.6 m; past 1.5 m nothing bears without an engineer, so the advisory says so
 * in different words rather than staying the same shade of amber.
 */
const CANTILEVER_ADVISORY_METERS: Meters = 0.6;
const CANTILEVER_ENGINEERED_METERS: Meters = 1.5;

/** Below this a storey is not habitable — СП 55.13330 for a living room. */
const MIN_HABITABLE_STOREY_HEIGHT_METERS: Meters = 2.2;

/**
 * One advisory finding about a building. Advisory by design, like the trench
 * norms: the editor names the rule it would have
 * followed and highlights what it is about — the plan stays the user's.
 *
 * Every finding carries the storey it belongs to and a point to travel to, so
 * the panel can be a list of places rather than a list of complaints.
 */
export type BuildingWarning = {
  readonly storeyId: StoreyId;
  readonly at: Vector2;
} & (
  | { readonly kind: 'furniture-over-stairwell'; readonly furnitureId: FurnitureId }
  | { readonly kind: 'wall-over-stairwell'; readonly wallId: WallId }
  | { readonly kind: 'stair-uncomfortable'; readonly stairId: StairId }
  | {
      readonly kind: 'cantilever-unsupported';
      readonly overhangMeters: Meters;
      /** Past the engineered limit no ordinary structure carries it at all. */
      readonly needsEngineering: boolean;
    }
  | { readonly kind: 'storey-too-low'; readonly heightMeters: Meters }
  | { readonly kind: 'roof-too-flat'; readonly pitchDegrees: number }
  | { readonly kind: 'room-without-exhaust'; readonly roomTypeId: RoomTypeId }
  | { readonly kind: 'sauna-without-stove' }
  | { readonly kind: 'duct-outside-roof'; readonly ductId: DuctId }
);

/** What one storey contributes to the pass, already derived by the scenes. */
export interface StoreyWarningInput {
  readonly storeyId: StoreyId;
  readonly heightMeters: Meters;
  readonly footprint: MultiPolygon;
  /** The opening the storey BELOW leaves in this storey's floor. */
  readonly stairwell: MultiPolygon;
  readonly furniture: readonly { readonly id: FurnitureId; readonly position: Vector2 }[];
  readonly walls: readonly { readonly id: WallId; readonly body: MultiPolygon }[];
  readonly stairs: readonly {
    readonly id: StairId;
    readonly position: Vector2;
    readonly isComfortable: boolean;
  }[];
  /** Posts standing on this storey — what holds an overhang up. */
  readonly supportPositions: readonly Vector2[];
  /** The storey below's footprint; nothing for the ground storey. */
  readonly footprintBelow: MultiPolygon | undefined;
  /** The strip reaching past the storey below — what a post has to stand in. */
  readonly overhang: MultiPolygon;
  /** How far this storey reaches past the one below, at its worst point. */
  readonly overhangMeters: Meters;
  /** Where that worst overhang is, for the panel to travel to. */
  readonly overhangAt: Vector2 | undefined;
  /** The pitched roof standing on THIS storey, if any is (R33). */
  readonly roofPitchDegrees: number | undefined;
  /** The rooms the walls enclose, with what each of them is for. */
  readonly rooms: readonly {
    readonly roomTypeId: RoomTypeId | undefined;
    readonly polygons: MultiPolygon;
    readonly at: Vector2 | undefined;
  }[];
  /** Where the ventilation shafts crossing this storey stand (R35). */
  readonly ventPositions: readonly Vector2[];
  /** Where the sauna stoves of this storey stand — what heats a sauna (R34). */
  readonly saunaStovePositions: readonly Vector2[];
  /** Shafts of this storey that miss the roof entirely — they exit nowhere. */
  readonly strandedDucts: readonly { readonly id: DuctId; readonly at: Vector2 }[];
}

/**
 * Every advisory a building earns. The findings are deliberately of one type:
 * a stair too steep, a wardrobe over a stairwell and an unsupported overhang
 * are all «something to look at here», and one list the user can walk beats
 * three highlights they have to discover.
 */
export function collectBuildingWarnings(
  storeys: readonly StoreyWarningInput[]
): readonly BuildingWarning[] {
  return storeys.flatMap(storey => [
    ...furnitureOverStairwell(storey),
    ...wallsOverStairwell(storey),
    ...uncomfortableStairs(storey),
    ...unsupportedCantilever(storey),
    ...lowStorey(storey),
    ...flatRoof(storey),
    ...roomsWithoutExhaust(storey),
    ...saunasWithoutStove(storey),
    ...strandedDucts(storey),
  ]);
}

/**
 * A room that has to breathe and has nothing to breathe through. A kitchen, a
 * bathroom, a boiler room and — most of all — a sauna are ventilated through a
 * shaft of their own (СП 60.13330 §7.1, СП 55.13330 §8.9); a sauna's must not
 * be shared with anything else, which is why the check is «a shaft INSIDE this
 * room» rather than «a shaft somewhere on this storey».
 */
function roomsWithoutExhaust(storey: StoreyWarningInput): readonly BuildingWarning[] {
  return storey.rooms.flatMap(room => {
    const { roomTypeId, at } = room;

    if (isNil(roomTypeId) || isNil(at) || !isWetRoomType(roomTypeId)) {
      return [];
    }

    const isVentilated = storey.ventPositions.some(position =>
      isPointInMultiPolygon(room.polygons, position)
    );

    return isVentilated
      ? []
      : [{ kind: 'room-without-exhaust' as const, storeyId: storey.storeyId, at, roomTypeId }];
  });
}

/**
 * A sauna with no stove in it. It is the one room that IS its heat source: a
 * sauna room without a печь is a small panelled room, and saying so early is
 * cheaper than discovering it when the electrics are already drawn.
 */
function saunasWithoutStove(storey: StoreyWarningInput): readonly BuildingWarning[] {
  return storey.rooms.flatMap(room => {
    if (room.roomTypeId !== 'sauna' || isNil(room.at)) {
      return [];
    }

    const isHeated = storey.saunaStovePositions.some(position =>
      isPointInMultiPolygon(room.polygons, position)
    );

    return isHeated
      ? []
      : [{ kind: 'sauna-without-stove' as const, storeyId: storey.storeyId, at: room.at }];
  });
}

/** A shaft that misses the roof comes out of nothing — it exits into the air. */
function strandedDucts(storey: StoreyWarningInput): readonly BuildingWarning[] {
  return storey.strandedDucts.map(duct => ({
    kind: 'duct-outside-roof' as const,
    storeyId: storey.storeyId,
    at: duct.at,
    ductId: duct.id,
  }));
}

/**
 * A roof too flat to shed. Below about 14° snow sits on the slope instead of
 * sliding off it and most coverings are not rated for the water that then
 * creeps back up under them (SP 17.13330) — so a shallow roof is a decision
 * to be made deliberately rather than by leaving the field where it landed.
 */
function flatRoof(storey: StoreyWarningInput): readonly BuildingWarning[] {
  const { roofPitchDegrees } = storey;

  if (isNil(roofPitchDegrees) || roofPitchDegrees >= MIN_SHEDDING_PITCH_DEGREES) {
    return [];
  }

  const at = interiorPointOf(storey.footprint);

  return isNil(at)
    ? []
    : [
        {
          kind: 'roof-too-flat' as const,
          storeyId: storey.storeyId,
          at,
          pitchDegrees: roofPitchDegrees,
        },
      ];
}

/**
 * A piece standing over the opening the stair below leaves. Nothing holds it:
 * in 2D the hole reads as empty floor and the piece looks placed, in 3D it
 * hangs in the air — the commonest mistake people make furnishing an upper
 * floor in every reference planner.
 */
function furnitureOverStairwell(storey: StoreyWarningInput): readonly BuildingWarning[] {
  if (storey.stairwell.length === 0) {
    return [];
  }

  return storey.furniture
    .filter(piece => isPointInMultiPolygon(storey.stairwell, piece.position))
    .map(piece => ({
      kind: 'furniture-over-stairwell' as const,
      storeyId: storey.storeyId,
      at: piece.position,
      furnitureId: piece.id,
    }));
}

/** A wall drawn across the stairwell has nothing under it either. */
function wallsOverStairwell(storey: StoreyWarningInput): readonly BuildingWarning[] {
  if (storey.stairwell.length === 0) {
    return [];
  }

  return storey.walls
    .filter(wall => intersectPolygons(wall.body, storey.stairwell).length > 0)
    .flatMap(wall => {
      const overlap = intersectPolygons(wall.body, storey.stairwell);
      const at = overlap[0]?.outer[0];

      return at === undefined
        ? []
        : [
            {
              kind: 'wall-over-stairwell' as const,
              storeyId: storey.storeyId,
              at,
              wallId: wall.id,
            },
          ];
    });
}

function uncomfortableStairs(storey: StoreyWarningInput): readonly BuildingWarning[] {
  return storey.stairs
    .filter(stair => !stair.isComfortable)
    .map(stair => ({
      kind: 'stair-uncomfortable' as const,
      storeyId: storey.storeyId,
      at: stair.position,
      stairId: stair.id,
    }));
}

/**
 * An overhang reaching past what ordinary construction carries, with no post
 * under it. A post standing IN the overhanging strip clears the finding — the
 * editor is not a structural calculator and does not pretend to be one, but a
 * post thirty metres away in the garden holds nothing, and testing merely for
 * «outside the storey below» would have accepted exactly that.
 */
function unsupportedCantilever(storey: StoreyWarningInput): readonly BuildingWarning[] {
  const { footprintBelow, overhang, overhangMeters, overhangAt } = storey;

  if (
    footprintBelow === undefined ||
    overhangMeters <= CANTILEVER_ADVISORY_METERS ||
    overhangAt === undefined
  ) {
    return [];
  }

  const isHeld = storey.supportPositions.some(position =>
    isPointInMultiPolygon(overhang, position)
  );

  return isHeld
    ? []
    : [
        {
          kind: 'cantilever-unsupported' as const,
          storeyId: storey.storeyId,
          at: overhangAt,
          overhangMeters,
          needsEngineering: overhangMeters > CANTILEVER_ENGINEERED_METERS,
        },
      ];
}

function lowStorey(storey: StoreyWarningInput): readonly BuildingWarning[] {
  if (storey.heightMeters >= MIN_HABITABLE_STOREY_HEIGHT_METERS) {
    return [];
  }

  const at = storey.footprint[0]?.outer[0];

  return at === undefined
    ? []
    : [
        {
          kind: 'storey-too-low' as const,
          storeyId: storey.storeyId,
          at,
          heightMeters: storey.heightMeters,
        },
      ];
}
