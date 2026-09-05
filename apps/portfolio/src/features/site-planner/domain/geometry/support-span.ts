import type { Vector2 } from '@frozik/utils/math/vector2';

import type { SupportPost } from '../model/supports';
import type { Meters } from '../units';
import { isPointInMultiPolygon } from './polygon-booleans';
import type { MultiPolygon } from './polygon-types';

/** What a post actually spans once both of its ends are derived. */
export interface SupportSpan {
  readonly baseElevation: Meters;
  readonly topElevation: Meters;
}

/**
 * Both ends of a post .
 *
 * The TOP is a single shared datum — the storey's ceiling — never a per-post
 * length: posts under one canopy must line up so the plate laid over them
 * stays horizontal, which a slope would otherwise ruin.
 *
 * The BASE is the storey's floor where the post stands within that storey's
 * footprint, and the GROUND where it stands outside it — under an overhang or
 * a free-standing canopy there is no floor, only ground, so each post on a
 * slope ends up its own length. `groundElevationAt` must be the DESIGN grade
 * (`terrain/design-grade.ts`), never the raw survey: a post half a metre from
 * the цоколь stands on made ground, and reading the virgin heightfield there
 * would float or sink it by the whole cut depth.
 */
export function supportSpan({
  post,
  storeyFootprint,
  floorElevation,
  ceilingElevation,
  groundElevationAt,
}: {
  readonly post: SupportPost;
  readonly storeyFootprint: MultiPolygon;
  readonly floorElevation: Meters;
  readonly ceilingElevation: Meters;
  readonly groundElevationAt: (point: Vector2) => Meters;
}): SupportSpan {
  const standsOnFloor = isPointInMultiPolygon(storeyFootprint, post.position);

  return {
    baseElevation: standsOnFloor ? floorElevation : groundElevationAt(post.position),
    topElevation: ceilingElevation,
  };
}
