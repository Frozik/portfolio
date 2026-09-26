import { BUILDING_MESH_UNIT_M, buildingTileMesh, polygonsOfTileRings } from './building-footprint';
import type { TileGrid } from './tile-grid';

/** One tile unit is one metre, so the numbers can be read off directly. */
const METRE_GRID: TileGrid = { extent: 4096, tileSizeM: 4096 };
const SQUARE_TILE_RING = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
  { x: 0, y: 0 },
];
const HOLE_TILE_RING = [
  { x: 2, y: 2 },
  { x: 2, y: 8 },
  { x: 8, y: 8 },
  { x: 8, y: 2 },
];
const TRIANGLES_PER_BOX = 10;
const VERTICES_PER_TRIANGLE = 3;

function signedArea(ring: readonly { x: number; y: number }[]): number {
  return (
    ring.reduce((sum, point, index) => {
      const next = ring[(index + 1) % ring.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2
  );
}

describe('building footprints', () => {
  it('turns tile rings into plan polygons: metres, north up, outer counter-clockwise, holes clockwise', () => {
    const [polygon] = polygonsOfTileRings([SQUARE_TILE_RING, HOLE_TILE_RING], METRE_GRID);

    expect(polygon.outer).toHaveLength(4);
    expect(polygon.outer).toContainEqual({ x: 10, y: -10 });
    expect(signedArea(polygon.outer)).toBeGreaterThan(0);
    expect(polygon.holes).toHaveLength(1);
    expect(signedArea(polygon.holes[0])).toBeLessThan(0);
  });

  it('opens a new polygon at every outer ring and drops rings too short to bound anything', () => {
    const second = SQUARE_TILE_RING.map(point => ({ x: point.x + 20, y: point.y }));

    const polygons = polygonsOfTileRings(
      [
        SQUARE_TILE_RING,
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        second,
      ],
      METRE_GRID
    );

    expect(polygons).toHaveLength(2);
    expect(polygons.every(polygon => polygon.holes.length === 0)).toBe(true);
  });

  it('boxes every footprint between its base and its height into one compact mesh', () => {
    const polygons = polygonsOfTileRings([SQUARE_TILE_RING], METRE_GRID);

    const mesh = buildingTileMesh([
      { polygons, heightM: 12, minHeightM: 3 },
      { polygons, heightM: 2, minHeightM: 2 },
    ]);
    const heights = new Set(
      Array.from(mesh.positions)
        .filter((_, index) => index % 4 === 1)
        .map(tenths => tenths * BUILDING_MESH_UNIT_M)
    );

    expect(mesh.positions).toHaveLength(8 * 4);
    expect(mesh.indices).toHaveLength(TRIANGLES_PER_BOX * VERTICES_PER_TRIANGLE);
    expect(heights).toEqual(new Set([3, 12]));
    expect(Math.max(...mesh.indices)).toBe(7);
  });
});
