import { describe, expect, it } from 'vitest';

import type { IBulletContext } from './bullets';
import {
  countAliveBullets,
  createBullet,
  getBulletSpeedWuPerSecond,
  getEnemyBulletTraits,
  getMaxBulletsForStarLevel,
  getPlayerBulletTraits,
  isFireRisingEdge,
  stepBullets,
} from './bullets';
import {
  BULLET_SIZE_WU,
  BULLET_SPEED_FAST_WU_PER_SECOND,
  BULLET_SPEED_SLOW_WU_PER_SECOND,
  CELL_SIZE_WU,
  MAX_BULLETS_DEFAULT,
  MAX_BULLETS_UPGRADED,
  TANK_SIZE_WU,
} from './constants';
import { createFieldGeometry, getFieldCellCount } from './field';
import { BRICK_CELL, EAGLE_CELL, EMPTY_CELL, STEEL_CELL, Terrain } from './terrain';
import type { Bullet, Direction, TankRef, TerrainCell } from './types';

const TEST_FIELD_TILES = 13;
const TEST_GEOMETRY = createFieldGeometry(TEST_FIELD_TILES, TEST_FIELD_TILES);
const SHOOTER_X = 16;
const SHOOTER_Y = 16;
const WALL_CELL_X = 4;
const PLAYER_REF: TankRef = { side: 'player', slot: 0 };
const ENEMY_REF: TankRef = { side: 'enemy', slot: 0 };

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

function createWallTerrain(cell: TerrainCell): Terrain {
  return createTerrain(
    new Map([
      [`${WALL_CELL_X}:2`, cell],
      [`${WALL_CELL_X}:3`, cell],
    ])
  );
}

function createContext(
  terrain: Terrain = createTerrain(),
  targets: IBulletContext['targets'] = []
) {
  return { terrain, targets };
}

function createPlayerBullet(overrides: Partial<Bullet> = {}): Bullet {
  return {
    ...createBullet({
      id: 1,
      owner: PLAYER_REF,
      direction: 'right',
      traits: getPlayerBulletTraits(0),
      tankPositionX: SHOOTER_X,
      tankPositionY: SHOOTER_Y,
    }),
    ...overrides,
  };
}

describe('bullet traits', () => {
  it('follows the star ladder: fast at 1★, second slot at 2★, piercing at 3★', () => {
    expect(getPlayerBulletTraits(0)).toEqual({ fast: false, piercing: false });
    expect(getPlayerBulletTraits(1)).toEqual({ fast: true, piercing: false });
    expect(getPlayerBulletTraits(2)).toEqual({ fast: true, piercing: false });
    expect(getPlayerBulletTraits(3)).toEqual({ fast: true, piercing: true });

    expect(getMaxBulletsForStarLevel(0)).toBe(MAX_BULLETS_DEFAULT);
    expect(getMaxBulletsForStarLevel(1)).toBe(MAX_BULLETS_DEFAULT);
    expect(getMaxBulletsForStarLevel(2)).toBe(MAX_BULLETS_UPGRADED);
    expect(getMaxBulletsForStarLevel(3)).toBe(MAX_BULLETS_UPGRADED);
  });

  it('gives only the power tier a fast bullet and no enemy a piercing one', () => {
    expect(getEnemyBulletTraits('power')).toEqual({ fast: true, piercing: false });
    expect(getEnemyBulletTraits('basic')).toEqual({ fast: false, piercing: false });
    expect(getEnemyBulletTraits('fast')).toEqual({ fast: false, piercing: false });
    expect(getEnemyBulletTraits('armor')).toEqual({ fast: false, piercing: false });
  });

  it('maps traits to the two speed tiers, piercing included', () => {
    expect(getBulletSpeedWuPerSecond({ fast: false, piercing: false })).toBe(
      BULLET_SPEED_SLOW_WU_PER_SECOND
    );
    expect(getBulletSpeedWuPerSecond({ fast: true, piercing: false })).toBe(
      BULLET_SPEED_FAST_WU_PER_SECOND
    );
    expect(getBulletSpeedWuPerSecond({ fast: true, piercing: true })).toBe(
      BULLET_SPEED_FAST_WU_PER_SECOND
    );
  });
});

describe('isFireRisingEdge', () => {
  it('fires once per press, never while held', () => {
    expect(isFireRisingEdge(false, true)).toBe(true);
    expect(isFireRisingEdge(true, true)).toBe(false);
    expect(isFireRisingEdge(true, false)).toBe(false);
    expect(isFireRisingEdge(false, false)).toBe(false);
  });
});

describe('countAliveBullets', () => {
  it('counts only living bullets of the given owner', () => {
    const bullets: Bullet[] = [
      createPlayerBullet({ id: 1 }),
      createPlayerBullet({ id: 2, isAlive: false }),
      createPlayerBullet({ id: 3, owner: ENEMY_REF }),
    ];

    expect(countAliveBullets(bullets, PLAYER_REF)).toBe(1);
    expect(countAliveBullets(bullets, ENEMY_REF)).toBe(1);
  });
});

