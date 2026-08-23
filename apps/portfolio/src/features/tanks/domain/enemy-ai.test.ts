import { random } from 'lodash-es';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ENEMY_BRAKE_TICKS, TANK_SIZE_WU } from './constants';
import type { IEnemyAiContext } from './enemy-ai';
import {
  decideBlockedReaction,
  decideEnemyAction,
  getAggressionPhase,
  isAlignedToGrid,
  selectAggressiveDirection,
} from './enemy-ai';
import type { EnemyTank } from './types';

vi.mock('lodash-es', async importOriginal => {
  const actual = await importOriginal<typeof import('lodash-es')>();

  return { ...actual, random: vi.fn() };
});

const randomMock = vi.mocked(random);

const SPAWN_INTERVAL_TICKS = 100;
const ALIGNED_POSITION = 96;
const UNALIGNED_POSITION = 100;
const NEVER_HITS_DRAW = 1;

/** Queues the draws `lodash-es` `random` will return, in call order. */
function queueDraws(...draws: readonly number[]): void {
  randomMock.mockReset();

  for (const draw of draws) {
    randomMock.mockReturnValueOnce(draw);
  }

  randomMock.mockReturnValue(NEVER_HITS_DRAW);
}

function createEnemy(overrides: Partial<EnemyTank> = {}): EnemyTank {
  return {
    slot: 0,
    type: 'basic',
    spawnIndex: 0,
    isPowerUpCarrier: false,
    positionX: ALIGNED_POSITION,
    positionY: ALIGNED_POSITION,
    direction: 'down',
    movementRemainder: 0,
    hitPoints: 1,
    twinkleTicksRemaining: 0,
    brakeTicksRemaining: 0,
    ...overrides,
  };
}

function createContext(overrides: Partial<IEnemyAiContext> = {}): IEnemyAiContext {
  return {
    ticksSinceStageStart: 0,
    spawnIntervalTicks: SPAWN_INTERVAL_TICKS,
    playerCenters: [undefined, undefined],
    baseCenter: { x: 104, y: 200 },
    ...overrides,
  };
}

beforeEach(() => {
  queueDraws();
});

describe('isAlignedToGrid', () => {
  it('is true only on 8 wu boundaries of both axes', () => {
    expect(isAlignedToGrid(96, 96)).toBe(true);
    expect(isAlignedToGrid(96, 100)).toBe(false);
    expect(isAlignedToGrid(100, 96)).toBe(false);
  });
});

describe('getAggressionPhase', () => {
  it('switches at 8·I and 16·I ticks', () => {
    const interval = SPAWN_INTERVAL_TICKS;

    expect(getAggressionPhase(0, interval)).toBe('wander');
    expect(getAggressionPhase(8 * interval, interval)).toBe('wander');
    expect(getAggressionPhase(8 * interval + 1, interval)).toBe('chase-player');
    expect(getAggressionPhase(16 * interval, interval)).toBe('chase-player');
    expect(getAggressionPhase(16 * interval + 1, interval)).toBe('hunt-base');
  });
});

describe('decideEnemyAction', () => {
  it('keeps cruising when the enemy is not 8 wu aligned', () => {
    const enemy = createEnemy({ positionX: UNALIGNED_POSITION, direction: 'left' });

    const decision = decideEnemyAction(enemy, createContext(), false);

    expect(decision.direction).toBe('left');
  });

  it('re-decides the direction on a 1-in-16 draw at an aligned position', () => {
    queueDraws(0, 2, NEVER_HITS_DRAW);

    const decision = decideEnemyAction(createEnemy({ direction: 'left' }), createContext(), false);

    expect(decision.direction).toBe('down');
  });

  it('keeps the direction when the cruise draw misses', () => {
    queueDraws(5, NEVER_HITS_DRAW);

    const decision = decideEnemyAction(createEnemy({ direction: 'left' }), createContext(), false);

    expect(decision.direction).toBe('left');
  });

  it('fires on a 1-in-32 draw when the bullet slot is free', () => {
    queueDraws(NEVER_HITS_DRAW, 0);

    expect(decideEnemyAction(createEnemy(), createContext(), false).fire).toBe(true);
  });

  it('never fires while its own bullet is alive', () => {
    queueDraws(NEVER_HITS_DRAW, 0);

    expect(decideEnemyAction(createEnemy(), createContext(), true).fire).toBe(false);
  });
});

