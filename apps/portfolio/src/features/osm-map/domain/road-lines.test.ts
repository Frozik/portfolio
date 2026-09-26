import { LANE_OFFSET_M } from './constants';
import type { RoadLine, TileRoad } from './road-lines';
import { laneOffset, poseAlongLine, roadLinesOfTile } from './road-lines';
import { tileKeyOf } from './tile-key';

const EXTENT = 4096;
/** One tile unit is one metre, so the numbers can be read off directly. */
const TILE_SIZE_M = 4096;
const WEST_TILE = { z: 14, x: 10, y: 20 };
const EAST_TILE = { z: 14, x: 11, y: 20 };

function road(lines: TileRoad['lines'], oneway: TileRoad['oneway'] = 0): TileRoad {
  return { lines, roadClass: 'minor', oneway };
}

describe('road lines', () => {
  it('converts a line to plan metres from the tile corner with north up and lengths along it', () => {
    const [line] = roadLinesOfTile(
      [
        road(
          [
            [
              { x: 0, y: 100 },
              { x: 300, y: 100 },
              { x: 300, y: 400 },
            ],
          ],
          1
        ),
      ],
      WEST_TILE,
      EXTENT,
      TILE_SIZE_M
    );

    expect(line.key).toBe(`${tileKeyOf(WEST_TILE)}/0`);
    expect(line.points).toEqual([
      { x: 0, y: -100 },
      { x: 300, y: -100 },
      { x: 300, y: -400 },
    ]);
    expect(line.cumulativeM).toEqual([0, 300, 600]);
    expect(line.bordersAtStart).toBe(true);
    expect(line.bordersAtEnd).toBe(false);
  });

  it('cuts the buffer beyond the tile edge and keys the cut so the neighbour tile shares it', () => {
    const crossing = [
      { x: 4000, y: 1000 },
      { x: 4200, y: 1100 },
    ];
    const [west] = roadLinesOfTile([road([crossing])], WEST_TILE, EXTENT, TILE_SIZE_M);
    const [east] = roadLinesOfTile(
      [road([crossing.map(point => ({ x: point.x - EXTENT, y: point.y }))])],
      EAST_TILE,
      EXTENT,
      TILE_SIZE_M
    );

    expect(west.points[1]).toEqual({ x: 4096, y: -1048 });
    expect(west.bordersAtEnd).toBe(true);
    expect(east.points[0]).toEqual({ x: 0, y: -1048 });
    expect(east.bordersAtStart).toBe(true);
    expect(east.vertexKeys[0]).toBe(west.vertexKeys[1]);
  });

  it('splits a line that leaves the tile and comes back into two lines', () => {
    const lines = roadLinesOfTile(
      [
        road([
          [
            { x: 100, y: 100 },
            { x: -50, y: 200 },
            { x: 100, y: 300 },
          ],
        ]),
      ],
      WEST_TILE,
      EXTENT,
      TILE_SIZE_M
    );

    expect(lines).toHaveLength(2);
    expect(lines.map(line => line.key)).toEqual([
      `${tileKeyOf(WEST_TILE)}/0`,
      `${tileKeyOf(WEST_TILE)}/1`,
    ]);
  });

  it('poses a car along the line facing its way, and keeps a two-way car to the right', () => {
    const [line] = roadLinesOfTile(
      [
        road([
          [
            { x: 0, y: 100 },
            { x: 300, y: 100 },
          ],
        ]),
      ],
      WEST_TILE,
      EXTENT,
      TILE_SIZE_M
    );

    const eastbound = laneOffset(poseAlongLine(line, 100, 1), line);
    const westbound = laneOffset(poseAlongLine(line, 100, -1), line);

    expect(eastbound.headingRad).toBeCloseTo(0, 9);
    expect(eastbound.position.y).toBeCloseTo(-100 - LANE_OFFSET_M, 9);
    expect(westbound.headingRad).toBeCloseTo(Math.PI, 9);
    expect(westbound.position.y).toBeCloseTo(-100 + LANE_OFFSET_M, 9);
  });

  it('leaves a one-way car on the centre line', () => {
    const line: RoadLine = {
      ...roadLinesOfTile(
        [
          road(
            [
              [
                { x: 0, y: 100 },
                { x: 300, y: 100 },
              ],
            ],
            1
          ),
        ],
        WEST_TILE,
        EXTENT,
        TILE_SIZE_M
      )[0],
    };

    expect(laneOffset(poseAlongLine(line, 50, 1), line).position).toEqual({ x: 50, y: -100 });
  });
});
