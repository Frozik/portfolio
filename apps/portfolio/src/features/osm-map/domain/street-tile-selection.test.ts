import { MAX_STREET_TILES_IN_VIEW } from './constants';
import { selectStreetTiles } from './street-tile-selection';
import type { TileCoord } from './tile-key';
import { childrenOf, tileBounds, tileKeyOf } from './tile-key';
import type { SelectedTile } from './tile-selection';

const Z14: TileCoord = { z: 14, x: 9570, y: 4760 };
const Z14_ORIGIN = tileBounds(Z14);
/** The camera target in the north-west corner of `Z14`. */
const TARGET = { x: Z14_ORIGIN.minX, y: Z14_ORIGIN.minY };

function selectedTile(coord: TileCoord, screenDistancePx: number): SelectedTile {
  return { key: tileKeyOf(coord), coord, edgePx: 300, screenDistancePx };
}

describe('street tile selection', () => {
  it('collapses the finer raster tiles onto their z14 ancestor with the best priority among them', () => {
    const [nearChild, ...farChildren] = childrenOf(Z14);
    const tiles = [
      selectedTile(nearChild, 40),
      ...farChildren.map(coord => selectedTile(coord, 900)),
      selectedTile({ z: 15, x: 2 * Z14.x + 2, y: 2 * Z14.y }, 10),
    ];

    const buildingTiles = selectStreetTiles(tiles, TARGET);

    expect(buildingTiles.map(tile => tile.coord)).toEqual([Z14, { z: 14, x: Z14.x + 1, y: Z14.y }]);
    expect(buildingTiles[0].screenDistancePx).toBe(40);
  });

  it('keeps the tiles nearest the camera target on the ground, whichever side of the screen they land on', () => {
    const row = Array.from({ length: MAX_STREET_TILES_IN_VIEW + 4 }, (_, step) => step);
    const ahead = row.map(step => selectedTile({ z: 14, x: Z14.x, y: Z14.y - step }, step * 10));
    const beside = selectedTile({ z: 14, x: Z14.x + 1, y: Z14.y }, 2000);

    const buildingTiles = selectStreetTiles([...ahead, beside], TARGET);

    expect(buildingTiles).toHaveLength(MAX_STREET_TILES_IN_VIEW);
    expect(buildingTiles.map(tile => tile.key)).toContain(beside.key);
    expect(buildingTiles.map(tile => tile.key)).not.toContain(ahead[ahead.length - 1].key);
  });

  it('keeps a raster tile at z14 as its own street tile and leaves out the coarser ones', () => {
    const tiles = [selectedTile(Z14, 0), selectedTile({ z: 13, x: 4785, y: 2380 }, 0)];

    expect(selectStreetTiles(tiles, TARGET).map(tile => tile.coord)).toEqual([Z14]);
  });
});
