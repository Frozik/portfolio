import { STREET_MESH_UNIT_M } from './constants';
import { clippedPolygonsOfTileRings } from './tile-clip';
import type { TileGrid } from './tile-grid';
import { waterTileMesh } from './water-surface';

const EXTENT = 4096;
/** Half a metre per tile unit: a real z14 tile, which the `int16` mesh must hold. */
const TILE_SIZE_M = 2048;
const GRID: TileGrid = { extent: EXTENT, tileSizeM: TILE_SIZE_M };
const BUFFER = 64;
const VERTICES_PER_TRIANGLE = 3;
const COORDINATES_PER_VERTEX = 2;

/** An ocean tile as the vector tile stores it: the square plus its buffer, clockwise in tile space. */
const OCEAN_RING = [
  { x: -BUFFER, y: -BUFFER },
  { x: EXTENT + BUFFER, y: -BUFFER },
  { x: EXTENT + BUFFER, y: EXTENT + BUFFER },
  { x: -BUFFER, y: EXTENT + BUFFER },
];
const ISLAND_RING = [
  { x: 1000, y: 1000 },
  { x: 1000, y: 2000 },
  { x: 2000, y: 2000 },
  { x: 2000, y: 1000 },
];

describe('water surface', () => {
  it('triangulates the water into a flat mesh in mesh units, holes left open', () => {
    const polygons = clippedPolygonsOfTileRings([OCEAN_RING, ISLAND_RING], GRID);
    const mesh = waterTileMesh(polygons);

    expect(polygons).toHaveLength(1);
    expect(polygons[0].holes).toHaveLength(1);
    expect(mesh.positions).toHaveLength(8 * COORDINATES_PER_VERTEX);
    expect(mesh.indices.length % VERTICES_PER_TRIANGLE).toBe(0);
    expect(mesh.indices.length / VERTICES_PER_TRIANGLE).toBe(8);
    expect(Math.max(...mesh.positions)).toBe(TILE_SIZE_M / STREET_MESH_UNIT_M);
    expect(Math.min(...mesh.positions)).toBe(0);
  });

  it('gives a tile without water an empty mesh', () => {
    expect(waterTileMesh(clippedPolygonsOfTileRings([], GRID)).indices).toHaveLength(0);
  });
});
