import type { SpriteBitmap } from './sprite-types';

/** Every tank is authored facing up — the renderer rotates the quad; tracks are generated (§11.3). */
const BARREL_ROW_COUNT = 3;
const TRACK_EMPTY_ROW = '....';
const TRACK_LIGHT_ROW = '1331';
const TRACK_DARK_ROW = '3113';
/** Track shoe spacing in pixels; shifting it by one row between frames makes the tank crawl. */
const TRACK_PATTERN_PERIOD = 3;

export const TANK_TRACK_FRAME_COUNT = 2;

/** Signature silhouette: a long slim barrel widening into a rounded turret cap. */
export const PLAYER_TANK_HULL: SpriteBitmap = [
  '...22...',
  '...22...',
  '...22...',
  '..2222..',
  '.122221.',
  '.122221.',
  '11122111',
  '11111111',
  '11311311',
  '11111111',
  '11111111',
  '11311311',
  '11111111',
  '11111111',
  '.111111.',
  '.111111.',
];

/** Signature silhouette: short hull, small square turret, stubby barrel. */
export const BASIC_ENEMY_HULL: SpriteBitmap = [
  '...22...',
  '...22...',
  '..1221..',
  '.112211.',
  '11122111',
  '11122111',
  '11111111',
  '11311311',
  '11111111',
  '11111111',
  '11111111',
  '11311311',
  '11111111',
  '11111111',
  '.111111.',
  '.111111.',
];

/** Signature silhouette: narrow inset body under a long barrel. */
export const FAST_ENEMY_HULL: SpriteBitmap = [
  '...22...',
  '...22...',
  '...22...',
  '..1111..',
  '.111111.',
  '.111111.',
  '.113311.',
  '.111111.',
  '11111111',
  '11111111',
  '11111111',
  '11311311',
  '11111111',
  '11111111',
  '.111111.',
  '.111111.',
];

/** Signature silhouette: the wide four-pixel barrel of the 300-point tier. */
export const POWER_ENEMY_HULL: SpriteBitmap = [
  '..2222..',
  '..2222..',
  '..2222..',
  '.122221.',
  '11222211',
  '11122111',
  '11111111',
  '11311311',
  '11111111',
  '11111111',
  '11111111',
  '11311311',
  '11111111',
  '11111111',
  '.111111.',
  '.111111.',
];

/** Signature silhouette: a heavy dome over the hull — and where the damage palette shows. */
export const ARMOR_ENEMY_HULL: SpriteBitmap = [
  '...22...',
  '...22...',
  '...22...',
  '..2222..',
  '.222222.',
  '12222221',
  '12222221',
  '12222221',
  '11222211',
  '11111111',
  '13111131',
  '11111111',
  '13111131',
  '11111111',
  '11111111',
  '.111111.',
];

function createTrackRow(rowIndex: number, frameIndex: number): string {
  if (rowIndex < BARREL_ROW_COUNT) {
    return TRACK_EMPTY_ROW;
  }

  return (rowIndex + frameIndex) % TRACK_PATTERN_PERIOD === 0 ? TRACK_DARK_ROW : TRACK_LIGHT_ROW;
}

export function createTankBitmap(hull: SpriteBitmap, frameIndex: number): SpriteBitmap {
  return hull.map((hullRow, rowIndex) => {
    const trackRow = createTrackRow(rowIndex, frameIndex);

    return trackRow + hullRow + trackRow;
  });
}
