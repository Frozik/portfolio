import { random } from 'lodash-es';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEATHS_HEAD_WARHEAD_COUNT,
  FUNKY_BOMB_BURST_RADIUS_WU,
  LASER_BEAM_HALF_WIDTH_WU,
  LEAPFROG_HOP_ENERGY_DAMPING,
  MIRV_WARHEAD_COUNT,
  NAPALM_DAMAGE_PER_DEPTH_WU,
  NAPALM_SURFACE_DEPTH_WU,
  PLASMA_MAX_BATTERIES,
  PLASMA_MAX_RADIUS_WU,
  PLASMA_MIN_RADIUS_WU,
  TANK_CENTER_OFFSET_WU,
} from '../constants';
import type { Heightfield } from '../terrain/heightfield';
import { createFlatHeightfield, createHeightfield, getSurfaceHeight } from '../terrain/heightfield';
import type { WeaponId } from '../types';
import { toPlayerId } from '../types';
import type { ImpactContext, ImpactEffect } from './behaviors';
import {
  computeLaserHits,
  computeNapalmDamage,
  computeNapalmPools,
  getPlasmaRadius,
  resolveImpact,
  splitAtApex,
} from './behaviors';
import { getWeapon } from './catalog';

vi.mock('lodash-es', async importOriginal => {
  const actual = await importOriginal<typeof import('lodash-es')>();

  return { ...actual, random: vi.fn() };
});

const randomMock = vi.mocked(random);

const COLUMN_COUNT = 200;
const GROUND_HEIGHT_WU = 100;
const IMPACT_COLUMN = 100;

function createContext(weaponId: WeaponId, overrides: Partial<ImpactContext> = {}): ImpactContext {
  return {
    field: createFlatHeightfield(GROUND_HEIGHT_WU, COLUMN_COUNT),
    impact: { x: IMPACT_COLUMN + 0.5, y: GROUND_HEIGHT_WU },
    velocity: { x: 2, y: -3 },
    blastRadiusWu: getWeapon(weaponId).blastRadiusWu,
    stageIndex: 0,
    tanks: [],
    ...overrides,
  };
}

function findEffects<Kind extends ImpactEffect['kind']>(
  effects: readonly ImpactEffect[],
  kind: Kind
): readonly Extract<ImpactEffect, { kind: Kind }>[] {
  return effects.filter(
    (effect): effect is Extract<ImpactEffect, { kind: Kind }> => effect.kind === kind
  );
}

function createValleyField(): Heightfield {
  return createHeightfield(
    Array.from({ length: COLUMN_COUNT }, (_unused, index) => Math.abs(index - 60) + 20)
  );
}

beforeEach(() => {
  randomMock.mockReset();
  randomMock.mockReturnValue(0);
});

describe('ballistic family', () => {
  it('explodes at the impact point with the warhead radius', () => {
    const effects = resolveImpact(getWeapon('nuke'), createContext('nuke'));

    expect(effects).toEqual([
      { kind: 'explosion', center: { x: IMPACT_COLUMN + 0.5, y: GROUND_HEIGHT_WU }, radiusWu: 75 },
    ]);
  });
});

describe('leapfrog family', () => {
  it('detonates and hops onward for the first two hops', () => {
    const effects = resolveImpact(getWeapon('leap-frog'), createContext('leap-frog'));
    const [explosion] = findEffects(effects, 'explosion');
    const [spawn] = findEffects(effects, 'spawn-warheads');

    expect(explosion.radiusWu).toBe(20);
    expect(spawn.warheads).toHaveLength(1);
    expect(spawn.warheads[0].blastRadiusWu).toBe(25);
    expect(spawn.warheads[0].stageIndex).toBe(1);
  });

  it('skips forward with damped energy and an upward kick', () => {
    const effects = resolveImpact(getWeapon('leap-frog'), createContext('leap-frog'));
    const [spawn] = findEffects(effects, 'spawn-warheads');

    expect(spawn.warheads[0].state.velocity.x).toBeCloseTo(2 * LEAPFROG_HOP_ENERGY_DAMPING);
    expect(spawn.warheads[0].state.velocity.y).toBeCloseTo(3 * LEAPFROG_HOP_ENERGY_DAMPING);
  });

  it('stops hopping after the third detonation', () => {
    const effects = resolveImpact(
      getWeapon('leap-frog'),
      createContext('leap-frog', { stageIndex: 2 })
    );

    expect(findEffects(effects, 'spawn-warheads')).toEqual([]);
    expect(findEffects(effects, 'explosion')[0].radiusWu).toBe(30);
  });
});

