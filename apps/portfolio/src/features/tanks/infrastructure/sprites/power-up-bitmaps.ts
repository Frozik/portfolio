import type { PowerUpType } from '../../domain/types';
import type { SpriteBitmap } from './sprite-types';

/** `1` is the frame, `3` the box fill and `2` the glyph. */
const BOX_BORDER_ROW = '1111111111111111';
const BOX_PADDING_ROW = '1333333333333331';

function createPowerUpBitmap(glyph: SpriteBitmap): SpriteBitmap {
  return [
    BOX_BORDER_ROW,
    BOX_PADDING_ROW,
    ...glyph.map(glyphRow => `13${glyphRow}31`),
    BOX_PADDING_ROW,
    BOX_BORDER_ROW,
  ];
}

const HELMET_GLYPH: SpriteBitmap = [
  '333333333333',
  '333322223333',
  '332222222233',
  '322222222223',
  '322222222223',
  '322222222223',
  '322222222223',
  '322222222223',
  '332222222233',
  '332233332233',
  '333333333333',
  '333333333333',
];

const CLOCK_GLYPH: SpriteBitmap = [
  '333322223333',
  '332222222233',
  '322233332223',
  '322233332223',
  '322233332223',
  '322233222223',
  '322233222223',
  '322222222223',
  '322222222223',
  '332222222233',
  '333322223333',
  '333333333333',
];

const SHOVEL_GLYPH: SpriteBitmap = [
  '333332233333',
  '333332233333',
  '333332233333',
  '333332233333',
  '333322223333',
  '333222222333',
  '332222222233',
  '322222222223',
  '322222222223',
  '332222222233',
  '333322223333',
  '333333333333',
];

const STAR_GLYPH: SpriteBitmap = [
  '333332233333',
  '333332233333',
  '333322223333',
  '222222222222',
  '322222222223',
  '333222222333',
  '333322223333',
  '333222222333',
  '332222222233',
  '332233332233',
  '332233332233',
  '333333333333',
];

const GRENADE_GLYPH: SpriteBitmap = [
  '333333223333',
  '333333223333',
  '333322222333',
  '333222222333',
  '332222222233',
  '322222222223',
  '322222222223',
  '322222222223',
  '322222222223',
  '332222222233',
  '333222222333',
  '333333333333',
];

const TANK_GLYPH: SpriteBitmap = [
  '333333333333',
  '333332233333',
  '333332233333',
  '333322223333',
  '332222222233',
  '322222222223',
  '322222222223',
  '322222222223',
  '332222222233',
  '322322222323',
  '322322222323',
  '333333333333',
];

export const POWER_UP_BITMAPS: Readonly<Record<PowerUpType, SpriteBitmap>> = {
  helmet: createPowerUpBitmap(HELMET_GLYPH),
  clock: createPowerUpBitmap(CLOCK_GLYPH),
  shovel: createPowerUpBitmap(SHOVEL_GLYPH),
  star: createPowerUpBitmap(STAR_GLYPH),
  grenade: createPowerUpBitmap(GRENADE_GLYPH),
  tank: createPowerUpBitmap(TANK_GLYPH),
};
