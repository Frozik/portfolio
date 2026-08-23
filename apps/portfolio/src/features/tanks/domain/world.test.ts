import { isNil, random } from 'lodash-es';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ENEMIES_PER_STAGE,
  ENEMY_CRUISE_DECISION_DENOMINATOR,
  ENEMY_FIRE_DENOMINATOR,
  ENEMY_SPAWN_TWINKLE_TICKS,
  INITIAL_LIVES,
  MAX_ENEMIES_ON_FIELD,
  POWER_UP_SIZE_WU,
  TANK_SIZE_WU,
  TANK_SPEED_PLAYER_WU_PER_SECOND,
  TICKS_PER_SECOND,
} from './constants';
import type { Direction, PlayerInputs, TerrainKind, WorldEvent } from './types';
import { TanksWorld } from './world';

vi.mock('lodash-es', async importOriginal => {
  const actual = await importOriginal<typeof import('lodash-es')>();

  return { ...actual, random: vi.fn() };
});

const actualLodash = await vi.importActual<typeof import('lodash-es')>('lodash-es');
const randomMock = vi.mocked(random);

/** A draw that misses every 1-in-N branch: no re-decisions, no enemy fire, brake when blocked. */
const QUIET_DRAW = 1;
const SMOKE_TEST_TICKS = 10000;
const IDLE: PlayerInputs = { direction: undefined, fire: false };
/** A dropped bonus must always be reachable — never inside steel, water or the eagle. */
const POWER_UP_FORBIDDEN_KINDS: readonly TerrainKind[] = ['steel', 'water', 'eagle'];

/** Enemies cruise straight down and never shoot — the world becomes fully scriptable. */
function useQuietRandom(): void {
  randomMock.mockReset();
  randomMock.mockReturnValue(QUIET_DRAW);
}

/** Enemies re-decide constantly (so they chase and hunt) and fire whenever their slot is free. */
function useAggressiveRandom(): void {
  randomMock.mockReset();
  randomMock.mockImplementation(upper =>
    upper === ENEMY_CRUISE_DECISION_DENOMINATOR - 1 || upper === ENEMY_FIRE_DENOMINATOR - 1
      ? 0
      : QUIET_DRAW
  );
}

function useRealRandom(): void {
  randomMock.mockReset();
  randomMock.mockImplementation(upper => actualLodash.random(upper));
}

function drive(direction: Direction | undefined, fire = false): PlayerInputs {
  return { direction, fire };
}

function runTicks(
  world: TanksWorld,
  ticks: number,
  inputsForTick: (tick: number) => PlayerInputs = () => IDLE
): WorldEvent[] {
  const collected: WorldEvent[] = [];

  for (let tick = 0; tick < ticks; tick++) {
    collected.push(...world.tick(inputsForTick(tick)));
  }

  return collected;
}

beforeEach(() => {
  useQuietRandom();
});

describe('TanksWorld start of a stage', () => {
  it('starts stage 1 with a full campaign state', () => {
    const world = new TanksWorld();

    expect(world.status).toBe('playing');
    expect(world.stageNumber).toBe(1);
    expect(world.loop).toBe(1);
    expect(world.score).toBe(0);
    expect(world.lives).toBe(INITIAL_LIVES);
    expect(world.enemiesRemaining).toBe(ENEMIES_PER_STAGE);
    expect(world.isBaseDestroyed).toBe(false);
    expect(world.terrain.geometry.widthTiles).toBe(13);
  });

  it('keeps two player slots but drives only the first one', () => {
    const world = new TanksWorld();

    expect(world.players).toHaveLength(2);
    expect(world.players[0].isActive).toBe(true);
    expect(world.players[1].isActive).toBe(false);

    const startX = world.players[1].positionX;
    runTicks(world, 30, () => drive('left'));

    expect(world.players[0].positionX).toBeLessThan(64);
    expect(world.players[1].positionX).toBe(startX);
  });

  it('announces the stage and releases the first enemy on the very first tick', () => {
    const world = new TanksWorld();

    const events = world.tick(IDLE);

    expect(events.map(event => event.type)).toEqual(['stage-started', 'enemy-spawned']);
    expect(world.enemies).toHaveLength(1);
    expect(world.enemies[0].twinkleTicksRemaining).toBe(ENEMY_SPAWN_TWINKLE_TICKS - 1);
  });

  it('reuses the event buffer between ticks', () => {
    const world = new TanksWorld();

    const firstEvents = world.tick(IDLE);
    const secondEvents = world.tick(IDLE);

    expect(secondEvents).toBe(firstEvents);
    expect(secondEvents).toHaveLength(0);
  });

  it('spawns the player with a shield that runs out', () => {
    const world = new TanksWorld();
    const shieldAtStart = world.players[0].shieldTicksRemaining;

    runTicks(world, 10);

    expect(shieldAtStart).toBeGreaterThan(0);
    expect(world.players[0].shieldTicksRemaining).toBe(shieldAtStart - 10);
  });
});

