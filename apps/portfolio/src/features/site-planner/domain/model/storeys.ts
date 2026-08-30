import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Opaque } from '@frozik/utils/types/base';

import type { Meters } from '../units';
import type { CircuitGroup, ElectricalDevice, SwitchLink } from './electrical';
import type { FurnitureInstance } from './furniture';
import type { Opening } from './openings';
import type { RoomLabel } from './rooms';
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

export function parseRoofCover(value: string): RoofCover | undefined {
  return ROOF_COVERS.find(cover => cover === value);
}

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

const NO_FURNITURE: readonly FurnitureInstance[] = [];
const NO_DEVICES: readonly ElectricalDevice[] = [];
const NO_GROUPS: readonly CircuitGroup[] = [];
const NO_SWITCH_LINKS: readonly SwitchLink[] = [];

/** A typical residential upper storey; the ground one inherits `wallHeight`. */
export const DEFAULT_UPPER_STOREY_HEIGHT_METERS: Meters = 2.7;

export function createStoreyId(): StoreyId {
  return crypto.randomUUID() as StoreyId;
}

export function createStorey({
  heightMeters,
  walls = [],
  openings = [],
  roomLabels = [],
  roofZoneLabels = [],
  furniture = [],
}: {
  readonly heightMeters: Meters;
  readonly walls?: readonly Wall[];
  readonly openings?: readonly Opening[];
  readonly roomLabels?: readonly RoomLabel[];
  readonly roofZoneLabels?: readonly RoofZoneLabel[];
  readonly furniture?: readonly FurnitureInstance[];
}): Storey {
  return {
    id: createStoreyId(),
    heightMeters,
    walls,
    openings,
    roomLabels,
    roofZoneLabels,
    furniture,
  };
}
