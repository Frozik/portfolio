import type { PowerUpType } from '../../domain/types';
import type { SpriteBitmap } from './sprite-types';

/** `1` is the frame + white glyph strokes, `2` an orange accent and `3` the box fill. */
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

/** Army dome with a full-width brim and an orange chin strap below it. */
const HELMET_GLYPH: SpriteBitmap = [
  '333333333333',
  '333311113333',
  '331111111133',
  '311111111113',
  '311111111113',
  '311111111113',
  '111111111111',
  '111111111111',
  '333322223333',
  '333322223333',
  '333333333333',
  '333333333333',
];

/** White dial, orange hands frozen at twelve-fifteen. */
const CLOCK_GLYPH: SpriteBitmap = [
  '333311113333',
  '331111111133',
  '311111111113',
  '311112111113',
  '311112111113',
  '311112221113',
  '311111111113',
  '311111111113',
  '331111111133',
  '333311113333',
  '333333333333',
  '333333333333',
];

/** Picket fence — the fortified base: white pickets behind two orange rails. */
const SHOVEL_GLYPH: SpriteBitmap = [
  '311331133113',
  '311331133113',
  '222222222222',
  '222222222222',
  '311331133113',
  '311331133113',
  '222222222222',
  '222222222222',
  '311331133113',
  '311331133113',
  '333333333333',
  '333333333333',
];

/** Classic five-point star. */
const STAR_GLYPH: SpriteBitmap = [
  '333331133333',
  '333331133333',
  '333311113333',
  '111111111111',
  '311111111113',
  '331111111133',
  '333111111333',
  '331111111133',
  '331113311133',
  '311133331113',
  '333333333333',
  '333333333333',
];

/** Round bomb: orange fuse over a white collar and sphere with a glint. */
const GRENADE_GLYPH: SpriteBitmap = [
  '333332233333',
  '333332233333',
  '333311113333',
  '333111111333',
  '331211111133',
  '311111111113',
  '311111111113',
  '311111111113',
  '331111111133',
  '333111111333',
  '333311113333',
  '333333333333',
];

/** Extra life — a heart with a small orange glint. */
const TANK_GLYPH: SpriteBitmap = [
  '333333333333',
  '331113311133',
  '312113311113',
  '311111111113',
  '311111111113',
  '331111111133',
  '333111111333',
  '333311113333',
  '333331133333',
  '333333333333',
  '333333333333',
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