describe('selectAggressiveDirection', () => {
  it('wanders randomly during the first phase', () => {
    queueDraws(3);

    expect(selectAggressiveDirection(createEnemy(), createContext())).toBe('left');
  });

  it('chases the player matching the enemy slot parity', () => {
    const context = createContext({
      ticksSinceStageStart: 8 * SPAWN_INTERVAL_TICKS + 1,
      playerCenters: [
        { x: ALIGNED_POSITION + TANK_SIZE_WU / 2, y: 8 },
        { x: ALIGNED_POSITION + TANK_SIZE_WU / 2, y: 200 },
      ],
    });

    expect(selectAggressiveDirection(createEnemy({ slot: 0 }), context)).toBe('up');
    expect(selectAggressiveDirection(createEnemy({ slot: 1 }), context)).toBe('down');
    expect(selectAggressiveDirection(createEnemy({ slot: 2 }), context)).toBe('up');
  });

  it('falls back to the living player when its own target is gone', () => {
    const context = createContext({
      ticksSinceStageStart: 8 * SPAWN_INTERVAL_TICKS + 1,
      playerCenters: [undefined, { x: ALIGNED_POSITION + TANK_SIZE_WU / 2, y: 200 }],
    });

    expect(selectAggressiveDirection(createEnemy({ slot: 0 }), context)).toBe('down');
  });

  it('wanders when no player is alive at all', () => {
    queueDraws(1);

    const context = createContext({ ticksSinceStageStart: 8 * SPAWN_INTERVAL_TICKS + 1 });

    expect(selectAggressiveDirection(createEnemy(), context)).toBe('right');
  });

  it('hunts the base in the last phase', () => {
    const context = createContext({
      ticksSinceStageStart: 16 * SPAWN_INTERVAL_TICKS + 1,
      baseCenter: { x: ALIGNED_POSITION + TANK_SIZE_WU / 2, y: 200 },
    });

    expect(selectAggressiveDirection(createEnemy(), context)).toBe('down');
  });

  it('picks the axis at random when the target is off both axes', () => {
    const context = createContext({
      ticksSinceStageStart: 16 * SPAWN_INTERVAL_TICKS + 1,
      baseCenter: { x: 8, y: 200 },
    });

    queueDraws(0);
    expect(selectAggressiveDirection(createEnemy(), context)).toBe('down');

    queueDraws(1);
    expect(selectAggressiveDirection(createEnemy(), context)).toBe('left');
  });
});

describe('decideBlockedReaction', () => {
  it('brakes on three of the four draws', () => {
    for (const draw of [0, 1, 2]) {
      queueDraws(draw);

      expect(decideBlockedReaction(createEnemy(), createContext())).toEqual({
        kind: 'brake',
        ticks: ENEMY_BRAKE_TICKS,
      });
    }
  });

  it('reverses on the fourth draw when the enemy is not aligned', () => {
    queueDraws(3);

    const enemy = createEnemy({ positionX: UNALIGNED_POSITION, direction: 'down' });

    expect(decideBlockedReaction(enemy, createContext())).toEqual({
      kind: 'turn',
      direction: 'up',
    });
  });

  it('turns 90° to either side when aligned', () => {
    queueDraws(3, 0, 0);
    expect(decideBlockedReaction(createEnemy({ direction: 'down' }), createContext())).toEqual({
      kind: 'turn',
      direction: 'right',
    });

    queueDraws(3, 0, 1);
    expect(decideBlockedReaction(createEnemy({ direction: 'down' }), createContext())).toEqual({
      kind: 'turn',
      direction: 'left',
    });
  });

  it('runs the aggression selector on the other half of the aligned draw', () => {
    queueDraws(3, 1, 2);

    expect(decideBlockedReaction(createEnemy({ direction: 'down' }), createContext())).toEqual({
      kind: 'turn',
      direction: 'down',
    });
  });
});
