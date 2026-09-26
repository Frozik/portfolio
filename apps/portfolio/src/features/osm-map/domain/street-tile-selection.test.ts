import { selectStreetTiles } from './street-tile-selection';
import type { TileCoord } from './tile-key';
import { childrenOf, tileKeyOf } from './tile-key';
import type { SelectedTile } from './tile-selection';

const Z14: TileCoord = { z: 14, x: 9570, y: 4760 };

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

    const buildingTiles = selectStreetTiles(tiles);

    expect(buildingTiles.map(tile => tile.coord)).toEqual([{ z: 14, x: Z14.x + 1, y: Z14.y }, Z14]);
    expect(buildingTiles[1].screenDistancePx).toBe(40);
  });

  it('keeps a raster tile at z14 as its own street tile and leaves out the coarser ones', () => {
    const tiles = [selectedTile(Z14, 0), selectedTile({ z: 13, x: 4785, y: 2380 }, 0)];

    expect(selectStreetTiles(tiles).map(tile => tile.coord)).toEqual([Z14]);
  });
});
