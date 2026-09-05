import type { Vector2 } from '@frozik/utils/math/vector2';

export type Direction = 'up' | 'down' | 'left' | 'right';

/** `fire` is a level signal; the world fires on its rising edge (§12.1). */
export interface PlayerInputs {
  readonly direction: Direction | undefined;
  readonly fire: boolean;
}

/** `border` is never stored — it is the answer to a query outside the playfield. */
export type TerrainKind =
  | 'empty'
  | 'brick'
  | 'steel'
  | 'water'
  | 'ice'
  | 'trees'
  | 'eagle'
  | 'border';

type QuadrantKey = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export type QuadrantSelection = Readonly<Record<QuadrantKey, boolean>>;

/** Immutable — damage replaces cells rather than mutating them. */
export interface TerrainCell extends QuadrantSelection {
  readonly kind: TerrainKind;
}

export type EnemyType = 'basic' | 'fast' | 'power' | 'armor';

export type PowerUpType = 'helmet' | 'clock' | 'shovel' | 'star' | 'grenade' | 'tank';

type TankSide = 'player' | 'enemy';

export interface TankRef {
  readonly side: TankSide;
  readonly slot: number;
}

/** Bullet property bits of the original: bit0 = fast, bit1 = piercing (§9.1). */
export interface IBulletTraits {
  readonly fast: boolean;
  readonly piercing: boolean;
}

export interface Bullet {
  readonly id: number;
  readonly owner: TankRef;
  readonly direction: Direction;
  readonly traits: IBulletTraits;
  readonly speedWuPerSecond: number;
  positionX: number;
  positionY: number;
  movementRemainder: number;
  isAlive: boolean;
}

export interface PlayerTank {
  readonly slot: number;
  isActive: boolean;
  positionX: number;
  positionY: number;
  direction: Direction;
  movementRemainder: number;
  starLevel: number;
  shieldTicksRemaining: number;
  isIceSliding: boolean;
  iceSlideDirection: Direction;
  iceSlideBudgetWu: number;
}

export interface EnemyTank {
  readonly slot: number;
  readonly type: EnemyType;
  readonly spawnIndex: number;
  readonly isPowerUpCarrier: boolean;
  positionX: number;
  positionY: number;
  direction: Direction;
  movementRemainder: number;
  hitPoints: number;
  twinkleTicksRemaining: number;
  brakeTicksRemaining: number;
}

export interface PowerUpDrop {
  readonly type: PowerUpType;
  readonly positionX: number;
  readonly positionY: number;
}

export interface StageDefinition {
  readonly stageNumber: number;
  readonly fieldWidthTiles: number;
  readonly fieldHeightTiles: number;
  /** `2 × fieldWidthTiles` by `2 × fieldHeightTiles` cells, row-major. */
  readonly terrain: readonly TerrainCell[];
  readonly enemyQueue: readonly EnemyType[];
}

export type BulletEndReason = 'terrain' | 'steel' | 'border' | 'eagle' | 'tank' | 'bullet';

export type WorldEvent =
  | { readonly type: 'stage-started'; readonly stageNumber: number }
  | {
      readonly type: 'enemy-spawned';
      readonly slot: number;
      readonly enemyType: EnemyType;
      readonly isPowerUpCarrier: boolean;
    }
  | {
      readonly type: 'enemy-destroyed';
      readonly enemyType: EnemyType;
      readonly position: Vector2;
      readonly points: number;
    }
  | { readonly type: 'player-destroyed'; readonly playerSlot: number; readonly position: Vector2 }
  | { readonly type: 'bullet-fired'; readonly owner: TankRef; readonly position: Vector2 }
  | {
      readonly type: 'bullet-ended';
      readonly position: Vector2;
      readonly reason: BulletEndReason;
    }
  | {
      readonly type: 'power-up-spawned';
      readonly powerUpType: PowerUpType;
      readonly position: Vector2;
    }
  | {
      readonly type: 'power-up-taken';
      readonly powerUpType: PowerUpType;
      readonly playerSlot: number;
      readonly position: Vector2;
    }
  | { readonly type: 'player-ice-slide-started'; readonly playerSlot: number }
  | { readonly type: 'score-awarded'; readonly points: number; readonly totalScore: number }
  | { readonly type: 'extra-life-awarded'; readonly totalLives: number }
  | { readonly type: 'base-destroyed' }
  | { readonly type: 'stage-cleared'; readonly stageNumber: number }
  | { readonly type: 'game-over' };
