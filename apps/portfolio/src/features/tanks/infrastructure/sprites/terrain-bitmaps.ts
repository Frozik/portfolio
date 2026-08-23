import { CELL_QUADRANT_SIZE_WU } from '../../domain/constants';
import type { QuadrantSelection } from '../../domain/types';
import type { SpriteBitmap } from './sprite-types';
import { TRANSPARENT_PIXEL } from './sprite-types';

/** One 8-wu cell of brick: two courses of four-wide bricks, offset by half a brick. */
const BRICK_BITMAP: SpriteBitmap = [
  '33333333',
  '11121112',
  '11121112',
  '22222222',
  '33333333',
  '12111211',
  '12111211',
  '22222222',
];

/** Riveted plates: a 2 × 2 arrangement of 4-wu plates with a lit top and a shaded bottom. */
export const STEEL_BITMAP: SpriteBitmap = [
  '22222222',
  '21132113',
  '21132113',
  '33333333',
  '22222222',
  '21132113',
  '21132113',
  '33333333',
];

/** Two shimmer frames side by side — the wave crests shift by two pixels between them. */
export const WATER_BITMAP: SpriteBitmap = [
  '1111111111111111',
  '1221122121122112',
  '1111111111111111',
  '3113311313311331',
  '1111111111111111',
  '1221122121122112',
  '1111111111111111',
  '3113311313311331',
];

export const WATER_FRAME_COUNT = 2;

export const ICE_BITMAP: SpriteBitmap = [
  '11111111',
  '12211111',
  '11111111',
  '11111221',
  '11111111',
  '12111111',
  '11111111',
  '11122111',
];

/** ~A third of the tile is transparent so a tank under the canopy stays half-visible (§11.3). */
export const TREES_BITMAP: SpriteBitmap = [
  '.11.311.',
  '1221.221',
  '31.1.11.',
  '.1.13..1',
  '11.311.1',
  '1221.221',
  '.11..11.',
  '.11.31..',
];

/** Solid fill behind the whole playfield; stretched over the field rectangle at draw time. */
export const FIELD_BACKGROUND_BITMAP: SpriteBitmap = [
  '11111111',
  '11111111',
  '11111111',
  '11111111',
  '11111111',
  '11111111',
  '11111111',
  '11111111',
];

/** The eagle: head and neck, wings spread the full width of the tile, tail, pedestal. */
export const EAGLE_BITMAP: SpriteBitmap = [
  '................',
  '.......11.......',
  '......1221......',
  '......1221......',
  '.11...1221...11.',
  '1221.122221.1221',
  '1222112222112221',
  '1222222222222221',
  '.12222222222221.',
  '..122222222221..',
  '...1222222221...',
  '....12222221....',
  '.....122221.....',
  '......1221......',
  '....11111111....',
  '...3333333333...',
];

export const EAGLE_DESTROYED_BITMAP: SpriteBitmap = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......3........',
  '..3...313...3...',
  '...3.31113.33...',
  '..333133313133..',
  '.31113111311331.',
  '.31131113113131.',
  '.11311131113111.',
  '.11111111111111.',
  '.33333333333333.',
  '................',
  '................',
];

function isQuadrantStanding(
  quadrants: QuadrantSelection,
  columnIndex: number,
  rowIndex: number
): boolean {
  const isLeft = columnIndex < CELL_QUADRANT_SIZE_WU;
  const isTop = rowIndex < CELL_QUADRANT_SIZE_WU;

  if (isTop) {
    return isLeft ? quadrants.topLeft : quadrants.topRight;
  }

  return isLeft ? quadrants.bottomLeft : quadrants.bottomRight;
}

export function createBrickBitmap(quadrants: QuadrantSelection): SpriteBitmap {
  return BRICK_BITMAP.map((row, rowIndex) =>
    [...row]
      .map((pixel, columnIndex) =>
        isQuadrantStanding(quadrants, columnIndex, rowIndex) ? pixel : TRANSPARENT_PIXEL
      )
      .join('')
  );
}

/** All 16 quadrant combinations, enumerated as booleans — the ROM's nibble is not our model. */
export function listBrickQuadrantVariants(): readonly QuadrantSelection[] {
  const booleans = [false, true];
  const variants: QuadrantSelection[] = [];

  for (const topLeft of booleans) {
    for (const topRight of booleans) {
      for (const bottomLeft of booleans) {
        for (const bottomRight of booleans) {
          variants.push({ topLeft, topRight, bottomLeft, bottomRight });
        }
      }
    }
  }

  return variants;
}
