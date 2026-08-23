import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import type { EnemyType } from '../../domain/types';
import {
  NES_BLACK,
  NES_BLUE,
  NES_BRICK_ORANGE,
  NES_DARK_BLUE,
  NES_DARK_GREEN,
  NES_DARK_RED,
  NES_DARK_YELLOW,
  NES_GRAY,
  NES_GREEN,
  NES_LAVENDER,
  NES_LIGHT_BLUE,
  NES_LIGHT_GRAY,
  NES_LIGHT_GREEN,
  NES_LIGHT_ORANGE,
  NES_ORANGE,
  NES_PALE_BLUE,
  NES_PALE_GREEN,
  NES_PALE_YELLOW,
  NES_PINK,
  NES_RED,
  NES_TAN,
  NES_WHITE,
  NES_YELLOW,
} from '../nes-palette';
import type { SpritePalette } from './sprite-types';

export const FIELD_BACKGROUND_PALETTE: SpritePalette = { '1': NES_BLACK };

export const BRICK_PALETTE: SpritePalette = {
  '1': NES_BRICK_ORANGE,
  '2': NES_DARK_RED,
  '3': NES_LIGHT_ORANGE,
};

export const STEEL_PALETTE: SpritePalette = {
  '1': NES_LIGHT_GRAY,
  '2': NES_WHITE,
  '3': NES_GRAY,
};

export const WATER_PALETTE: SpritePalette = {
  '1': NES_BLUE,
  '2': NES_LIGHT_BLUE,
  '3': NES_DARK_BLUE,
};

export const ICE_PALETTE: SpritePalette = {
  '1': NES_LAVENDER,
  '2': NES_WHITE,
  '3': NES_PALE_BLUE,
};

export const TREES_PALETTE: SpritePalette = {
  '1': NES_GREEN,
  '2': NES_LIGHT_GREEN,
  '3': NES_DARK_GREEN,
};

export const EAGLE_PALETTE: SpritePalette = {
  '1': NES_LIGHT_GRAY,
  '2': NES_WHITE,
  '3': NES_TAN,
};

export const EAGLE_DESTROYED_PALETTE: SpritePalette = {
  '1': NES_GRAY,
  '2': NES_LIGHT_GRAY,
  '3': NES_DARK_YELLOW,
};

export const BULLET_PALETTE: SpritePalette = { '1': NES_LIGHT_GRAY, '2': NES_WHITE };

export const SHIELD_PALETTE: SpritePalette = { '1': NES_LIGHT_BLUE, '2': NES_WHITE };

export const SPAWN_TWINKLE_PALETTE: SpritePalette = { '1': NES_LIGHT_BLUE, '2': NES_WHITE };

export const EXPLOSION_PALETTE: SpritePalette = {
  '1': NES_ORANGE,
  '2': NES_YELLOW,
  '3': NES_PALE_YELLOW,
};

export const SCORE_POPUP_PALETTE: SpritePalette = { '1': NES_WHITE };

export const POWER_UP_PALETTE: SpritePalette = {
  '1': NES_WHITE,
  '2': NES_ORANGE,
  '3': NES_DARK_RED,
};

const PLAYER_BODY_COLORS: readonly string[] = [NES_YELLOW, NES_LIGHT_GREEN];
const PLAYER_SHADOW_COLORS: readonly string[] = [NES_DARK_YELLOW, NES_DARK_GREEN];
const STAR_ACCENT_COLORS: readonly string[] = [
  NES_PALE_YELLOW,
  NES_WHITE,
  NES_LIGHT_BLUE,
  NES_PINK,
];

export function createPlayerTankPalette(playerSlot: number, starLevel: number): SpritePalette {
  return {
    '1': PLAYER_BODY_COLORS[playerSlot],
    '2': STAR_ACCENT_COLORS[starLevel],
    '3': PLAYER_SHADOW_COLORS[playerSlot],
  };
}

