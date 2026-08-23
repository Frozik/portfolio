import { describe, expect, it } from 'vitest';

import {
  CELL_SIZE_WU,
  ICE_SLIDE_BUDGET_WU,
  ICE_SLIDE_INPUT_LOCK_WU,
  TANK_SIZE_WU,
  TANK_SPEED_FAST_WU_PER_SECOND,
  TANK_SPEED_PLAYER_WU_PER_SECOND,
  TANK_SPEED_REGULAR_WU_PER_SECOND,
  TICKS_PER_SECOND,
} from './constants';
import { createFieldGeometry, getFieldCellCount } from './field';
import type { IMovementContext } from './movement';
import {
  accumulateMovementSteps,
  advanceTank,
  boxesOverlap,
  canTankOccupy,
  isTankOnIce,
  snapCoordinateOnTurn,
  stepTank,
  updatePlayerMovement,
} from './movement';
import { BRICK_CELL, createTerrainCell, EMPTY_CELL, ICE_CELL, Terrain } from './terrain';
import type { Direction, PlayerInputs, PlayerTank, TerrainCell } from './types';

const TEST_FIELD_TILES = 13;
const TEST_GEOMETRY = createFieldGeometry(TEST_FIELD_TILES, TEST_FIELD_TILES);
const PLAYER_START_X = 64;
const PLAYER_START_Y = 96;

function createTerrain(overrides: ReadonlyMap<string, TerrainCell> = new Map()): Terrain {
  const cells: TerrainCell[] = new Array<TerrainCell>(getFieldCellCount(TEST_GEOMETRY)).fill(
    EMPTY_CELL
  );

  for (const [key, cell] of overrides) {
    const [cellX, cellY] = key.split(':').map(Number);
    cells[cellY * TEST_GEOMETRY.cellColumns + cellX] = cell;
  }

  return new Terrain(cells, TEST_GEOMETRY);
}

function createIceTerrain(): Terrain {
  return new Terrain(
    new Array<TerrainCell>(getFieldCellCount(TEST_GEOMETRY)).fill(ICE_CELL),
    TEST_GEOMETRY
  );
}

function createContext(terrain: Terrain = createTerrain()): IMovementContext {
  return { terrain, blockers: [] };
}

function createPlayer(overrides: Partial<PlayerTank> = {}): PlayerTank {
  return {
    slot: 0,
    isActive: true,
    positionX: PLAYER_START_X,
    positionY: PLAYER_START_Y,
    direction: 'up',
    movementRemainder: 0,
    starLevel: 0,
    shieldTicksRemaining: 0,
    isIceSliding: false,
    iceSlideDirection: 'up',
    iceSlideBudgetWu: 0,
    ...overrides,
  };
}

function drive(direction: Direction | undefined, fire = false): PlayerInputs {
  return { direction, fire };
}

describe('snapCoordinateOnTurn', () => {
  it('rounds to the nearest 8 wu boundary', () => {
    const table: readonly (readonly [number, number])[] = [
      [0, 0],
      [1, 0],
      [3, 0],
      [4, 8],
      [7, 8],
      [8, 8],
      [11, 8],
      [12, 16],
      [191, 192],
      [192, 192],
    ];

    for (const [input, expected] of table) {
      expect(snapCoordinateOnTurn(input)).toBe(expected);
    }
  });
});

describe('accumulateMovementSteps', () => {
  it.each([
    [TANK_SPEED_REGULAR_WU_PER_SECOND],
    [TANK_SPEED_PLAYER_WU_PER_SECOND],
    [TANK_SPEED_FAST_WU_PER_SECOND],
  ])('yields exactly %i wu per second without drift', speedWuPerSecond => {
    let remainder = 0;
    let travelled = 0;

    for (let tick = 0; tick < TICKS_PER_SECOND * 10; tick++) {
      const result = accumulateMovementSteps(remainder, speedWuPerSecond);
      remainder = result.remainder;
      travelled += result.steps;
    }

    expect(travelled).toBe(speedWuPerSecond * 10);
  });

  it('never releases more than one step below 60 wu/s', () => {
    let remainder = 0;

    for (let tick = 0; tick < TICKS_PER_SECOND; tick++) {
      const result = accumulateMovementSteps(remainder, TANK_SPEED_PLAYER_WU_PER_SECOND);
      remainder = result.remainder;

      expect(result.steps).toBeLessThanOrEqual(1);
    }
  });
});

