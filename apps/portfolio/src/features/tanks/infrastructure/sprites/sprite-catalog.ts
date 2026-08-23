import { MAX_STAR_LEVEL, MIN_STAR_LEVEL, PLAYER_SLOT_COUNT } from '../../domain/constants';
import type { EnemyType, PowerUpType } from '../../domain/types';
import { DIGIT_BITMAPS } from './digit-bitmaps';
import {
  BULLET_BITMAP,
  LARGE_EXPLOSION_BITMAPS,
  SHIELD_BITMAPS,
  SMALL_EXPLOSION_BITMAPS,
  SPAWN_TWINKLE_BITMAPS,
} from './effect-bitmaps';
import {
  BRICK_PALETTE,
  BULLET_PALETTE,
  createPlayerTankPalette,
  EAGLE_DESTROYED_PALETTE,
  EAGLE_PALETTE,
  EXPLOSION_PALETTE,
  FIELD_BACKGROUND_PALETTE,
  getEnemyPalette,
  ICE_PALETTE,
  listEnemyPaletteNames,
  POWER_UP_PALETTE,
  SCORE_POPUP_PALETTE,
  SHIELD_PALETTE,
  SPAWN_TWINKLE_PALETTE,
  STEEL_PALETTE,
  TREES_PALETTE,
  WATER_PALETTE,
} from './palettes';
import { POWER_UP_BITMAPS } from './power-up-bitmaps';
import {
  BULLET_SPRITE_ID,
  EAGLE_DESTROYED_SPRITE_ID,
  EAGLE_SPRITE_ID,
  FIELD_BACKGROUND_SPRITE_ID,
  getBrickSpriteId,
  getDigitSpriteId,
  getEnemyTankSpriteId,
  getLargeExplosionSpriteId,
  getPlayerTankSpriteId,
  getPowerUpSpriteId,
  getShieldSpriteId,
  getSmallExplosionSpriteId,
  getSpawnTwinkleSpriteId,
  ICE_SPRITE_ID,
  STEEL_SPRITE_ID,
  TREES_SPRITE_ID,
  WATER_SPRITE_ID,
} from './sprite-ids';
import type { SpriteBitmap, SpriteCatalog, SpriteDefinition, SpritePalette } from './sprite-types';
import {
  ARMOR_ENEMY_HULL,
  BASIC_ENEMY_HULL,
  createTankBitmap,
  FAST_ENEMY_HULL,
  PLAYER_TANK_HULL,
  POWER_ENEMY_HULL,
  TANK_TRACK_FRAME_COUNT,
} from './tank-bitmaps';
import {
  createBrickBitmap,
  EAGLE_BITMAP,
  EAGLE_DESTROYED_BITMAP,
  FIELD_BACKGROUND_BITMAP,
  ICE_BITMAP,
  listBrickQuadrantVariants,
  STEEL_BITMAP,
  TREES_BITMAP,
  WATER_BITMAP,
  WATER_FRAME_COUNT,
} from './terrain-bitmaps';

const STILL_FRAME_COUNT = 1;

const ENEMY_TYPES: readonly EnemyType[] = ['basic', 'fast', 'power', 'armor'];

const POWER_UP_TYPES: readonly PowerUpType[] = [
  'helmet',
  'clock',
  'shovel',
  'star',
  'grenade',
  'tank',
];

const ENEMY_HULLS: Readonly<Record<EnemyType, SpriteBitmap>> = {
  basic: BASIC_ENEMY_HULL,
  fast: FAST_ENEMY_HULL,
  power: POWER_ENEMY_HULL,
  armor: ARMOR_ENEMY_HULL,
};

function addSprite(
  catalog: Map<string, SpriteDefinition>,
  id: string,
  bitmap: SpriteBitmap,
  palette: SpritePalette,
  frameCount: number = STILL_FRAME_COUNT
): void {
  catalog.set(id, { bitmap, palette, frameCount });
}