describe('TanksWorld player control', () => {
  it('moves the player at the player speed', () => {
    const world = new TanksWorld();
    const startX = world.players[0].positionX;

    runTicks(world, TICKS_PER_SECOND, () => drive('left'));

    expect(startX - world.players[0].positionX).toBe(TANK_SPEED_PLAYER_WU_PER_SECOND);
  });

  it('fires on the rising edge only and respects the single bullet slot', () => {
    const world = new TanksWorld();

    world.tick(drive(undefined, true));
    expect(world.bullets).toHaveLength(1);

    world.tick(drive(undefined, true));
    expect(world.bullets).toHaveLength(1);

    world.tick(drive(undefined, false));
    world.tick(drive(undefined, true));
    expect(world.bullets.length).toBeLessThanOrEqual(1);
  });

  it('announces every shot with the tank that fired it', () => {
    const world = new TanksWorld();

    const events = world.tick(drive(undefined, true));
    const shot = events.find(event => event.type === 'bullet-fired');

    expect(shot?.owner).toEqual({ side: 'player', slot: 0 });
    // The event reports the muzzle; the bullet itself has already left it within the same tick.
    expect(shot?.position.x).toBe(world.bullets[0].positionX);
    expect(shot?.position.y).toBeGreaterThan(world.bullets[0].positionY);
  });

  it('announces the moment a coast on ice begins', () => {
    // Stage 28 lays ice immediately to the left of the first player's spawn.
    const world = new TanksWorld({ stageNumber: 28 });
    const drivingEvents = runTicks(world, 60, () => drive('left'));

    expect(drivingEvents.filter(event => event.type === 'player-ice-slide-started')).toHaveLength(
      0
    );

    const coastingEvents = runTicks(world, 2);

    expect(world.players[0].isIceSliding).toBe(true);
    expect(coastingEvents.filter(event => event.type === 'player-ice-slide-started')).toEqual([
      { type: 'player-ice-slide-started', playerSlot: 0 },
    ]);
  });
});

describe('TanksWorld base destruction', () => {
  it('ends the game when the player shoots through its own nest into the eagle', () => {
    const world = new TanksWorld();
    const events = runTicks(world, 600, tick => drive('right', tick % 8 < 4));

    expect(events.some(event => event.type === 'base-destroyed')).toBe(true);
    expect(events.some(event => event.type === 'game-over')).toBe(true);
    expect(world.isBaseDestroyed).toBe(true);
    expect(world.status).toBe('game-over');
  });

  it('stops simulating once the game is over', () => {
    const world = new TanksWorld();
    runTicks(world, 600, tick => drive('right', tick % 8 < 4));

    const enemiesAtGameOver = world.enemies.length;
    const positionAtGameOver = world.players[0].positionX;
    const events = runTicks(world, 100, () => drive('left'));

    expect(events).toHaveLength(0);
    expect(world.enemies).toHaveLength(enemiesAtGameOver);
    expect(world.players[0].positionX).toBe(positionAtGameOver);
  });
});

