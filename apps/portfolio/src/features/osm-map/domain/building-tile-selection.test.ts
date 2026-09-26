import { selectBuildingTiles } from './building-tile-selection';
import { BUILDINGS_MIN_ZOOM } from './constants';
import type { TileCoord } from './tile-key';
import { childrenOf, tileKeyOf } from './tile-key';
import type { SelectedTile } from './tile-selection';

const Z14: TileCoord = { z: 14, x: 9570, y: 4760 };

function selectedTile(coord: TileCoord, screenDistancePx: number): SelectedTile {
  return { key: tileKeyOf(coord), coord, edgePx: 300, screenDistancePx };
}

describe('building tile selection', () => {
  it('asks for nothing until the camera is close enough for buildings', () => {
    const tiles = childrenOf(Z14).map(coord => selectedTile(coord, 0));

    expect(selectBuildingTiles(tiles, BUILDINGS_MIN_ZOOM - 0.01)).toEqual([]);
    expect(selectBuildingTiles(tiles, BUILDINGS_MIN_ZOOM)).toHaveLength(1);
  });

  it('collapses the finer raster tiles onto their z14 ancestor with the best priority among them', () => {
    const [nearChild, ...farChildren] = childrenOf(Z14);
    const tiles = [
      selectedTile(nearChild, 40),
      ...farChildren.map(coord => selectedTile(coord, 900)),
      selectedTile({ z: 15, x: 2 * Z14.x + 2, y: 2 * Z14.y }, 10),
    ];

    const buildingTiles = selectBuildingTiles(tiles, BUILDINGS_MIN_ZOOM);

    expect(buildingTiles.map(tile => tile.coord)).toEqual([{ z: 14, x: Z14.x + 1, y: Z14.y }, Z14]);
    expect(buildingTiles[1].screenDistancePx).toBe(40);
  });

  it('leaves out the tiles at z14 and coarser, which have no z14 ancestor to draw', () => {
    const tiles = [selectedTile(Z14, 0), selectedTile({ z: 13, x: 4785, y: 2380 }, 0)];

    expect(selectBuildingTiles(tiles, BUILDINGS_MIN_ZOOM)).toEqual([]);
  });
});