function addTerrainSprites(catalog: Map<string, SpriteDefinition>): void {
  addSprite(catalog, FIELD_BACKGROUND_SPRITE_ID, FIELD_BACKGROUND_BITMAP, FIELD_BACKGROUND_PALETTE);

  for (const quadrants of listBrickQuadrantVariants()) {
    addSprite(catalog, getBrickSpriteId(quadrants), createBrickBitmap(quadrants), BRICK_PALETTE);
  }

  addSprite(catalog, STEEL_SPRITE_ID, STEEL_BITMAP, STEEL_PALETTE);
  addSprite(catalog, WATER_SPRITE_ID, WATER_BITMAP, WATER_PALETTE, WATER_FRAME_COUNT);
  addSprite(catalog, ICE_SPRITE_ID, ICE_BITMAP, ICE_PALETTE);
  addSprite(catalog, TREES_SPRITE_ID, TREES_BITMAP, TREES_PALETTE);
  addSprite(catalog, EAGLE_SPRITE_ID, EAGLE_BITMAP, EAGLE_PALETTE);
  addSprite(catalog, EAGLE_DESTROYED_SPRITE_ID, EAGLE_DESTROYED_BITMAP, EAGLE_DESTROYED_PALETTE);
}

function addTankSprites(catalog: Map<string, SpriteDefinition>): void {
  for (let playerSlot = 0; playerSlot < PLAYER_SLOT_COUNT; playerSlot++) {
    for (let starLevel = MIN_STAR_LEVEL; starLevel <= MAX_STAR_LEVEL; starLevel++) {
      for (let frameIndex = 0; frameIndex < TANK_TRACK_FRAME_COUNT; frameIndex++) {
        addSprite(
          catalog,
          getPlayerTankSpriteId(playerSlot, starLevel, frameIndex),
          createTankBitmap(PLAYER_TANK_HULL, frameIndex),
          createPlayerTankPalette(playerSlot, starLevel)
        );
      }
    }
  }

  for (const enemyType of ENEMY_TYPES) {
    for (const paletteName of listEnemyPaletteNames(enemyType)) {
      for (let frameIndex = 0; frameIndex < TANK_TRACK_FRAME_COUNT; frameIndex++) {
        addSprite(
          catalog,
          getEnemyTankSpriteId(enemyType, paletteName, frameIndex),
          createTankBitmap(ENEMY_HULLS[enemyType], frameIndex),
          getEnemyPalette(enemyType, paletteName)
        );
      }
    }
  }
}

function addEffectSprites(catalog: Map<string, SpriteDefinition>): void {
  addSprite(catalog, BULLET_SPRITE_ID, BULLET_BITMAP, BULLET_PALETTE);

  SPAWN_TWINKLE_BITMAPS.forEach((bitmap, frameIndex) => {
    addSprite(catalog, getSpawnTwinkleSpriteId(frameIndex), bitmap, SPAWN_TWINKLE_PALETTE);
  });

  SHIELD_BITMAPS.forEach((bitmap, frameIndex) => {
    addSprite(catalog, getShieldSpriteId(frameIndex), bitmap, SHIELD_PALETTE);
  });

  SMALL_EXPLOSION_BITMAPS.forEach((bitmap, frameIndex) => {
    addSprite(catalog, getSmallExplosionSpriteId(frameIndex), bitmap, EXPLOSION_PALETTE);
  });

  LARGE_EXPLOSION_BITMAPS.forEach((bitmap, frameIndex) => {
    addSprite(catalog, getLargeExplosionSpriteId(frameIndex), bitmap, EXPLOSION_PALETTE);
  });

  for (const powerUpType of POWER_UP_TYPES) {
    addSprite(
      catalog,
      getPowerUpSpriteId(powerUpType),
      POWER_UP_BITMAPS[powerUpType],
      POWER_UP_PALETTE
    );
  }

  // The array index is the numeral the bitmap draws.
  DIGIT_BITMAPS.forEach((bitmap, digit) => {
    addSprite(catalog, getDigitSpriteId(digit), bitmap, SCORE_POPUP_PALETTE);
  });
}

/** The complete sprite inventory of §11.4, assembled from our own pixel-art bitmaps. */
export function createSpriteCatalog(): SpriteCatalog {
  const catalog = new Map<string, SpriteDefinition>();

  addTerrainSprites(catalog);
  addTankSprites(catalog);
  addEffectSprites(catalog);

  return catalog;
}
