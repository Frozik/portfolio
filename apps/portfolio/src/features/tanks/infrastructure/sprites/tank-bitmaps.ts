import type { SpriteBitmap } from './sprite-types';

/** Every tank is authored facing up — the renderer rotates the quad; tracks are generated. */
const BARREL_ROW_COUNT = 3;
const TRACK_EMPTY_ROW = '....';
const TRACK_LIGHT_ROW = '1331';
const TRACK_DARK_ROW = '3113';
/** Player tracks read as horizontal tread bands instead of the enemies' checker. */
const PLAYER_TRACK_LIGHT_ROW = '1111';
const PLAYER_TRACK_DARK_ROW = '3333';
/** Track shoe spacing in pixels; shifting it by one row between frames makes the tank crawl. */
const TRACK_PATTERN_PERIOD = 3;

export type TankTrackStyle = 'checker' | 'band';

export const TANK_TRACK_FRAME_COUNT = 2;

/**
 * Signature silhouette: muzzle brake on a long barrel, a pointed pentagonal
 * turret and a V-chevron on the hull — nothing the enemy hulls share, so the
 * player reads by shape alone.
 */
export const PLAYER_TANK_HULL: SpriteBitmap = [
  '..2222..',
  '...22...',
  '...22...',
  '...22...',
  '..2222..',
  '.222222.',
  '.222222.',
  '.122221.',
  '11222211',
  '11111111',
  '13111131',
  '11311311',
  '11133111',
  '11111111',
  '.113311.',
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

function createTrackRow(rowIndex: number, frameIndex: number, style: TankTrackStyle): string {
  if (rowIndex < BARREL_ROW_COUNT) {
    return TRACK_EMPTY_ROW;
  }

  const isDarkRow = (rowIndex + frameIndex) % TRACK_PATTERN_PERIOD === 0;

  if (style === 'band') {
    return isDarkRow ? PLAYER_TRACK_DARK_ROW : PLAYER_TRACK_LIGHT_ROW;
  }

  return isDarkRow ? TRACK_DARK_ROW : TRACK_LIGHT_ROW;
}

export function createTankBitmap(
  hull: SpriteBitmap,
  frameIndex: number,
  trackStyle: TankTrackStyle = 'checker'
): SpriteBitmap {
  return hull.map((hullRow, rowIndex) => {
    const trackRow = createTrackRow(rowIndex, frameIndex, trackStyle);

    return trackRow + hullRow + trackRow;
  });
}
