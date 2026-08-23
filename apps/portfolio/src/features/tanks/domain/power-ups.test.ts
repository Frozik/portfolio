import type { Vector2 } from '@frozik/utils/math/vector2';
import { random } from 'lodash-es';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLOCK_FREEZE_DURATION_TICKS,
  HELMET_DURATION_TICKS,
  MAX_STAR_LEVEL,
  POWER_UP_POSITION_ROLL_ATTEMPTS,
  POWER_UP_TYPE_TABLE,
  SHOVEL_FLASH_TOGGLE_TICKS,
  SHOVEL_FLASHING_TICKS,
  SHOVEL_TOTAL_TICKS,
} from './constants';
import type { PowerUpGrid } from './field';
import {
  getBaseWallMaterial,
  getPowerUpEffect,
  rollPowerUpPosition,
  rollPowerUpType,
  upgradeStarLevel,
} from './power-ups';

import type { PowerUpType } from './types';

vi.mock('lodash-es', async importOriginal => {
  const actual = await importOriginal<typeof import('lodash-es')>();

  return { ...actual, random: vi.fn() };
});

const randomMock = vi.mocked(random);

const TEST_GRID: PowerUpGrid = { columnsWu: [48, 96, 144, 192], rowsWu: [48, 96, 144, 192] };

function queueDraws(...draws: readonly number[]): void {
  randomMock.mockReset();

  for (const draw of draws) {
    randomMock.mockReturnValueOnce(draw);
  }

  randomMock.mockReturnValue(0);
}

beforeEach(() => {
  queueDraws();
});

describe('rollPowerUpType', () => {
  it('reads the weighted 8-entry table by draw index', () => {
    const rolled: PowerUpType[] = [];

    for (let draw = 0; draw < POWER_UP_TYPE_TABLE.length; draw++) {
      queueDraws(draw);
      rolled.push(rollPowerUpType());
    }

    expect(rolled).toEqual([...POWER_UP_TYPE_TABLE]);
  });

  it('gives star and grenade double odds', () => {
    expect(POWER_UP_TYPE_TABLE.filter(entry => entry === 'star')).toHaveLength(2);
    expect(POWER_UP_TYPE_TABLE.filter(entry => entry === 'grenade')).toHaveLength(2);
    expect(POWER_UP_TYPE_TABLE.filter(entry => entry === 'helmet')).toHaveLength(1);
  });
});

describe('rollPowerUpPosition', () => {
  it('draws both coordinates independently from the 4 × 4 grid', () => {
    queueDraws(1, 3);

    expect(rollPowerUpPosition(TEST_GRID, () => false)).toEqual({ x: 96, y: 192 });
  });

  it('re-rolls while the spot overlaps a tank', () => {
    queueDraws(0, 0, 2, 2);
    const blockedSpot: Vector2 = { x: 48, y: 48 };

    const position = rollPowerUpPosition(
      TEST_GRID,
      candidate => candidate.x === blockedSpot.x && candidate.y === blockedSpot.y
    );

    expect(position).toEqual({ x: 144, y: 144 });
  });

  it('gives up after the attempt cap instead of looping forever', () => {
    queueDraws();
    let attempts = 0;

    const position = rollPowerUpPosition(TEST_GRID, () => {
      attempts++;

      return true;
    });

    expect(attempts).toBe(POWER_UP_POSITION_ROLL_ATTEMPTS - 1);
    expect(TEST_GRID.columnsWu).toContain(position.x);
  });
});

describe('getPowerUpEffect', () => {
  it('maps each power-up to its effect and duration', () => {
    expect(getPowerUpEffect('helmet')).toEqual({ kind: 'shield', ticks: HELMET_DURATION_TICKS });
    expect(getPowerUpEffect('clock')).toEqual({
      kind: 'freeze-enemies',
      ticks: CLOCK_FREEZE_DURATION_TICKS,
    });
    expect(getPowerUpEffect('shovel')).toEqual({
      kind: 'fortify-base',
      ticks: SHOVEL_TOTAL_TICKS,
    });
    expect(getPowerUpEffect('star')).toEqual({ kind: 'upgrade' });
    expect(getPowerUpEffect('grenade')).toEqual({ kind: 'destroy-all-enemies' });
    expect(getPowerUpEffect('tank')).toEqual({ kind: 'extra-life' });
  });
});

describe('upgradeStarLevel', () => {
  it('adds one star and caps at three', () => {
    expect(upgradeStarLevel(0)).toBe(1);
    expect(upgradeStarLevel(2)).toBe(MAX_STAR_LEVEL);
    expect(upgradeStarLevel(MAX_STAR_LEVEL)).toBe(MAX_STAR_LEVEL);
  });
});

describe('getBaseWallMaterial', () => {
  it('is brick when no shovel is running', () => {
    expect(getBaseWallMaterial(0)).toBe('brick');
  });

  it('is solid steel for the whole first phase', () => {
    expect(getBaseWallMaterial(SHOVEL_TOTAL_TICKS)).toBe('steel');
    expect(getBaseWallMaterial(SHOVEL_FLASHING_TICKS + 1)).toBe('steel');
  });

  it('flashes on a 16-tick period and ends on brick', () => {
    const materials: string[] = [];

    for (
      let remaining = SHOVEL_FLASHING_TICKS;
      remaining > 0;
      remaining -= SHOVEL_FLASH_TOGGLE_TICKS
    ) {
      materials.push(getBaseWallMaterial(remaining));
    }

    expect(materials[0]).toBe('brick');
    expect(materials[1]).toBe('steel');
    expect(materials.at(-1)).toBe('steel');
    expect(getBaseWallMaterial(1)).toBe('brick');
  });
});
