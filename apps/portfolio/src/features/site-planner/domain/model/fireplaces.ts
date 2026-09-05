import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Opaque } from '@frozik/utils/types/base';

import type { Meters } from '../units';
import type { DuctId, VerticalDuct } from './ducts';
import { DEFAULT_FLUE_DEPTH_METERS, DEFAULT_FLUE_WIDTH_METERS } from './ducts';

export type FireplaceId = Opaque<'FireplaceId', string>;

export function createFireplaceId(): FireplaceId {
  return crypto.randomUUID() as FireplaceId;
}

/**
 * What burns wood in the house (`building-editor.md` §9, R34): an open
 * fireplace, a heating stove, or the stove of a sauna. They differ in size and
 * in what they are for; what they share — and what makes them a first-class
 * object rather than another piece of furniture — is that each one needs a
 * FLUE, and a flue is a hole through every storey above it and through the
 * roof.
 */
export type FireplaceKind = 'fireplace' | 'stove' | 'saunaStove';

export const FIREPLACE_KINDS: readonly FireplaceKind[] = ['fireplace', 'stove', 'saunaStove'];

/** What one kind is, in metres — the body, and the flue it needs. */
export interface FireplaceSpec {
  readonly widthMeters: Meters;
  readonly depthMeters: Meters;
  /** How tall the body stands — the mantel of a fireplace, the top of a stove. */
  readonly heightMeters: Meters;
}

export const FIREPLACE_SPECS: Readonly<Record<FireplaceKind, FireplaceSpec>> = {
  fireplace: { widthMeters: 1.4, depthMeters: 0.7, heightMeters: 1.2 },
  stove: { widthMeters: 0.9, depthMeters: 0.9, heightMeters: 1.8 },
  saunaStove: { widthMeters: 0.7, depthMeters: 0.6, heightMeters: 1 },
};

/**
 * A fireplace as it is stated: a kind, a place and a facing. Its body, its
 * flue and where that flue comes out all derive — a fireplace dragged across
 * the room takes its chimney with it.
 */
export interface Fireplace {
  readonly id: FireplaceId;
  readonly kind: FireplaceKind;
  readonly position: Vector2;
  /** Which way the firebox faces, counter-clockwise from plan east. */
  readonly rotationDegrees: number;
}

/**
 * How far behind the centre the flue stands: against the back wall of the
 * body, which is where a real chimney rises and what keeps it clear of the
 * opening the fire is watched through.
 */
export const FLUE_BACK_OFFSET_FACTOR = 0.25;

export function createFireplace({
  kind,
  position,
  rotationDegrees = 0,
}: {
  readonly kind: FireplaceKind;
  readonly position: Vector2;
  readonly rotationDegrees?: number;
}): Fireplace {
  return { id: createFireplaceId(), kind, position, rotationDegrees };
}

/**
 * The flue of a fireplace carries the fireplace's own identity: there is
 * exactly one of them, it is derived rather than placed, and giving it a fresh
 * id on every derivation would make it a different object every frame.
 */
export function flueIdOf(fireplace: Fireplace): DuctId {
  return fireplace.id as string as DuctId;
}

/** The flue a fireplace needs, standing behind its firebox. */
export function flueOf(fireplace: Fireplace, position: Vector2): VerticalDuct {
  return {
    id: flueIdOf(fireplace),
    kind: 'flue',
    position,
    widthMeters: DEFAULT_FLUE_WIDTH_METERS,
    depthMeters: DEFAULT_FLUE_DEPTH_METERS,
    rotationDegrees: fireplace.rotationDegrees,
  };
}

/** The shared empty list, so a storey with no fireplaces reads as one value. */
export const NO_FIREPLACES: readonly Fireplace[] = [];