describe('MIRV family', () => {
  it('splits into five fanned warheads at apex', () => {
    const warheads = splitAtApex(getWeapon('mirv'), {
      position: { x: 100, y: 300 },
      velocity: { x: 2, y: 0 },
    });

    expect(warheads).toHaveLength(MIRV_WARHEAD_COUNT);
    expect(warheads?.map(warhead => warhead.state.velocity.x)).toEqual([0.8, 1.4, 2, 2.6, 3.2]);
  });

  it("gives the Death's Head nine warheads", () => {
    const warheads = splitAtApex(getWeapon('deaths-head'), {
      position: { x: 100, y: 300 },
      velocity: { x: 0, y: 0 },
    });

    expect(warheads).toHaveLength(DEATHS_HEAD_WARHEAD_COUNT);
    expect(warheads?.every(warhead => warhead.blastRadiusWu === 35)).toBe(true);
  });

  it('never splits a weapon of another family', () => {
    expect(
      splitAtApex(getWeapon('nuke'), { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } })
    ).toBeUndefined();
  });

  it('detonates as a single warhead when it impacts before apex', () => {
    const effects = resolveImpact(getWeapon('mirv'), createContext('mirv'));

    expect(findEffects(effects, 'explosion')).toHaveLength(1);
    expect(findEffects(effects, 'spawn-warheads')).toEqual([]);
  });
});

describe('funky bomb family', () => {
  it('bursts on impact and scatters the drawn number of secondary bursts', () => {
    const burstCount = 7;

    randomMock.mockReturnValueOnce(burstCount);
    randomMock.mockReturnValue(10);

    const effects = resolveImpact(getWeapon('funky-bomb'), createContext('funky-bomb'));
    const explosions = findEffects(effects, 'explosion');

    expect(explosions).toHaveLength(burstCount + 1);
    expect(explosions.every(explosion => explosion.radiusWu === FUNKY_BOMB_BURST_RADIUS_WU)).toBe(
      true
    );
    expect(explosions[1].center.x).toBeCloseTo(IMPACT_COLUMN + 10.5);
  });
});

describe('roller family', () => {
  it('detonates in place — the round has already rolled it to its rest position', () => {
    const effects = resolveImpact(
      getWeapon('roller'),
      createContext('roller', { field: createValleyField(), impact: { x: 60.5, y: 60 } })
    );

    expect(findEffects(effects, 'explosion')[0].center).toEqual({ x: 60.5, y: 60 });
  });
});

describe('riot family', () => {
  it('carves a wedge for a riot charge and does no damage', () => {
    const effects = resolveImpact(getWeapon('riot-charge'), createContext('riot-charge'));

    expect(effects).toEqual([
      { kind: 'carve-wedge', apex: { x: IMPACT_COLUMN + 0.5, y: GROUND_HEIGHT_WU }, radiusWu: 36 },
    ]);
  });

  it('carves a dirt pocket for a riot bomb and does no damage', () => {
    const effects = resolveImpact(getWeapon('riot-bomb'), createContext('riot-bomb'));

    expect(findEffects(effects, 'explosion')).toEqual([]);
    expect(findEffects(effects, 'carve')[0].radiusWu).toBe(30);
  });
});

describe('dirt families', () => {
  it('deposits a sphere for a dirt clod', () => {
    const effects = resolveImpact(getWeapon('dirt-clod'), createContext('dirt-clod'));

    expect(findEffects(effects, 'deposit')[0].radiusWu).toBe(20);
  });

  it('buries the impact under a ton of dirt', () => {
    const effects = resolveImpact(getWeapon('ton-of-dirt'), createContext('ton-of-dirt'));

    expect(findEffects(effects, 'deposit')[0].radiusWu).toBe(70);
  });

  it('does nothing at liquid dirt landing — the round pours the load over time', () => {
    const effects = resolveImpact(getWeapon('liquid-dirt'), createContext('liquid-dirt'));

    expect(effects).toHaveLength(0);
  });

  it('throws a wedge of airborne dirt for a dirt charge', () => {
    const effects = resolveImpact(getWeapon('dirt-charge'), createContext('dirt-charge'));

    expect(findEffects(effects, 'deposit-wedge')).toHaveLength(1);
  });
});

