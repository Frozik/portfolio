import alea from 'alea';

import type { CarBody } from './car-bodies';
import { CAR_COLORS } from './car-bodies';
import type { Car, Random } from './car-traffic';
import { distanceAt } from './car-traffic';
import { CAR_SPACING_M, MAX_CARS_PER_TILE } from './constants';
import type { RoadClass, RoadLine } from './road-lines';
import type { StreetGraph } from './street-graph';
import { entriesInto } from './street-graph';

/** Cruising speeds vary this much around the road's; the street is not a conveyor belt. */
const SPEED_SPREAD = 0.15;
const BUS_ROADS: readonly RoadClass[] = ['primary', 'secondary', 'tertiary'];
/** Weighted body mix: mostly cars, a few vans, buses only on roads with a bus route. */
const BODY_MIX: readonly (readonly [CarBody, number])[] = [
  ['sedan', 0.35],
  ['hatchback', 0.25],
  ['crossover', 0.25],
  ['van', 0.1],
  ['bus', 0.05],
];
/** Cars per `CAR_SPACING_M` by road class: main roads are busy, service roads nearly empty. */
const DENSITY: Readonly<Record<RoadClass, number>> = {
  motorway: 0.6,
  trunk: 0.6,
  primary: 0.55,
  secondary: 0.5,
  tertiary: 0.45,
  minor: 0.3,
  service: 0.1,
};

function pickBody(roll: number, roadClass: RoadClass): CarBody {
  let remaining = roll;
  for (const [body, weight] of BODY_MIX) {
    remaining -= weight;
    if (remaining <= 0) {
      return body === 'bus' && !BUS_ROADS.includes(roadClass) ? 'van' : body;
    }
  }
  return 'sedan';
}

function newCar(line: RoadLine, distanceM: number, direction: 1 | -1, random: Random): Car {
  return {
    lineKey: line.key,
    distanceM,
    direction,
    speedMps: line.speedMps * (1 + (random() * 2 - 1) * SPEED_SPREAD),
    body: pickBody(random(), line.roadClass),
    colorIndex: Math.floor(random() * CAR_COLORS.length),
    yieldedSeconds: 0,
  };
}

function directionsOf(line: RoadLine): readonly (1 | -1)[] {
  return line.oneway === 0 ? [1, -1] : [line.oneway];
}

/**
 * Populates a tile's roads with cars, deterministically from the tile key
 * so a tile looks the same each time it comes back: the busier the road
 * class, the more cars per metre, scaled down together when the tile would
 * exceed its ceiling.
 */
export function seedCars(lines: readonly RoadLine[], seed: number): readonly Car[] {
  const random = alea(seed);
  const wanted = lines.map(
    line => (line.lengthM / CAR_SPACING_M) * DENSITY[line.roadClass] * directionsOf(line).length
  );
  const total = wanted.reduce((sum, count) => sum + count, 0);
  const scale = total > MAX_CARS_PER_TILE ? MAX_CARS_PER_TILE / total : 1;
  const cars: Car[] = [];
  lines.forEach((line, index) => {
    const expected = wanted[index] * scale;
    const count = Math.floor(expected) + (random() < expected - Math.floor(expected) ? 1 : 0);
    const directions = directionsOf(line);
    for (let car = 0; car < count; car++) {
      cars.push(newCar(line, random() * line.lengthM, directions[car % directions.length], random));
    }
  });
  return cars;
}

/** New cars driving in from beyond the loaded roads, as many as asked for and as there are ways in. */
export function enterCars(graph: StreetGraph, count: number, random: Random): readonly Car[] {
  const entries = entriesInto(graph);
  if (entries.length === 0) {
    return [];
  }
  const entered: Car[] = [];
  for (let index = 0; index < count; index++) {
    const entry = entries[Math.floor(random() * entries.length)];
    const line = graph.lines.get(entry.lineKey);
    if (line !== undefined) {
      entered.push(newCar(line, distanceAt(0, entry.direction, line), entry.direction, random));
    }
  }
  return entered;
}
