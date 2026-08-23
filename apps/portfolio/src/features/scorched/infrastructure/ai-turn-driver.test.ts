import { describe, expect, it } from 'vitest';

import { AI_THINKING_SECONDS, DEFAULT_PHYSICS_OPTIONS, MAX_TANK_HEALTH } from '../domain/constants';
import { ScorchedRound } from '../domain/round';
import { createFlatHeightfield } from '../domain/terrain/heightfield';
import type { AimState, PlayerId, PlayerInventory } from '../domain/types';
import { AiTurnDriver, hasReachedAim, stepAimTowards } from './ai-turn-driver';

const GROUND_WU = 60;
const COLUMN_COUNT = 400;
const NO_KILLS: ReadonlyMap<PlayerId, number> = new Map();
const FRAME_SECONDS = 1 / 60;

function createRound(activeInventory: PlayerInventory = { weapons: {}, items: {} }): ScorchedRound {
  const round = new ScorchedRound({
    roundNumber: 1,
    players: [
      {
        id: 0,
        columnIndex: 60,
        health: MAX_TANK_HEALTH,
        inventory: activeInventory,
      },
      {
        id: 1,
        columnIndex: 320,
        health: MAX_TANK_HEALTH,
        inventory: { weapons: {}, items: {} },
      },
    ],
    field: createFlatHeightfield(GROUND_WU, COLUMN_COUNT),
    physics: { ...DEFAULT_PHYSICS_OPTIONS, maxWind: 0 },
    playOrder: 'sequential',
  });

  round.start();

  return round;
}

describe('stepAimTowards', () => {
  const from: AimState = { facing: 'right', elevationDegrees: 10, power: 100 };
  const to: AimState = { facing: 'right', elevationDegrees: 70, power: 800 };

  it('moves towards the answer without jumping to it', () => {
    const stepped = stepAimTowards(from, to, FRAME_SECONDS);

    expect(stepped.elevationDegrees).toBeGreaterThan(from.elevationDegrees);
    expect(stepped.elevationDegrees).toBeLessThan(to.elevationDegrees);
    expect(stepped.power).toBeGreaterThan(from.power);
    expect(stepped.power).toBeLessThan(to.power);
  });

  it('never overshoots when the frame is long', () => {
    const stepped = stepAimTowards(from, to, 10);

    expect(stepped.elevationDegrees).toBe(to.elevationDegrees);
    expect(stepped.power).toBe(to.power);
    expect(hasReachedAim(stepped, to)).toBe(true);
  });

  it('sweeps the barrel through straight up rather than teleporting across sides', () => {
    const leftward = stepAimTowards(from, { ...to, facing: 'left' }, FRAME_SECONDS);

    expect(leftward.facing).toBe('right');
    expect(leftward.elevationDegrees).toBeGreaterThan(from.elevationDegrees);
  });
});

describe('AiTurnDriver', () => {
  it('does nothing at all while a shell is still in the air', () => {
    const round = createRound();

    round.setAim({ facing: 'right', elevationDegrees: 45, power: 500 });
    round.fire({ weaponId: 'baby-missile' });

    const step = new AiTurnDriver().advance({
      round,
      personality: 'shooter',
      killsByPlayerId: NO_KILLS,
      elapsedSeconds: FRAME_SECONDS,
    });

    expect(step).toEqual({
      isThinking: false,
      aim: undefined,
      weaponId: undefined,
      isFireRequested: false,
    });
  });

  it('puts its best bubble up as the turn opens, and only the once', () => {
    const driver = new AiTurnDriver();
    const round = createRound({ weapons: {}, items: { shield: 2, 'heavy-shield': 1 } });
    const request = {
      round,
      personality: 'shooter' as const,
      killsByPlayerId: NO_KILLS,
      elapsedSeconds: FRAME_SECONDS,
    };

    expect(driver.advance(request).shieldItemId).toBe('heavy-shield');
    expect(driver.advance(request).shieldItemId).toBeUndefined();
  });

  it('leaves the locker alone when a bubble is already standing', () => {
    const driver = new AiTurnDriver();
    const round = createRound({ weapons: {}, items: { shield: 1 } });

    round.raiseShield('shield');

    const step = driver.advance({
      round,
      personality: 'shooter',
      killsByPlayerId: NO_KILLS,
      elapsedSeconds: FRAME_SECONDS,
    });

    expect(step.shieldItemId).toBeUndefined();
  });

  it('thinks for a beat before it touches the dial', () => {
    const driver = new AiTurnDriver();
    const round = createRound();
    const step = driver.advance({
      round,
      personality: 'shooter',
      killsByPlayerId: NO_KILLS,
      elapsedSeconds: FRAME_SECONDS,
    });

    expect(step.isThinking).toBe(true);
    expect(step.aim).toBeUndefined();
    expect(step.isFireRequested).toBe(false);
  });

  it('dials the aim in over several frames and only then fires', () => {
    const driver = new AiTurnDriver();
    const round = createRound();
    const request = {
      round,
      personality: 'shooter' as const,
      killsByPlayerId: NO_KILLS,
      elapsedSeconds: FRAME_SECONDS,
    };

    driver.advance({ ...request, elapsedSeconds: AI_THINKING_SECONDS });

    let movingFrames = 0;
    let firedFrames = 0;

    for (let frame = 0; frame < 600; frame++) {
      const step = driver.advance(request);

      if (step.isFireRequested) {
        firedFrames++;
        break;
      }

      if (step.aim !== undefined) {
        round.setAim(step.aim);
        movingFrames++;
      }
    }

    expect(movingFrames).toBeGreaterThan(1);
    expect(firedFrames).toBe(1);
  });

  it('always picks a weapon the tank can actually fire', () => {
    const driver = new AiTurnDriver();
    const round = createRound();

    driver.advance({
      round,
      personality: 'moron',
      killsByPlayerId: NO_KILLS,
      elapsedSeconds: AI_THINKING_SECONDS,
    });

    const step = driver.advance({
      round,
      personality: 'moron',
      killsByPlayerId: NO_KILLS,
      elapsedSeconds: 10,
    });

    expect(step.weaponId).toBe('baby-missile');
  });

  it('forgets its plan when reset between matches', () => {
    const driver = new AiTurnDriver();
    const round = createRound();
    const request = {
      round,
      personality: 'shooter' as const,
      killsByPlayerId: NO_KILLS,
      elapsedSeconds: FRAME_SECONDS,
    };

    driver.advance(request);
    driver.reset();

    expect(driver.advance(request).isThinking).toBe(true);
  });
});
