import { describe, expect, it } from 'vitest';

import type { EnemyType } from '../../domain/types';
import {
  CARRIER_PALETTE_NAME,
  getEnemyPalette,
  listEnemyPaletteNames,
  resolveEnemyPaletteName,
} from './palettes';

const ENEMY_TYPES: readonly EnemyType[] = ['basic', 'fast', 'power', 'armor'];
const FULL_HEALTH_DAMAGE_LEVEL = 0;

function resolveArmorName(tick: number, damageLevel = FULL_HEALTH_DAMAGE_LEVEL): string {
  return resolveEnemyPaletteName({
    enemyType: 'armor',
    damageLevel,
    isCarrierFlashing: false,
    tick,
  });
}

describe('enemy palettes', () => {
  it.each(ENEMY_TYPES)('bakes every %s palette the renderer can ask for', enemyType => {
    for (const paletteName of listEnemyPaletteNames(enemyType)) {
      expect(Object.keys(getEnemyPalette(enemyType, paletteName)).length).toBeGreaterThan(0);
    }
  });

  it.each(ENEMY_TYPES)('resolves %s to a palette that exists in the atlas', enemyType => {
    const names = listEnemyPaletteNames(enemyType);

    for (let tick = 0; tick < 4; tick++) {
      for (const damageLevel of [0, 1, 2, 3]) {
        for (const isCarrierFlashing of [false, true]) {
          const resolved = resolveEnemyPaletteName({
            enemyType,
            damageLevel: enemyType === 'armor' ? damageLevel : FULL_HEALTH_DAMAGE_LEVEL,
            isCarrierFlashing,
            tick,
          });

          expect(names).toContain(resolved);
        }
      }
    }
  });

  it('shimmers a full-health armor tank between two palettes every tick', () => {
    expect(resolveArmorName(0)).not.toBe(resolveArmorName(1));
    expect(resolveArmorName(0)).toBe(resolveArmorName(2));
    expect(getEnemyPalette('armor', resolveArmorName(0))).not.toEqual(
      getEnemyPalette('armor', resolveArmorName(1))
    );
  });

  it('never reads a fresh armor tank as a damaged one', () => {
    const shimmerNames = [resolveArmorName(0), resolveArmorName(1)];
    const damageNames = [resolveArmorName(0, 1), resolveArmorName(0, 2), resolveArmorName(0, 3)];

    for (const shimmerName of shimmerNames) {
      expect(damageNames).not.toContain(shimmerName);

      for (const damageName of damageNames) {
        expect(getEnemyPalette('armor', shimmerName)).not.toEqual(
          getEnemyPalette('armor', damageName)
        );
      }
    }
  });

  it('holds a damaged armor tank on one palette instead of shimmering it', () => {
    expect(resolveArmorName(0, 2)).toBe(resolveArmorName(1, 2));
  });

  it('lets the carrier flash outrank the shimmer', () => {
    expect(
      resolveEnemyPaletteName({
        enemyType: 'armor',
        damageLevel: FULL_HEALTH_DAMAGE_LEVEL,
        isCarrierFlashing: true,
        tick: 1,
      })
    ).toBe(CARRIER_PALETTE_NAME);
  });

  it('keeps single-hit enemies on one body palette', () => {
    for (const enemyType of ['basic', 'fast', 'power'] as const) {
      expect(
        resolveEnemyPaletteName({ enemyType, damageLevel: 0, isCarrierFlashing: false, tick: 0 })
      ).toBe(
        resolveEnemyPaletteName({ enemyType, damageLevel: 0, isCarrierFlashing: false, tick: 1 })
      );
    }
  });
});
