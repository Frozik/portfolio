import { carLengthM } from './car-bodies';
import { enterCars, seedCars } from './car-fleet';
import type { Car } from './car-traffic';
import { advanceCars, carPoses } from './car-traffic';
import {
  CAR_MIN_GAP_M,
  JUNCTION_ZONE_M,
  KEEP_STRAIGHT_PROBABILITY,
  MAX_YIELD_SECONDS,
} from './constants';
import type { TileRoad } from './road-lines';
import { roadLinesOfTile } from './road-lines';
import { buildStreetGraph } from './street-graph';
import { tileKeyOf } from './tile-key';

const EXTENT = 4096;
const TILE_SIZE_M = 4096;
const TILE = { z: 14, x: 10, y: 20 };
const KEY = tileKeyOf(TILE);

function road(
  lines: TileRoad['lines'],
  roadClass: TileRoad['roadClass'] = 'minor',
  oneway: TileRoad['oneway'] = 0
): TileRoad {
  return { lines, roadClass, oneway };
}

function car(overrides: Partial<Car>): Car {
  return {
    lineKey: `${KEY}/0`,
    distanceM: 0,
    direction: 1,
    speedMps: 10,
    body: 'sedan',
    colorIndex: 0,
    yieldedSeconds: 0,
    ...overrides,
  };
}

const ALWAYS_STRAIGHT = (): number => KEEP_STRAIGHT_PROBABILITY - 0.01;
const ALWAYS_TURN = (): number => KEEP_STRAIGHT_PROBABILITY + 0.01;

describe('car traffic', () => {
  it('seeds busier roads denser, the same cars for the same seed', () => {
    const lines = roadLinesOfTile(
      [
        road(
          [
            [
              { x: 100, y: 100 },
              { x: 2100, y: 100 },
            ],
          ],
          'secondary'
        ),
        road(
          [
            [
              { x: 100, y: 200 },
              { x: 2100, y: 200 },
            ],
          ],
          'service'
        ),
      ],
      TILE,
      EXTENT,
      TILE_SIZE_M
    );

    const cars = seedCars(lines, 7);
    const onSecondary = cars.filter(item => item.lineKey === lines[0].key).length;
    const onService = cars.filter(item => item.lineKey === lines[1].key).length;

    expect(onSecondary).toBeGreaterThan(onService * 3);
    expect(seedCars(lines, 7)).toEqual(cars);
    expect(cars.some(item => item.direction === -1)).toBe(true);
  });

  it('moves a car on by its speed and never through the one ahead', () => {
    const lines = roadLinesOfTile(
      [
        road(
          [
            [
              { x: 0, y: 100 },
              { x: 1000, y: 100 },
            ],
          ],
          'minor',
          1
        ),
      ],
      TILE,
      EXTENT,
      TILE_SIZE_M
    );
    const graph = buildStreetGraph([lines]);
    const slow = car({ distanceM: 50, speedMps: 1, body: 'bus', colorIndex: 1 });
    const fast = car({ distanceM: 20, speedMps: 30, colorIndex: 2 });
    const gapM = CAR_MIN_GAP_M + (carLengthM('bus') + carLengthM('sedan')) / 2;

    const { cars, departed } = advanceCars(graph, [fast, slow], 1, ALWAYS_STRAIGHT);

    expect(departed).toBe(0);
    expect(cars.map(item => item.distanceM)).toEqual([50 - gapM, 51]);
  });

  it('turns at a junction when it feels like it, and carries the leftover distance onto the new road', () => {
    const lines = roadLinesOfTile(
      [
        road(
          [
            [
              { x: 0, y: 100 },
              { x: 200, y: 100 },
              { x: 400, y: 100 },
            ],
          ],
          'minor',
          1
        ),
        road(
          [
            [
              { x: 200, y: 100 },
              { x: 200, y: 600 },
            ],
          ],
          'minor',
          1
        ),
      ],
      TILE,
      EXTENT,
      TILE_SIZE_M
    );
    const graph = buildStreetGraph([lines]);
    const approaching = car({ distanceM: 195, speedMps: 10 });

    const straight = advanceCars(graph, [approaching], 1, ALWAYS_STRAIGHT).cars[0];
    const turned = advanceCars(graph, [approaching], 1, ALWAYS_TURN).cars[0];

    expect(straight).toMatchObject({ lineKey: lines[0].key, distanceM: 205 });
    expect(turned).toMatchObject({ lineKey: lines[1].key, distanceM: 5, direction: 1 });
    expect(carPoses(graph, [turned])[0]).toMatchObject({ tileKey: KEY, x: 200, y: -105 });
  });

  it('turns around at a dead end inside the tile but leaves at the tile border, and others come in', () => {
    const lines = roadLinesOfTile(
      [
        road([
          [
            { x: 0, y: 100 },
            { x: 100, y: 100 },
          ],
        ]),
        road([
          [
            { x: 500, y: 500 },
            { x: 600, y: 500 },
          ],
        ]),
      ],
      TILE,
      EXTENT,
      TILE_SIZE_M
    );
    const graph = buildStreetGraph([lines]);
    const leaving = car({ lineKey: lines[0].key, distanceM: 5, direction: -1, speedMps: 10 });
    const deadEnding = car({ lineKey: lines[1].key, distanceM: 95, direction: 1, speedMps: 10 });

    const { cars, departed } = advanceCars(graph, [leaving, deadEnding], 1, ALWAYS_STRAIGHT);
    const entered = enterCars(graph, departed, ALWAYS_STRAIGHT);

    expect(departed).toBe(1);
    expect(cars).toEqual([{ ...deadEnding, direction: -1, distanceM: 100 }]);
    expect(entered).toHaveLength(1);
    expect(entered[0]).toMatchObject({ lineKey: lines[0].key, distanceM: 0, direction: 1 });
  });

  it('waits at the junction for a car coming from the right, then goes once it has waited long enough', () => {
    const lines = roadLinesOfTile(
      [
        road(
          [
            [
              { x: 0, y: 100 },
              { x: 200, y: 100 },
              { x: 400, y: 100 },
            ],
          ],
          'minor',
          1
        ),
        road(
          [
            [
              { x: 200, y: 300 },
              { x: 200, y: 100 },
              { x: 200, y: 0 },
            ],
          ],
          'minor',
          1
        ),
      ],
      TILE,
      EXTENT,
      TILE_SIZE_M
    );
    const graph = buildStreetGraph([lines]);
    const eastbound = car({ lineKey: lines[0].key, distanceM: 170, speedMps: 30 });
    const northbound = car({ lineKey: lines[1].key, distanceM: 180, speedMps: 10 });
    const parked = { ...northbound, speedMps: 0 };

    const { cars } = advanceCars(graph, [eastbound, northbound], 1, ALWAYS_STRAIGHT);
    let waiting = [eastbound, parked];
    for (let second = 0; second <= MAX_YIELD_SECONDS; second++) {
      waiting = [...advanceCars(graph, waiting, 1, ALWAYS_STRAIGHT).cars];
    }

    expect(cars[0].distanceM).toBe(200 - JUNCTION_ZONE_M);
    expect(cars[1].distanceM).toBe(190);
    expect(waiting[0].distanceM).toBeGreaterThan(200);
  });
});
