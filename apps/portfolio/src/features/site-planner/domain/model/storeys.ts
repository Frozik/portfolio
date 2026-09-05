import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Opaque } from '@frozik/utils/types/base';

import type { Meters } from '../units';
import type { VerticalDuct } from './ducts';
import { NO_DUCTS } from './ducts';
import type { CircuitGroup, ElectricalDevice, SwitchLink } from './electrical';
import type { Fireplace } from './fireplaces';
import { NO_FIREPLACES } from './fireplaces';
import type { FurnitureInstance } from './furniture';
import type { Opening } from './openings';
import type { RoomLabel } from './rooms';
import type { Slab } from './slabs';
import type { StairInstance } from './stairs';
import type { SupportPost } from './supports';
import type { Wall } from './walls';

export type StoreyId = Opaque<'StoreyId', string>;

/**
 * What an exposed stretch of ceiling is covered with (`building-editor.md`
 * §5, R2/R22): the plain membrane, a walkable terrace, or planting — the
 * green roof. The path-segment «покрытие» pattern lifted to areas.
 */
export type RoofCover = 'membrane' | 'terrace' | 'green';

/** Every cover, in the order the panel offers them. */
export const ROOF_COVERS: readonly RoofCover[] = ['membrane', 'terrace', 'green'];

/** The default an unlabelled stretch of exposed ceiling wears. */
export const DEFAULT_ROOF_COVER: RoofCover = 'membrane';

export type RoofZoneLabelId = Opaque<'RoofZoneLabelId', string>;

/**
 * The stored half of a roof zone: zones themselves derive from the exposed
 * ceiling — the part of a storey's footprint no storey stands on — so a cover
 * is pinned to a SEED POINT, the way a room's type is (`rooms.ts`).
 */
export interface RoofZoneLabel {
  readonly id: RoofZoneLabelId;
  readonly position: Vector2;
  readonly cover: RoofCover;
}

export function createRoofZoneLabel({
  position,
  cover,
}: {
  readonly position: Vector2;
  readonly cover: RoofCover;
}): RoofZoneLabel {
  return { id: crypto.randomUUID() as RoofZoneLabelId, position, cover };
}

/**
 * One storey of a building (`building-editor.md` §5): its own walls, openings
 * and room labels, stacked by list order — index 0 stands on the foundation.
 * The GROUND storey's footprint is the building's composition (the site
 * editor's domain); an upper storey's footprint DERIVES from its walls — the
 * closed loop they draw is the надстройка's outline, and whatever of the
 * storey below it leaves uncovered becomes exposed ceiling for roof zones.
 */
export interface Storey {
  readonly id: StoreyId;
  readonly heightMeters: Meters;
  readonly walls: readonly Wall[];
  readonly openings: readonly Opening[];
  readonly roomLabels: readonly RoomLabel[];
  readonly roofZoneLabels: readonly RoofZoneLabel[];
  /** Absent in storeys saved before furniture existed — read via {@link furnitureOf}. */
  readonly furniture?: readonly FurnitureInstance[];
  /** Absent in storeys saved before electrics existed — read via {@link devicesOf}. */
  readonly devices?: readonly ElectricalDevice[];
  /** The groups rooted at this storey's panels — read via {@link groupsOf}. */
  readonly groups?: readonly CircuitGroup[];
  /** Switch→light links — read via {@link switchLinksOf}. */
  readonly switchLinks?: readonly SwitchLink[];
  /** Stairs climbing toward the storey above — read via {@link stairsOf}. */
  readonly stairs?: readonly StairInstance[];
  /** Posts under overhangs and canopies — read via {@link supportsOf}. */
  readonly supports?: readonly SupportPost[];
  /** Fireplaces and stoves standing on this storey — read via {@link fireplacesOf}. */
  readonly fireplaces?: readonly Fireplace[];
  /** Flues and vent shafts starting on this storey — read via {@link ductsOf}. */
  readonly ducts?: readonly VerticalDuct[];
  /**
   * The floor slabs this storey stands on — its own outline. Absent in storeys
   * saved before slabs existed, where the outline still derives from the walls;
   * read via {@link slabsOf}.
   */
  readonly slabs?: readonly Slab[];
}

/** The storey's furniture, empty for storeys that predate the field. */
export function furnitureOf(storey: Storey): readonly FurnitureInstance[] {
  return storey.furniture ?? NO_FURNITURE;
}

/** The storey's electrical devices, empty for storeys that predate the field. */
export function devicesOf(storey: Storey): readonly ElectricalDevice[] {
  return storey.devices ?? NO_DEVICES;
}

/** The storey's circuit groups, empty for storeys that predate the field. */
export function groupsOf(storey: Storey): readonly CircuitGroup[] {
  return storey.groups ?? NO_GROUPS;
}

/** The storey's switch→light links, empty for storeys that predate the field. */
export function switchLinksOf(storey: Storey): readonly SwitchLink[] {
  return storey.switchLinks ?? NO_SWITCH_LINKS;
}

/** The storey's stairs, empty for storeys that predate the field. */
export function stairsOf(storey: Storey): readonly StairInstance[] {
  return storey.stairs ?? NO_STAIRS;
}

/** The storey's fireplaces, empty for storeys that predate the field. */
export function fireplacesOf(storey: Storey): readonly Fireplace[] {
  return storey.fireplaces ?? NO_FIREPLACES;
}

/** The shafts rising from this storey, empty for storeys that predate them. */
export function ductsOf(storey: Storey): readonly VerticalDuct[] {
  return storey.ducts ?? NO_DUCTS;
}

/** The storey's floor slabs, empty for storeys that predate the field. */
export function slabsOf(storey: Storey): readonly Slab[] {
  return storey.slabs ?? NO_SLABS;
}

/** The storey's support posts, empty for storeys that predate the field. */
export function supportsOf(storey: Storey): readonly SupportPost[] {
  return storey.supports ?? NO_SUPPORTS;
}

const NO_FURNITURE: readonly FurnitureInstance[] = [];
const NO_DEVICES: readonly ElectricalDevice[] = [];
const NO_GROUPS: readonly CircuitGroup[] = [];
const NO_SWITCH_LINKS: readonly SwitchLink[] = [];
const NO_STAIRS: readonly StairInstance[] = [];
const NO_SUPPORTS: readonly SupportPost[] = [];
const NO_SLABS: readonly Slab[] = [];

/** A typical residential upper storey; the ground one inherits `wallHeight`. */

function createStoreyId(): StoreyId {
  return crypto.randomUUID() as StoreyId;
}

export function createStorey({
  heightMeters,
  walls = [],
  openings = [],
  roomLabels = [],
  roofZoneLabels = [],
  furniture = [],
  slabs = [],
}: {
  readonly heightMeters: Meters;
  readonly walls?: readonly Wall[];
  readonly openings?: readonly Opening[];
  readonly roomLabels?: readonly RoomLabel[];
  readonly roofZoneLabels?: readonly RoofZoneLabel[];
  readonly furniture?: readonly FurnitureInstance[];
  readonly slabs?: readonly Slab[];
}): Storey {
  return {
    id: createStoreyId(),
    heightMeters,
    walls,
    openings,
    roomLabels,
    roofZoneLabels,
    furniture,
    slabs,
  };
}