describe('createBullet', () => {
  it('leaves the muzzle centered on the tank', () => {
    const centerOffset = (TANK_SIZE_WU - BULLET_SIZE_WU) / 2;

    const rightBullet = createPlayerBullet();
    expect(rightBullet.positionX).toBe(SHOOTER_X + TANK_SIZE_WU - BULLET_SIZE_WU);
    expect(rightBullet.positionY).toBe(SHOOTER_Y + Math.floor(centerOffset));

    const upBullet = createBullet({
      id: 2,
      owner: PLAYER_REF,
      direction: 'up',
      traits: getPlayerBulletTraits(0),
      tankPositionX: SHOOTER_X,
      tankPositionY: SHOOTER_Y,
    });
    expect(upBullet.positionY).toBe(SHOOTER_Y);
    expect(upBullet.positionX).toBe(SHOOTER_X + Math.floor(centerOffset));
  });
});

describe('stepBullets', () => {
  it('advances a slow bullet by exactly 2 wu per tick', () => {
    const bullet = createPlayerBullet();
    const startX = bullet.positionX;

    stepBullets([bullet], createContext());

    expect(bullet.positionX - startX).toBe(BULLET_SPEED_SLOW_WU_PER_SECOND / 60);
  });

  it('damages brick and dies on impact', () => {
    const terrain = createWallTerrain(BRICK_CELL);
    const bullet = createPlayerBullet();

    const hits = stepBullets([bullet], createContext(terrain));

    expect(bullet.isAlive).toBe(false);
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe('terrain');
    expect(terrain.getCell(WALL_CELL_X, 2).topLeft).toBe(false);
    expect(terrain.getCell(WALL_CELL_X, 2).topRight).toBe(true);
  });

  it('clangs off steel without damage', () => {
    const terrain = createWallTerrain(STEEL_CELL);
    const bullet = createPlayerBullet();

    const [hit] = stepBullets([bullet], createContext(terrain));

    expect(hit.kind).toBe('terrain');
    expect(hit.kind === 'terrain' && hit.hitSteel).toBe(true);
    expect(terrain.getKind(WALL_CELL_X, 2)).toBe('steel');
  });

  it('reports an eagle hit', () => {
    const terrain = createWallTerrain(EAGLE_CELL);
    const bullet = createPlayerBullet();

    const [hit] = stepBullets([bullet], createContext(terrain));

    expect(hit.kind).toBe('eagle');
  });

  it('dies at the field edge', () => {
    const bullet = createPlayerBullet({ direction: 'left', positionX: 0, positionY: 100 });

    const [hit] = stepBullets([bullet], createContext());

    expect(bullet.isAlive).toBe(false);
    expect(hit.kind === 'terrain' && hit.hitBorder).toBe(true);
  });

  it('never tunnels through a wall at the fast speed', () => {
    const terrain = createWallTerrain(BRICK_CELL);
    const bullet = createPlayerBullet({
      traits: { fast: true, piercing: false },
      speedWuPerSecond: BULLET_SPEED_FAST_WU_PER_SECOND,
    });

    stepBullets([bullet], createContext(terrain));

    expect(bullet.isAlive).toBe(false);
    expect(bullet.positionX + BULLET_SIZE_WU - 1).toBe(WALL_CELL_X * CELL_SIZE_WU);
  });

  it('annihilates opposing bullets and leaves same-side bullets alone', () => {
    const playerBullet = createPlayerBullet({ id: 1, direction: 'right' });
    const enemyBullet = createPlayerBullet({
      id: 2,
      owner: ENEMY_REF,
      direction: 'left',
      positionX: playerBullet.positionX + BULLET_SIZE_WU,
      positionY: playerBullet.positionY,
    });

    const hits = stepBullets([playerBullet, enemyBullet], createContext());

    expect(playerBullet.isAlive).toBe(false);
    expect(enemyBullet.isAlive).toBe(false);
    expect(hits.some(hit => hit.kind === 'bullet')).toBe(true);
  });

  it('lets enemy bullets pass through each other', () => {
    const first = createPlayerBullet({ id: 1, owner: ENEMY_REF, direction: 'right' });
    const second = createPlayerBullet({
      id: 2,
      owner: { side: 'enemy', slot: 1 },
      direction: 'left',
      positionX: first.positionX + BULLET_SIZE_WU,
      positionY: first.positionY,
    });

    stepBullets([first, second], createContext());

    expect(first.isAlive).toBe(true);
    expect(second.isAlive).toBe(true);
  });

  it('hits tanks of the opposing side only', () => {
    const bullet = createPlayerBullet();
    const targets = [
      {
        ref: { side: 'player' as const, slot: 1 },
        positionX: SHOOTER_X + 16,
        positionY: SHOOTER_Y,
      },
      { ref: ENEMY_REF, positionX: SHOOTER_X + 16, positionY: SHOOTER_Y },
    ];

    const [hit] = stepBullets([bullet], createContext(createTerrain(), targets));

    expect(hit.kind).toBe('tank');
    expect(hit.kind === 'tank' && hit.target).toEqual(ENEMY_REF);
  });

  it('skips bullets that are already dead', () => {
    const bullet = createPlayerBullet({ isAlive: false });
    const startX = bullet.positionX;

    const hits = stepBullets([bullet], createContext());

    expect(hits).toHaveLength(0);
    expect(bullet.positionX).toBe(startX);
  });

  it('flies over water, ice and trees without stopping', () => {
    const bullet = createPlayerBullet({ direction: 'right' as Direction });
    const terrain = createTerrain(
      new Map([
        [`${WALL_CELL_X}:2`, EMPTY_CELL],
        [`${WALL_CELL_X}:3`, EMPTY_CELL],
      ])
    );

    stepBullets([bullet], createContext(terrain));

    expect(bullet.isAlive).toBe(true);
  });
});
