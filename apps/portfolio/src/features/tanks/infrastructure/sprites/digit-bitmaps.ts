import type { SpriteBitmap } from './sprite-types';

/** Our own 3 × 5 numeral set, drawn in the era's style. */
export const DIGIT_BITMAPS: readonly SpriteBitmap[] = [
  ['111', '1.1', '1.1', '1.1', '111'],
  ['.1.', '11.', '.1.', '.1.', '111'],
  ['111', '..1', '111', '1..', '111'],
  ['111', '..1', '111', '..1', '111'],
  ['1.1', '1.1', '111', '..1', '..1'],
  ['111', '1..', '111', '..1', '111'],
  ['111', '1..', '111', '1.1', '111'],
  ['111', '..1', '..1', '..1', '..1'],
  ['111', '1.1', '111', '1.1', '111'],
  ['111', '1.1', '111', '..1', '111'],
];

export const DIGIT_WIDTH_WU = DIGIT_BITMAPS[0][0].length;
export const DIGIT_HEIGHT_WU = DIGIT_BITMAPS[0].length;