describe('napalm family', () => {
  it('spreads out to both sides of the impact on flat ground', () => {
    const [pool] = computeNapalmPools(
      createFlatHeightfield(GROUND_HEIGHT_WU, COLUMN_COUNT),
      100,
      400
    );
    const lastColumn = pool.firstColumn + pool.surfaceHeights.length - 1;

    expect(pool.firstColumn).toBeLessThan(100);
    expect(lastColumn).toBeGreaterThan(100);
    expect(lastColumn - pool.firstColumn).toBeGreaterThan(40);
  });

  it('runs downhill from a slope impact instead of climbing the hill', () => {
    const [pool] = computeNapalmPools(createValleyField(), 100, 400);
    const lastColumn = pool.firstColumn + pool.surfaceHeights.length - 1;

    expect(pool.firstColumn).toBeLessThan(60);
    expect(100 - pool.firstColumn).toBeGreaterThan(lastColumn - 100);
  });

  it('hugs the terrain profile — every covered column carries its own surface height', () => {
    const field = createValleyField();
    const [pool] = computeNapalmPools(field, 60, 400);

    pool.surfaceHeights.forEach((height, offset) => {
      expect(height).toBe(getSurfaceHeight(field, pool.firstColumn + offset));
    });
  });

  it('burns a covered tank for the coating depth and spares one outside the fire', () => {
    const pools = [{ firstColumn: 50, surfaceHeights: Array.from({ length: 21 }, () => 30) }];
    const damages = computeNapalmDamage(pools, [
      { playerId: toPlayerId(1), columnIndex: 60, positionY: 30, hasShield: false },
      { playerId: toPlayerId(3), columnIndex: 90, positionY: 10, hasShield: false },
    ]);

    expect(damages).toEqual([
      { playerId: 1, amount: NAPALM_SURFACE_DEPTH_WU * NAPALM_DAMAGE_PER_DEPTH_WU },
    ]);
  });

  it('gives Hot Napalm a wider spread than plain napalm', () => {
    const field = createFlatHeightfield(GROUND_HEIGHT_WU, COLUMN_COUNT);
    const [plain] = computeNapalmPools(field, 100, getWeapon('napalm').flowVolumeWu);
    const [hot] = computeNapalmPools(field, 100, getWeapon('hot-napalm').flowVolumeWu);

    expect(hot.surfaceHeights.length).toBeGreaterThan(plain.surfaceHeights.length);
  });
});

describe('plasma family', () => {
  it('scales the radius with the batteries spent', () => {
    expect(getPlasmaRadius(1)).toBe(PLASMA_MIN_RADIUS_WU);
    expect(getPlasmaRadius(PLASMA_MAX_BATTERIES)).toBe(PLASMA_MAX_RADIUS_WU);
    expect(getPlasmaRadius(5)).toBeGreaterThan(getPlasmaRadius(4));
  });

  it('clamps to the tabled range outside it', () => {
    expect(getPlasmaRadius(0)).toBe(PLASMA_MIN_RADIUS_WU);
    expect(getPlasmaRadius(100)).toBe(PLASMA_MAX_RADIUS_WU);
  });
});

describe('laser family', () => {
  it('hits everything on the beam line, nearest first', () => {
    const hits = computeLaserHits({ x: 0, y: TANK_CENTER_OFFSET_WU }, { x: 1, y: 0 }, [
      { playerId: toPlayerId(1), columnIndex: 99, positionY: 0, hasShield: true },
      { playerId: toPlayerId(2), columnIndex: 49, positionY: 0, hasShield: false },
    ]);

    expect(hits.map(hit => hit.playerId)).toEqual([2, 1]);
  });

  it('ignores tanks behind the muzzle and off the beam', () => {
    const hits = computeLaserHits({ x: 100, y: TANK_CENTER_OFFSET_WU }, { x: 1, y: 0 }, [
      { playerId: toPlayerId(1), columnIndex: 49, positionY: 0, hasShield: false },
      {
        playerId: toPlayerId(2),
        columnIndex: 149,
        positionY: LASER_BEAM_HALF_WIDTH_WU + 5,
        hasShield: false,
      },
    ]);

    expect(hits).toEqual([]);
  });
});
