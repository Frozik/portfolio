import type { Vector2 } from '@frozik/utils/math/vector2';

import { BLAST_DAMAGE_PER_RADIUS_WU } from '../constants';
import type { CarveResult, Heightfield } from '../terrain/heightfield';
import { carveCircle } from '../terrain/heightfield';
import type { PlayerId } from '../types';

export interface BlastTarget {
  readonly playerId: PlayerId;
  readonly position: Vector2;
}

export interface BlastDamage {
  readonly playerId: PlayerId;
  readonly amount: number;
  readonly distanceWu: number;
}

/** Damage at the very centre of a blast; bigger warheads hit harder as well as wider. */
export function getBlastPeakDamage(radiusWu: number): number {
  return radiusWu * BLAST_DAMAGE_PER_RADIUS_WU;
}

/**
 * The manual never printed a falloff curve, so v1 uses a straight line from the
 * peak at the centre down to zero exactly at the radius.
 */
export function getBlastDamageAt(radiusWu: number, distanceWu: number): number {
  if (radiusWu <= 0 || distanceWu >= radiusWu) {
    return 0;
  }

  return getBlastPeakDamage(radiusWu) * (1 - distanceWu / radiusWu);
}

export function computeBlastDamage(
  center: Vector2,
  radiusWu: number,
  targets: readonly BlastTarget[]
): readonly BlastDamage[] {
  const damages: BlastDamage[] = [];

  for (const target of targets) {
    const distanceWu = Math.hypot(target.position.x - center.x, target.position.y - center.y);
    const amount = getBlastDamageAt(radiusWu, distanceWu);

    if (amount > 0) {
      damages.push({ playerId: target.playerId, amount, distanceWu });
    }
  }

  return damages;
}

export function applyBlastToTerrain(
  field: Heightfield,
  center: Vector2,
  radiusWu: number
): CarveResult {
  return carveCircle(field, center, radiusWu);
}