describe('canTankOccupy', () => {
  it('keeps the tank inside the field', () => {
    const context = createContext();

    expect(canTankOccupy(context, 0, 0)).toBe(true);
    expect(canTankOccupy(context, -1, 0)).toBe(false);
    expect(canTankOccupy(context, TEST_GEOMETRY.widthWu - TANK_SIZE_WU, 0)).toBe(true);
    expect(canTankOccupy(context, TEST_GEOMETRY.widthWu - TANK_SIZE_WU + 1, 0)).toBe(false);
  });

  it('is blocked by a partially destroyed brick cell', () => {
    const terrain = createTerrain(
      new Map([
        [
          '2:2',
          createTerrainCell('brick', {
            topLeft: true,
            topRight: false,
            bottomLeft: false,
            bottomRight: false,
          }),
        ],
      ])
    );

    expect(canTankOccupy(createContext(terrain), 16, 16)).toBe(false);
  });

  it('is blocked by another tank but not by an adjacent one', () => {
    const context: IMovementContext = {
      terrain: createTerrain(),
      blockers: [{ positionX: 32, positionY: 32 }],
    };

    expect(canTankOccupy(context, 32 + TANK_SIZE_WU - 1, 32)).toBe(false);
    expect(canTankOccupy(context, 32 + TANK_SIZE_WU, 32)).toBe(true);
  });
});

describe('stepTank', () => {
  it('stops one wu before a wall instead of tunnelling through it', () => {
    const terrain = createTerrain(
      new Map([
        ['4:2', BRICK_CELL],
        ['4:3', BRICK_CELL],
      ])
    );
    const wallLeftEdge = 4 * CELL_SIZE_WU;

    const result = stepTank(
      createContext(terrain),
      wallLeftEdge - TANK_SIZE_WU - 4,
      16,
      'right',
      8
    );

    expect(result.positionX).toBe(wallLeftEdge - TANK_SIZE_WU);
    expect(result.stepsMoved).toBe(4);
    expect(result.isBlocked).toBe(true);
  });

  it('reports no movement and no block when there are no steps to take', () => {
    const result = stepTank(createContext(), 16, 16, 'right', 0);

    expect(result).toEqual({ positionX: 16, positionY: 16, stepsMoved: 0, isBlocked: false });
  });
});

describe('boxesOverlap', () => {
  it('treats touching boxes as free', () => {
    expect(boxesOverlap(0, 0, TANK_SIZE_WU, 0, TANK_SIZE_WU)).toBe(false);
    expect(boxesOverlap(0, 0, TANK_SIZE_WU - 1, 0, TANK_SIZE_WU)).toBe(true);
  });
});

describe('advanceTank', () => {
  it('snaps both coordinates on a 90° turn', () => {
    const tank = {
      positionX: 19,
      positionY: 27,
      direction: 'up' as Direction,
      movementRemainder: 0,
    };

    advanceTank(tank, 'right', 0, createContext());

    expect(tank.positionX).toBe(16);
    expect(tank.positionY).toBe(24);
  });

  it('does not snap when keeping or reversing the direction', () => {
    const tank = {
      positionX: 19,
      positionY: 27,
      direction: 'up' as Direction,
      movementRemainder: 0,
    };

    advanceTank(tank, 'up', 0, createContext());
    expect(tank.positionX).toBe(19);

    advanceTank(tank, 'down', 0, createContext());
    expect(tank.positionX).toBe(19);
    expect(tank.positionY).toBe(27);
  });
});

describe('updatePlayerMovement', () => {
  it('moves at exactly the player speed while a direction is held', () => {
    const player = createPlayer();
    const context = createContext();

    for (let tick = 0; tick < TICKS_PER_SECOND; tick++) {
      updatePlayerMovement(player, drive('right'), context);
    }

    expect(player.positionX - PLAYER_START_X).toBe(TANK_SPEED_PLAYER_WU_PER_SECOND);
    expect(player.positionY).toBe(PLAYER_START_Y);
  });

  it('stands still without input on solid ground', () => {
    const player = createPlayer();
    const context = createContext();

    updatePlayerMovement(player, drive('right'), context);
    const positionAfterDriving = player.positionX;

    for (let tick = 0; tick < 10; tick++) {
      updatePlayerMovement(player, drive(undefined), context);
    }

    expect(player.positionX).toBe(positionAfterDriving);
    expect(player.isIceSliding).toBe(false);
  });
});

