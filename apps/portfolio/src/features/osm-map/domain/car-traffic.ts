import type { Vector2 } from '@frozik/utils/math/vector2';

import type { CarBody } from './car-bodies';
import { carLengthM } from './car-bodies';
import {
  CAR_MIN_GAP_M,
  JUNCTION_ZONE_M,
  KEEP_STRAIGHT_PROBABILITY,
  MAX_YIELD_SECONDS,
  YIELD_DISTANCE_M,
} from './constants';
import type { RoadLine } from './road-lines';
import { laneOffset, poseAlongLine } from './road-lines';
import type { Exit, StreetGraph } from './street-graph';
import { exitsFrom } from './street-graph';
import type { TileKey } from './tile-key';

export interface Car {
  readonly lineKey: string;
  readonly distanceM: number;
  /** Along the line's point order, or against it. */
  readonly direction: 1 | -1;
  readonly speedMps: number;
  readonly body: CarBody;
  readonly colorIndex: number;
  /** How long the car has been held at a junction; past `MAX_YIELD_SECONDS` it goes regardless. */
  readonly yieldedSeconds: number;
}

export interface CarPose {
  readonly tileKey: TileKey;
  readonly x: number;
  readonly y: number;
  readonly headingRad: number;
  readonly body: CarBody;
  readonly colorIndex: number;
}

export type Random = () => number;

/** Distance driven along the car's direction, so "ahead" means "larger" whichever way the line runs. */
function progressOf(car: Car, line: RoadLine): number {
  return car.direction === 1 ? car.distanceM : line.lengthM - car.distanceM;
}

/** The line distance for a progress along `direction`; progress 0 is where a car in that direction starts. */
export function distanceAt(progress: number, direction: 1 | -1, line: RoadLine): number {
  return direction === 1 ? progress : line.lengthM - progress;
}

function progressOfVertex(vertexIndex: number, direction: 1 | -1, line: RoadLine): number {
  return direction === 1
    ? line.cumulativeM[vertexIndex]
    : line.lengthM - line.cumulativeM[vertexIndex];
}

/** The junction vertex the car reaches first when driving from `from` to `to`, if any. */
function nextJunction(
  graph: StreetGraph,
  car: Car,
  line: RoadLine,
  from: number,
  to: number
): number | undefined {
  const junctions = graph.junctionsOf.get(line.key) ?? [];
  const ordered = car.direction === 1 ? junctions : junctions.toReversed();
  return ordered.find(vertexIndex => {
    const at = progressOfVertex(vertexIndex, car.direction, line);
    return at > from && at <= to;
  });
}

function chooseExit(
  graph: StreetGraph,
  car: Car,
  vertexIndex: number,
  random: Random
): Exit | undefined {
  const exits = exitsFrom(graph, car.lineKey, vertexIndex);
  const straight = exits.find(
    exit => exit.lineKey === car.lineKey && exit.direction === car.direction
  );
  const turns = exits.filter(
    exit =>
      !(exit.lineKey === car.lineKey && exit.direction === -car.direction) && exit !== straight
  );
  if (straight !== undefined && (turns.length === 0 || random() < KEEP_STRAIGHT_PROBABILITY)) {
    return straight;
  }
  if (turns.length > 0) {
    return turns[Math.floor(random() * turns.length)];
  }
  return straight ?? exits[0];
}

/** A car's next junction along its way, if one lies ahead on its line. */
interface Approach {
  readonly vertexKey: string;
  /** Distance still to drive to the junction vertex. */
  readonly aheadM: number;
  readonly position: Vector2;
  readonly headingRad: number;
}

function approachOf(graph: StreetGraph, car: Car, line: RoadLine): Approach | undefined {
  const from = progressOf(car, line);
  const junctions = graph.junctionsOf.get(line.key) ?? [];
  const ordered = car.direction === 1 ? junctions : junctions.toReversed();
  const vertexIndex = ordered.find(index => progressOfVertex(index, car.direction, line) >= from);
  if (vertexIndex === undefined) {
    return undefined;
  }
  return {
    vertexKey: line.vertexKeys[vertexIndex],
    aheadM: progressOfVertex(vertexIndex, car.direction, line) - from,
    position: line.points[vertexIndex],
    headingRad: poseAlongLine(line, car.distanceM, car.direction).headingRad,
  };
}

/** Whether the other car, seen from this one's approach to the junction, comes from the right. */
function fromTheRight(mine: Approach, theirs: Approach): boolean {
  const heading = { x: Math.cos(mine.headingRad), y: Math.sin(mine.headingRad) };
  const away = { x: Math.cos(theirs.headingRad), y: Math.sin(theirs.headingRad) };
  return heading.x * away.y - heading.y * away.x > 0;
}

/**
 * Priority to the right: a car about to enter a junction waits while
 * another car from a different road is inside it, or is about to arrive
 * from its right. Cars on the same road never wait for each other here —
 * the follow rule keeps them apart — and a car already inside always
 * clears the junction.
 */
function mustYield(
  car: Car,
  mine: Approach,
  others: readonly { readonly car: Car; readonly approach: Approach }[]
): boolean {
  if (mine.aheadM <= JUNCTION_ZONE_M || car.yieldedSeconds >= MAX_YIELD_SECONDS) {
    return false;
  }
  return others.some(({ car: other, approach }) => {
    if (other === car || other.lineKey === car.lineKey) {
      return false;
    }
    const inside = approach.aheadM <= JUNCTION_ZONE_M;
    const arriving = approach.aheadM <= YIELD_DISTANCE_M && fromTheRight(mine, approach);
    return inside || arriving;
  });
}

