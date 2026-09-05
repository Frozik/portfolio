import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Opaque } from '@frozik/utils/types/base';

import type { Meters } from '../units';

export type SupportId = Opaque<'SupportId', string>;

export function createSupportId(): SupportId {
  return crypto.randomUUID() as SupportId;
}

export type SupportProfile = 'round' | 'square';

export const SUPPORT_PROFILES: readonly SupportProfile[] = ['round', 'square'];

/**
 * One post under an overhang or a canopy (plan §6.2). Only the intent is
 * stored; both ends DERIVE (O-S1 / I2-4): the base sits on the storey's floor
 * inside the storey's footprint and on the TERRAIN outside it (each post its
 * own length on a slope), the top reaches the storey's ceiling datum — one
 * shared level, so a plate laid over several posts stays horizontal.
 */
export interface SupportPost {
  readonly id: SupportId;
  readonly position: Vector2;
  readonly profile: SupportProfile;
  readonly sizeMeters: Meters;
}

const DEFAULT_SUPPORT_SIZE_METERS: Meters = 0.15;

export function createSupport({
  position,
  profile = 'square',
  sizeMeters = DEFAULT_SUPPORT_SIZE_METERS,
}: {
  readonly position: Vector2;
  readonly profile?: SupportProfile;
  readonly sizeMeters?: Meters;
}): SupportPost {
  return { id: createSupportId(), position, profile, sizeMeters };
}
