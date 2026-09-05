import type { EnemyType, PowerUpType, QuadrantSelection } from '../../domain/types';

/** Every variant differing in art or palette is a separate atlas entry. */
export const FIELD_BACKGROUND_SPRITE_ID = 'field-background';
export const STEEL_SPRITE_ID = 'terrain-steel';
export const WATER_SPRITE_ID = 'terrain-water';
export const ICE_SPRITE_ID = 'terrain-ice';
export const TREES_SPRITE_ID = 'terrain-trees';
export const EAGLE_SPRITE_ID = 'eagle-intact';
export const EAGLE_DESTROYED_SPRITE_ID = 'eagle-destroyed';
export const BULLET_SPRITE_ID = 'bullet';

function toQuadrantFlag(isStanding: boolean): string {
  return isStanding ? '1' : '0';
}

export function getBrickSpriteId(quadrants: QuadrantSelection): string {
  const flags = [
    toQuadrantFlag(quadrants.topLeft),
    toQuadrantFlag(quadrants.topRight),
    toQuadrantFlag(quadrants.bottomLeft),
    toQuadrantFlag(quadrants.bottomRight),
  ].join('');

  return `terrain-brick-${flags}`;
}

export function getPlayerTankSpriteId(
  playerSlot: number,
  starLevel: number,
  frameIndex: number
): string {
  return `player-tank-${playerSlot}-star${starLevel}-frame${frameIndex}`;
}

export function getEnemyTankSpriteId(
  enemyType: EnemyType,
  paletteName: string,
  frameIndex: number
): string {
  return `enemy-tank-${enemyType}-${paletteName}-frame${frameIndex}`;
}

export function getDigitSpriteId(digit: number): string {
  return `digit-${digit}`;
}

export function getPowerUpSpriteId(powerUpType: PowerUpType): string {
  return `power-up-${powerUpType}`;
}

export function getSpawnTwinkleSpriteId(frameIndex: number): string {
  return `spawn-twinkle-frame${frameIndex}`;
}

export function getShieldSpriteId(frameIndex: number): string {
  return `shield-frame${frameIndex}`;
}

export function getSmallExplosionSpriteId(frameIndex: number): string {
  return `explosion-small-frame${frameIndex}`;
}

export function getLargeExplosionSpriteId(frameIndex: number): string {
  return `explosion-large-frame${frameIndex}`;
}