describe('TanksWorld lives', () => {
  it('ends the game when the last life is lost', () => {
    useAggressiveRandom();
    const world = new TanksWorld({ stageNumber: 20 });

    let deaths = 0;
    for (let tick = 0; tick < 4000 && world.status === 'playing'; tick++) {
      deaths += world.tick(IDLE).filter(event => event.type === 'player-destroyed').length;
    }

    expect(deaths).toBe(INITIAL_LIVES);
    expect(world.lives).toBe(0);
    expect(world.status).toBe('game-over');
  });
});

describe('TanksWorld stage flow', () => {
  it('refuses to advance while the stage is still running', () => {
    const world = new TanksWorld();
    world.tick(IDLE);

    expect(() => world.advanceToNextStage()).toThrow(/stage is not cleared/);
  });
});

describe('TanksWorld smoke run', () => {
  it('keeps every invariant over 10 000 ticks of real randomness', () => {
    useRealRandom();
    const world = new TanksWorld();
    const directions: readonly Direction[] = ['up', 'right', 'down', 'left'];
    let previousEnemiesRemaining = world.enemiesRemaining;
    let previousScore = world.score;
    let ticksPlayed = 0;

    for (let tick = 0; tick < SMOKE_TEST_TICKS; tick++) {
      const direction = directions[actualLodash.random(directions.length - 1)];
      world.tick(drive(direction, actualLodash.random(1) === 0));
      ticksPlayed++;

      const { widthWu, heightWu } = world.terrain.geometry;

      for (const player of world.players) {
        expect(player.positionX).toBeGreaterThanOrEqual(0);
        expect(player.positionX).toBeLessThanOrEqual(widthWu - TANK_SIZE_WU);
        expect(player.positionY).toBeGreaterThanOrEqual(0);
        expect(player.positionY).toBeLessThanOrEqual(heightWu - TANK_SIZE_WU);
        expect(Number.isInteger(player.positionX)).toBe(true);
        expect(player.starLevel).toBeLessThanOrEqual(3);
      }

      for (const enemy of world.enemies) {
        expect(enemy.positionX).toBeGreaterThanOrEqual(0);
        expect(enemy.positionX).toBeLessThanOrEqual(widthWu - TANK_SIZE_WU);
        expect(enemy.positionY).toBeGreaterThanOrEqual(0);
        expect(enemy.positionY).toBeLessThanOrEqual(heightWu - TANK_SIZE_WU);
        expect(enemy.hitPoints).toBeGreaterThan(0);
      }

      for (const bullet of world.bullets) {
        expect(bullet.isAlive).toBe(true);
        expect(bullet.positionX).toBeGreaterThan(-TANK_SIZE_WU);
        expect(bullet.positionX).toBeLessThan(widthWu + TANK_SIZE_WU);
      }

      const powerUp = world.powerUp;

      if (!isNil(powerUp)) {
        for (const kind of POWER_UP_FORBIDDEN_KINDS) {
          expect(
            world.terrain.isBoxOverKind(
              powerUp.positionX,
              powerUp.positionY,
              POWER_UP_SIZE_WU,
              kind
            )
          ).toBe(false);
        }
      }

      expect(world.enemies.length).toBeLessThanOrEqual(MAX_ENEMIES_ON_FIELD);
      expect(world.enemiesRemaining).toBeLessThanOrEqual(previousEnemiesRemaining);
      expect(world.score).toBeGreaterThanOrEqual(previousScore);
      expect(world.lives).toBeGreaterThanOrEqual(0);

      previousEnemiesRemaining = world.enemiesRemaining;
      previousScore = world.score;

      if (world.status === 'stage-cleared') {
        const clearedStage = world.stageNumber;
        world.advanceToNextStage();

        expect(world.stageNumber).not.toBe(clearedStage);
        previousEnemiesRemaining = world.enemiesRemaining;
      }

      if (world.status === 'game-over') {
        break;
      }
    }

    expect(ticksPlayed).toBeGreaterThan(0);
    expect(['playing', 'game-over']).toContain(world.status);
  });
});
