import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Opaque } from '@frozik/utils/types/base';

import type { Meters } from '../units';

export type DuctId = Opaque<'DuctId', string>;

export function createDuctId(): DuctId {
  return crypto.randomUUID() as DuctId;
}

/**
 * What rises through a house vertically (`building-editor.md` §9, R34/R35): a
 * flue carrying smoke away from a fireplace, or a ventilation shaft carrying
 * stale air out of a room. They are one object because they are one problem —
 * a shaft that starts on a storey, passes through every storey above it and
 * has to come out above the roof — and because a house's плита перекрытия must
 * be opened for both of them in exactly the same way.
 */
export type DuctKind = 'flue' | 'vent';

export const DUCT_KINDS: readonly DuctKind[] = ['flue', 'vent'];

export function parseDuctKind(value: string): DuctKind | undefined {
  return DUCT_KINDS.find(kind => kind === value);
}

/**
 * A vertical shaft, standing on the storey it is placed on. Only its plan
 * position and section are stored: where it stops is DERIVED from the roof
 * above it, so raising a storey or steepening the roof takes the shaft with it.
 */
export interface VerticalDuct {
  readonly id: DuctId;
  readonly kind: DuctKind;
  readonly position: Vector2;
  /** Section across the plan's east, before rotation. */
  readonly widthMeters: Meters;
  readonly depthMeters: Meters;
  readonly rotationDegrees: number;
}

/**
 * The section of a brick flue for a domestic fireplace — a 140 × 270 mm channel
 * inside half-brick walls (СП 7.13130 asks for at least 0.016 m² of free area).
 */
export const DEFAULT_FLUE_WIDTH_METERS: Meters = 0.51;
export const DEFAULT_FLUE_DEPTH_METERS: Meters = 0.38;

/** A ventilation shaft of two 140 × 140 channels in a plastered block. */
export const DEFAULT_VENT_WIDTH_METERS: Meters = 0.4;
export const DEFAULT_VENT_DEPTH_METERS: Meters = 0.25;

/**
 * How far a shaft must stand above the roof around it — СП 7.13130 §5.10: half
 * a metre above a ridge it stands within 1.5 m of, no lower than the ridge out
 * to 3 m, and never less than half a metre of the surface it comes out of.
 */
export const DUCT_ABOVE_ROOF_METERS: Meters = 0.5;
export const DUCT_RIDGE_REACH_METERS: Meters = 1.5;
export const DUCT_RIDGE_LEVEL_REACH_METERS: Meters = 3;

export function createDuct({
  kind,
  position,
  rotationDegrees = 0,
}: {
  readonly kind: DuctKind;
  readonly position: Vector2;
  readonly rotationDegrees?: number;
}): VerticalDuct {
  return {
    id: createDuctId(),
    kind,
    position,
    widthMeters: kind === 'flue' ? DEFAULT_FLUE_WIDTH_METERS : DEFAULT_VENT_WIDTH_METERS,
    depthMeters: kind === 'flue' ? DEFAULT_FLUE_DEPTH_METERS : DEFAULT_VENT_DEPTH_METERS,
    rotationDegrees,
  };
}

/** The shared empty list, so a storey with no shafts reads as one value. */
export const NO_DUCTS: readonly VerticalDuct[] = [];
