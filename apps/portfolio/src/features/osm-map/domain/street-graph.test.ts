import type { TileRoad } from './road-lines';
import { roadLinesOfTile } from './road-lines';
import { buildStreetGraph, entriesInto, exitsFrom } from './street-graph';
import { tileKeyOf } from './tile-key';

const EXTENT = 4096;
const TILE_SIZE_M = 4096;
const TILE = { z: 14, x: 10, y: 20 };
const EAST_TILE = { z: 14, x: 11, y: 20 };
const KEY = tileKeyOf(TILE);

function road(lines: TileRoad['lines'], oneway: TileRoad['oneway'] = 0): TileRoad {
  return { lines, roadClass: 'minor', oneway };
}

/** An east–west road with a north–south one ending on it: a T-junction at (200, 100). */
function tJunction() {
  return roadLinesOfTile(
    [
      road([
        [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
          { x: 300, y: 100 },
        ],
      ]),
      road(
        [
          [
            { x: 200, y: 100 },
            { x: 200, y: 300 },
          ],
        ],
        1
      ),
    ],
    TILE,
    EXTENT,
    TILE_SIZE_M
  );
}

describe('street graph', () => {
  it('finds the junction where two lines share a vertex and lists the ways out of it', () => {
    const graph = buildStreetGraph([tJunction()]);

    expect(graph.junctionsOf.get(`${KEY}/0`)).toEqual([1]);
    expect(graph.junctionsOf.get(`${KEY}/1`)).toEqual([0]);
    expect(exitsFrom(graph, `${KEY}/0`, 1)).toEqual([
      { lineKey: `${KEY}/0`, vertexIndex: 1, direction: 1 },
      { lineKey: `${KEY}/0`, vertexIndex: 1, direction: -1 },
      { lineKey: `${KEY}/1`, vertexIndex: 0, direction: 1 },
    ]);
  });

  it('joins a road across the tile border once the neighbour tile is in', () => {
    const crossing = [
      { x: 4000, y: 1000 },
      { x: 4200, y: 1000 },
    ];
    const west = roadLinesOfTile([road([crossing])], TILE, EXTENT, TILE_SIZE_M);
    const east = roadLinesOfTile(
      [road([crossing.map(point => ({ x: point.x - EXTENT, y: point.y }))])],
      EAST_TILE,
      EXTENT,
      TILE_SIZE_M
    );

    const alone = buildStreetGraph([west]);
    const joined = buildStreetGraph([west, east]);

    expect(alone.junctionsOf.get(west[0].key)).toEqual([]);
    expect(joined.junctionsOf.get(west[0].key)).toEqual([1]);
    expect(exitsFrom(joined, west[0].key, 1).map(exit => exit.lineKey)).toContain(east[0].key);
  });

  it('offers a border end with no neighbour as a way in, respecting one-way roads', () => {
    const [inbound, outbound] = roadLinesOfTile(
      [
        road(
          [
            [
              { x: 0, y: 500 },
              { x: 300, y: 500 },
            ],
          ],
          1
        ),
        road(
          [
            [
              { x: 0, y: 700 },
              { x: 300, y: 700 },
            ],
          ],
          -1
        ),
      ],
      TILE,
      EXTENT,
      TILE_SIZE_M
    );

    const entries = entriesInto(buildStreetGraph([[inbound, outbound]]));

    expect(entries).toEqual([{ lineKey: inbound.key, vertexIndex: 0, direction: 1 }]);
  });
});
