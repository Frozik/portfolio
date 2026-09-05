import type { EnemyType, PowerUpType } from './types';

export const TILE_SIZE_WU = 16;
/** Movement/collision half-tile grid — the ROM aligns AI decisions and turns to it. */
export const CELL_SIZE_WU = 8;
export const TILE_CELL_SPAN = TILE_SIZE_WU / CELL_SIZE_WU;
/** Brick damage granularity: every 8-wu cell is a 2 × 2 grid of 4-wu quadrants. */
export const CELL_QUADRANT_SIZE_WU = CELL_SIZE_WU / 2;
/** Smallest playfield that still fits a base, its nest and room to drive around them. */
export const MIN_FIELD_TILES = 7;
export const TANK_SIZE_WU = 16;
export const BULLET_SIZE_WU = 3;

export const TICKS_PER_SECOND = 60;

/** Original: player moves on 3 of every 4 frames × 1 wu. Stars never change it. */
export const TANK_SPEED_PLAYER_WU_PER_SECOND = 45;
/** Original: 1 wu every other frame (basic / power / armor). */
export const TANK_SPEED_REGULAR_WU_PER_SECOND = 30;
/** Original: 1 wu every frame (the 200-pt "fast" tier). */
export const TANK_SPEED_FAST_WU_PER_SECOND = 60;

/** Full slide length of the player-only ice coast. */
export const ICE_SLIDE_BUDGET_WU = 28;
/** Leading part of the coast during which steering input is ignored. */
export const ICE_SLIDE_INPUT_LOCK_WU = 13;

/** Original: 2 wu every frame. */
export const BULLET_SPEED_SLOW_WU_PER_SECOND = 120;
/** Original: the move routine runs twice per frame — piercing bullets fly at this speed too. */
export const BULLET_SPEED_FAST_WU_PER_SECOND = 240;
/** Perpendicular width of a bullet impact strip — one tank width, two 8-wu cells. */
export const BULLET_IMPACT_STRIP_WIDTH_WU = TANK_SIZE_WU;

export const MIN_STAR_LEVEL = 0;
export const MAX_STAR_LEVEL = 3;
export const FAST_BULLET_STAR_LEVEL = 1;
export const SECOND_BULLET_SLOT_STAR_LEVEL = 2;
export const PIERCING_BULLET_STAR_LEVEL = 3;
export const MAX_BULLETS_DEFAULT = 1;
export const MAX_BULLETS_UPGRADED = 2;

export const PLAYER_SLOT_COUNT = 2;
export const INITIAL_LIVES = 3;
/** Players start this many tiles to the left and right of the base. */
export const PLAYER_SPAWN_TILE_OFFSET = 2;

export const ENEMY_SPAWN_POSITION_Y_WU = 0;

export const STAGE_COUNT = 35;
export const ENEMIES_PER_STAGE = 20;
export const MAX_ENEMIES_ON_FIELD = 4;
/** Spawn-order positions that flash and drop a power-up — a rule, not level data. */
export const POWER_UP_CARRIER_SPAWN_INDICES: readonly number[] = [3, 10, 17];
/** Exactly the twinkle's length — the enemy turns collidable the tick the last star leaves (§11.5). */
export const ENEMY_SPAWN_TWINKLE_TICKS = 56;

/** Spawn interval `I = 190 − 4 × stage` ticks. */
export const SPAWN_INTERVAL_BASE_TICKS = 190;
export const SPAWN_INTERVAL_PER_STAGE_TICKS = 4;
/** From the second loop onward every stage uses this interval. */
export const SPAWN_INTERVAL_LOOPED_TICKS = 50;

export const ENEMY_SPEED_BY_TYPE_WU_PER_SECOND: Readonly<Record<EnemyType, number>> = {
  basic: TANK_SPEED_REGULAR_WU_PER_SECOND,
  fast: TANK_SPEED_FAST_WU_PER_SECOND,
  power: TANK_SPEED_REGULAR_WU_PER_SECOND,
  armor: TANK_SPEED_REGULAR_WU_PER_SECOND,
};

export const ENEMY_HIT_POINTS_BY_TYPE: Readonly<Record<EnemyType, number>> = {
  basic: 1,
  fast: 1,
  power: 1,
  armor: 4,
};

export const ENEMY_POINTS_BY_TYPE: Readonly<Record<EnemyType, number>> = {
  basic: 100,
  fast: 200,
  power: 300,
  armor: 400,
};

/** Chance denominators of the ROM's per-tick draws. */
export const ENEMY_CRUISE_DECISION_DENOMINATOR = 16;
export const ENEMY_FIRE_DENOMINATOR = 32;
export const ENEMY_BLOCKED_REACTION_DENOMINATOR = 4;
/** The single draw value out of four that reverses instead of braking. */
export const ENEMY_BLOCKED_REVERSE_DRAW = 3;
export const ENEMY_BRAKE_TICKS = 8;
export const AGGRESSION_CHASE_PHASE_INTERVAL_MULTIPLIER = 8;
export const AGGRESSION_HUNT_PHASE_INTERVAL_MULTIPLIER = 16;

/** The ROM's 8-entry table — the duplicated entries make star and grenade twice as likely. */
export const POWER_UP_TYPE_TABLE: readonly PowerUpType[] = [
  'helmet',
  'clock',
  'shovel',
  'star',
  'grenade',
  'tank',
  'grenade',
  'star',
];

/** Power-ups land on a 4 × 4 grid of fixed spots, one axis drawn independently of the other. */
export const POWER_UP_GRID_STEPS = 4;
/**
 * The ROM's spots are screen coordinates and the playfield starts at screen (16, 8); the
 * authentic half-tile row offset is also what keeps a bonus off the eagle.
 */
export const POWER_UP_GRID_ANCHOR_OFFSET_X_WU = TILE_SIZE_WU;
export const POWER_UP_GRID_ANCHOR_OFFSET_Y_WU = TILE_SIZE_WU / 2;
export const POWER_UP_SIZE_WU = TILE_SIZE_WU;
/** The ROM re-rolls forever; we bound the loop — 16 spots and at most 6 tanks cannot starve it. */
export const POWER_UP_POSITION_ROLL_ATTEMPTS = 32;

export const HELMET_DURATION_TICKS = 640;
export const CLOCK_FREEZE_DURATION_TICKS = 640;
const SHOVEL_SOLID_TICKS = 1024;
/** Warning phase: the walls blink between steel and brick before reverting. */
export const SHOVEL_FLASHING_TICKS = 256;
export const SHOVEL_FLASH_TOGGLE_TICKS = 16;
export const SHOVEL_TOTAL_TICKS = SHOVEL_SOLID_TICKS + SHOVEL_FLASHING_TICKS;
export const SPAWN_SHIELD_TICKS = 192;

export const POWER_UP_PICKUP_POINTS = 500;
export const EXTRA_LIFE_SCORE_THRESHOLD = 20000;