describe('updatePlayerMovement on ice', () => {
  it('coasts the full slide budget after the input is released', () => {
    const player = createPlayer();
    const context = createContext(createIceTerrain());

    for (let tick = 0; tick < 10; tick++) {
      updatePlayerMovement(player, drive('right'), context);
    }

    expect(player.iceSlideBudgetWu).toBe(ICE_SLIDE_BUDGET_WU);
    const positionAtRelease = player.positionX;

    for (let tick = 0; tick < 200; tick++) {
      updatePlayerMovement(player, drive(undefined), context);
    }

    expect(player.positionX - positionAtRelease).toBe(ICE_SLIDE_BUDGET_WU);
    expect(player.isIceSliding).toBe(false);
  });

  it('ignores steering for the first 13 wu of the coast', () => {
    const player = createPlayer();
    const context = createContext(createIceTerrain());

    for (let tick = 0; tick < 10; tick++) {
      updatePlayerMovement(player, drive('right'), context);
    }

    const positionAtRelease = player.positionX;
    let slideBeforeTurn: number | undefined;

    for (let tick = 0; tick < 200 && slideBeforeTurn === undefined; tick++) {
      const previousX = player.positionX;

      updatePlayerMovement(player, drive('up'), context);

      if (player.positionY !== PLAYER_START_Y) {
        slideBeforeTurn = previousX - positionAtRelease;
      }
    }

    expect(slideBeforeTurn).toBeGreaterThanOrEqual(ICE_SLIDE_INPUT_LOCK_WU);
    expect(slideBeforeTurn).toBeLessThan(ICE_SLIDE_BUDGET_WU);
  });

  it('stops the coast at a wall', () => {
    const wallCellX = 11;
    const terrain = createIceTerrain();
    for (let cellY = 0; cellY < TEST_GEOMETRY.cellRows; cellY++) {
      terrain.setCell(wallCellX, cellY, BRICK_CELL);
    }
    const context = createContext(terrain);
    const player = createPlayer();

    for (let tick = 0; tick < 10; tick++) {
      updatePlayerMovement(player, drive('right'), context);
    }
    for (let tick = 0; tick < 200; tick++) {
      updatePlayerMovement(player, drive(undefined), context);
    }

    expect(player.positionX).toBe(wallCellX * CELL_SIZE_WU - TANK_SIZE_WU);
    expect(player.isIceSliding).toBe(false);
  });

  it('does not coast when the tank left the ice', () => {
    const terrain = createIceTerrain();
    for (let cellX = 10; cellX < TEST_GEOMETRY.cellColumns; cellX++) {
      for (let cellY = 0; cellY < TEST_GEOMETRY.cellRows; cellY++) {
        terrain.setCell(cellX, cellY, EMPTY_CELL);
      }
    }
    const context = createContext(terrain);
    const player = createPlayer({ positionX: 64 });

    for (let tick = 0; tick < TICKS_PER_SECOND; tick++) {
      updatePlayerMovement(player, drive('right'), context);
    }

    expect(isTankOnIce(terrain, player.positionX, player.positionY)).toBe(false);
    expect(player.iceSlideBudgetWu).toBe(0);

    const positionAtRelease = player.positionX;
    updatePlayerMovement(player, drive(undefined), context);

    expect(player.positionX).toBe(positionAtRelease);
  });

  it('re-arms the budget while driving on ice', () => {
    const player = createPlayer();
    const context = createContext(createIceTerrain());

    updatePlayerMovement(player, drive('right'), context);
    expect(player.iceSlideBudgetWu).toBe(ICE_SLIDE_BUDGET_WU);

    updatePlayerMovement(player, drive(undefined), context);
    expect(player.iceSlideBudgetWu).toBeLessThan(ICE_SLIDE_BUDGET_WU);

    updatePlayerMovement(player, drive('right'), context);
    expect(player.iceSlideBudgetWu).toBe(ICE_SLIDE_BUDGET_WU);
  });
});
