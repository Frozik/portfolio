import { describe, expect, it } from 'vitest';

import { BLAST_DAMAGE_PER_RADIUS_WU } from '../constants';
import { createFlatHeightfield, getSurfaceHeight } from '../terrain/heightfield';
import {
  applyBlastToTerrain,
  computeBlastDamage,
  getBlastDamageAt,
  getBlastPeakDamage,
} from './explosions';

const RADIUS_WU = 40;
const COLUMN_COUNT = 100;
const GROUND_HEIGHT_WU = 100;

describe('getBlastDamageAt', () => {
  it('peaks at the centre in proportion to the radius', () => {
    expect(getBlastDamageAt(RADIUS_WU, 0)).toBeCloseTo(RADIUS_WU * BLAST_DAMAGE_PER_RADIUS_WU);
    expect(getBlastPeakDamage(RADIUS_WU)).toBeCloseTo(RADIUS_WU * BLAST_DAMAGE_PER_RADIUS_WU);
  });

  it('falls off linearly to zero at the radius', () => {
    expect(getBlastDamageAt(RADIUS_WU, RADIUS_WU / 2)).toBeCloseTo(
      getBlastPeakDamage(RADIUS_WU) / 2
    );
    expect(getBlastDamageAt(RADIUS_WU, RADIUS_WU)).toBe(0);
    expect(getBlastDamageAt(RADIUS_WU, RADIUS_WU + 1)).toBe(0);
  });

  it('does nothing at all for a radius-less weapon', () => {
    expect(getBlastDamageAt(0, 0)).toBe(0);
  });
});

describe('computeBlastDamage', () => {
  it('hurts everyone inside the radius and no one outside it', () => {
    const damages = computeBlastDamage({ x: 100, y: 100 }, RADIUS_WU, [
      { playerId: 1, position: { x: 100, y: 100 } },
      { playerId: 2, position: { x: 120, y: 100 } },
      { playerId: 3, position: { x: 200, y: 100 } },
    ]);

    expect(damages.map(damage => damage.playerId)).toEqual([1, 2]);
    expect(damages[0].amount).toBeGreaterThan(damages[1].amount);
    expect(damages[1].distanceWu).toBeCloseTo(20);
  });

  it('measures distance in two dimensions', () => {
    const [damage] = computeBlastDamage({ x: 100, y: 100 }, RADIUS_WU, [
      { playerId: 1, position: { x: 103, y: 104 } },
    ]);

    expect(damage.distanceWu).toBeCloseTo(5);
  });
});

describe('applyBlastToTerrain', () => {
  it('digs the crater into the heightfield', () => {
    const ground = createFlatHeightfield(GROUND_HEIGHT_WU, COLUMN_COUNT);
    const { field } = applyBlastToTerrain(ground, { x: 50.5, y: GROUND_HEIGHT_WU }, 10);

    expect(getSurfaceHeight(field, 50)).toBeCloseTo(GROUND_HEIGHT_WU - 10);
  });
});