/** One car's step: on along its line, through at most one junction, gone when it drives off the loaded roads. */
function stepCar(
  graph: StreetGraph,
  car: Car,
  ceiling: number,
  dtSeconds: number,
  random: Random
): Car | undefined {
  const line = graph.lines.get(car.lineKey);
  if (line === undefined) {
    return undefined;
  }
  const from = progressOf(car, line);
  const to = Math.max(from, Math.min(from + car.speedMps * dtSeconds, ceiling));
  const junction = nextJunction(graph, car, line, from, to);
  if (junction === undefined) {
    if (to < line.lengthM) {
      return { ...car, distanceM: distanceAt(to, car.direction, line) };
    }
    const endsAtBorder = car.direction === 1 ? line.bordersAtEnd : line.bordersAtStart;
    if (endsAtBorder) {
      return undefined;
    }
    const turned: 1 | -1 = car.direction === 1 ? -1 : 1;
    return { ...car, direction: turned, distanceM: distanceAt(0, turned, line) };
  }
  const exit = chooseExit(graph, car, junction, random);
  const onto = exit === undefined ? undefined : graph.lines.get(exit.lineKey);
  if (exit === undefined || onto === undefined) {
    return undefined;
  }
  const remaining = to - progressOfVertex(junction, car.direction, line);
  const progress = Math.min(
    progressOfVertex(exit.vertexIndex, exit.direction, onto) + remaining,
    onto.lengthM
  );
  return {
    ...car,
    lineKey: onto.key,
    direction: exit.direction,
    distanceM: distanceAt(progress, exit.direction, onto),
    yieldedSeconds: 0,
  };
}

interface Limit {
  /** Progress the car may not pass this step. */
  readonly ceiling: number;
  /** The ceiling is a junction the car is held at. */
  readonly yielding: boolean;
}

/** How far each car may drive this step: up to the car ahead on its road, and no further than a junction it must yield at. */
function limits(graph: StreetGraph, cars: readonly Car[]): Map<Car, Limit> {
  const result = new Map<Car, Limit>();
  const groups = new Map<string, Car[]>();
  const approaching = new Map<string, { car: Car; approach: Approach }[]>();
  for (const car of cars) {
    const line = graph.lines.get(car.lineKey);
    if (line === undefined) {
      continue;
    }
    const group = `${car.lineKey}:${car.direction}`;
    groups.set(group, [...(groups.get(group) ?? []), car]);
    const approach = approachOf(graph, car, line);
    if (approach !== undefined) {
      approaching.set(approach.vertexKey, [
        ...(approaching.get(approach.vertexKey) ?? []),
        { car, approach },
      ]);
    }
  }
  for (const members of groups.values()) {
    const line = graph.lines.get(members[0].lineKey);
    if (line === undefined) {
      continue;
    }
    const sorted = members.toSorted(
      (first, second) => progressOf(first, line) - progressOf(second, line)
    );
    sorted.forEach((car, index) => {
      const ahead = sorted[index + 1];
      const ceiling =
        ahead === undefined
          ? Number.POSITIVE_INFINITY
          : progressOf(ahead, line) -
            CAR_MIN_GAP_M -
            (carLengthM(ahead.body) + carLengthM(car.body)) / 2;
      result.set(car, { ceiling, yielding: false });
    });
  }
  for (const contenders of approaching.values()) {
    for (const { car, approach } of contenders) {
      const line = graph.lines.get(car.lineKey);
      if (line === undefined || !mustYield(car, approach, contenders)) {
        continue;
      }
      const stop = progressOf(car, line) + approach.aheadM - JUNCTION_ZONE_M;
      const current = result.get(car)?.ceiling ?? Number.POSITIVE_INFINITY;
      result.set(car, { ceiling: Math.min(current, stop), yielding: true });
    }
  }
  return result;
}

export interface TrafficStep {
  readonly cars: readonly Car[];
  /** Cars that drove off the loaded roads this step, to be replaced at the edges. */
  readonly departed: number;
}

const FREE: Limit = { ceiling: Number.POSITIVE_INFINITY, yielding: false };

/** Moves every car on by its speed, never through the car ahead, yielding at junctions, turning as it pleases. */
export function advanceCars(
  graph: StreetGraph,
  cars: readonly Car[],
  dtSeconds: number,
  random: Random
): TrafficStep {
  const limitOf = limits(graph, cars);
  const moved: Car[] = [];
  let departed = 0;
  for (const car of cars) {
    const limit = limitOf.get(car) ?? FREE;
    const waited = limit.yielding
      ? { ...car, yieldedSeconds: car.yieldedSeconds + dtSeconds }
      : car;
    const next = stepCar(graph, waited, limit.ceiling, dtSeconds, random);
    if (next === undefined) {
      departed++;
    } else {
      moved.push(next);
    }
  }
  return { cars: moved, departed };
}

export function carPoses(graph: StreetGraph, cars: readonly Car[]): readonly CarPose[] {
  return cars.flatMap((car): CarPose[] => {
    const line = graph.lines.get(car.lineKey);
    if (line === undefined) {
      return [];
    }
    const { position, headingRad } = laneOffset(
      poseAlongLine(line, car.distanceM, car.direction),
      line
    );
    return [
      {
        tileKey: line.tileKey,
        x: position.x,
        y: position.y,
        headingRad,
        body: car.body,
        colorIndex: car.colorIndex,
      },
    ];
  });
}