/** Deliberately not the damage palettes: both phases stay green, so full health reads as plated. */
const ARMOR_SHIMMER_PALETTES: readonly SpritePalette[] = [
  { '1': NES_GREEN, '2': NES_PALE_GREEN, '3': NES_DARK_GREEN },
  { '1': NES_DARK_GREEN, '2': NES_GREEN, '3': NES_DARK_GREEN },
];

/** Index 0 is one hit taken — a full-health armor tank uses {@link ARMOR_SHIMMER_PALETTES}. */
const ARMOR_DAMAGE_PALETTES: readonly SpritePalette[] = [
  { '1': NES_LIGHT_GREEN, '2': NES_WHITE, '3': NES_GREEN },
  { '1': NES_YELLOW, '2': NES_PALE_YELLOW, '3': NES_DARK_YELLOW },
  { '1': NES_LIGHT_GRAY, '2': NES_WHITE, '3': NES_GRAY },
];

const ENEMY_BASE_PALETTES: Readonly<Record<EnemyType, SpritePalette>> = {
  basic: { '1': NES_LIGHT_GRAY, '2': NES_WHITE, '3': NES_GRAY },
  fast: { '1': NES_LIGHT_BLUE, '2': NES_WHITE, '3': NES_BLUE },
  power: { '1': NES_TAN, '2': NES_PALE_YELLOW, '3': NES_BRICK_ORANGE },
  armor: ARMOR_SHIMMER_PALETTES[0],
};

const CARRIER_FLASH_PALETTE: SpritePalette = {
  '1': NES_RED,
  '2': NES_WHITE,
  '3': NES_DARK_RED,
};

export const CARRIER_PALETTE_NAME = 'carrier';

const UNDAMAGED_LEVEL = 0;
const FIRST_DAMAGE_LEVEL = 1;

function getDamagePaletteName(damageLevel: number): string {
  return `damage${damageLevel}`;
}

function getShimmerPaletteName(phase: number): string {
  return `shimmer${phase}`;
}

const ARMOR_PALETTES_BY_NAME: ReadonlyMap<string, SpritePalette> = new Map([
  ...ARMOR_SHIMMER_PALETTES.map((palette, phase): readonly [string, SpritePalette] => [
    getShimmerPaletteName(phase),
    palette,
  ]),
  ...ARMOR_DAMAGE_PALETTES.map((palette, index): readonly [string, SpritePalette] => [
    getDamagePaletteName(index + FIRST_DAMAGE_LEVEL),
    palette,
  ]),
]);

export function listEnemyPaletteNames(enemyType: EnemyType): readonly string[] {
  if (enemyType !== 'armor') {
    return [getDamagePaletteName(UNDAMAGED_LEVEL), CARRIER_PALETTE_NAME];
  }

  return [...ARMOR_PALETTES_BY_NAME.keys(), CARRIER_PALETTE_NAME];
}

export function getEnemyPalette(enemyType: EnemyType, paletteName: string): SpritePalette {
  if (paletteName === CARRIER_PALETTE_NAME) {
    return CARRIER_FLASH_PALETTE;
  }

  if (enemyType !== 'armor') {
    return ENEMY_BASE_PALETTES[enemyType];
  }

  const palette = ARMOR_PALETTES_BY_NAME.get(paletteName);

  assert(!isNil(palette), `unknown armor palette "${paletteName}"`);

  return palette;
}

export function resolveEnemyPaletteName(params: {
  readonly enemyType: EnemyType;
  readonly damageLevel: number;
  readonly isCarrierFlashing: boolean;
  readonly tick: number;
}): string {
  const { enemyType, damageLevel, isCarrierFlashing, tick } = params;

  if (isCarrierFlashing) {
    return CARRIER_PALETTE_NAME;
  }

  if (enemyType === 'armor' && damageLevel === UNDAMAGED_LEVEL) {
    return getShimmerPaletteName(tick % ARMOR_SHIMMER_PALETTES.length);
  }

  return getDamagePaletteName(enemyType === 'armor' ? damageLevel : UNDAMAGED_LEVEL);
}
