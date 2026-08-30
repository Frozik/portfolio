import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { Wall, WallId } from '../model/walls';
import { pointAlongPolyline, polylineLength, subPolyline, wallCenterline } from './wall-geometry';

/** Endpoints closer than this are one junction — walls meet, wires continue. */
const JUNCTION_EPSILON_METERS = 0.05;

/** One end of a wire: pinned to a wall at an offset, or a free plan point. */
export type WireAnchor =
  | { readonly kind: 'wall'; readonly wallId: WallId; readonly offsetMeters: number }
  | { readonly kind: 'point'; readonly position: Vector2 };

interface WallRun {
  readonly wall: Wall;
  readonly centerline: readonly Vector2[];
  readonly length: number;
}

/**
 * The wire from one anchor to the other, laid the way ПУЭ lays it
 * (`building-editor.md` §8): ALONG the walls wherever they connect — the run
 * walks the wall graph from the device's wall to the panel's, junction by
 * junction — and an orthogonal L only where no walls carry it (a ceiling
 * light, or walls that never meet). Junctions are shared endpoints;
 * mid-segment T-joints are the v1 simplification the notes record.
 */
export function routeWire(
  walls: readonly Wall[],
  from: WireAnchor,
  to: WireAnchor
): readonly Vector2[] {
  const runs = walls.map(wall => ({
    wall,
    centerline: wallCenterline(wall),
    length: polylineLength(wallCenterline(wall)),
  }));
  const fromPoint = anchorPoint(runs, from);
  const toPoint = anchorPoint(runs, to);

  if (isNil(fromPoint) || isNil(toPoint)) {
    return [];
  }

  if (from.kind === 'wall' && to.kind === 'wall') {
    const alongWalls = routeAlongWalls(runs, from, to);

    if (!isNil(alongWalls)) {
      return alongWalls;
    }
  }

  return orthogonalRoute(fromPoint, toPoint);
}

/** The plan point an anchor stands at, resolved against the walls. */
function anchorPoint(runs: readonly WallRun[], anchor: WireAnchor): Vector2 | undefined {
  if (anchor.kind === 'point') {
    return anchor.position;
  }

  const run = runs.find(candidate => candidate.wall.id === anchor.wallId);

  if (isNil(run)) {
    return undefined;
  }

  return pointAlongPolyline(run.centerline, anchor.offsetMeters);
}

/** The classic dog-leg: horizontal first, then vertical — never a diagonal. */
function orthogonalRoute(from: Vector2, to: Vector2): readonly Vector2[] {
  if (from.x === to.x || from.y === to.y) {
    return [from, to];
  }

  return [from, { x: to.x, y: from.y }, to];
}

interface GraphStep {
  readonly wallId: WallId;
  /** The offset along this wall the wire ENTERED it at. */
  readonly entryOffset: number;
  readonly previous: GraphStep | undefined;
}

/** Breadth-first over walls joined at shared endpoints, stitched with subPolyline. */
function routeAlongWalls(
  runs: readonly WallRun[],
  from: Extract<WireAnchor, { readonly kind: 'wall' }>,
  to: Extract<WireAnchor, { readonly kind: 'wall' }>
): readonly Vector2[] | undefined {
  const byId = new Map(runs.map(run => [run.wall.id, run]));
  const start = byId.get(from.wallId);
  const target = byId.get(to.wallId);

  if (isNil(start) || isNil(target)) {
    return undefined;
  }

  if (from.wallId === to.wallId) {
    return subPolyline(start.centerline, from.offsetMeters, to.offsetMeters).length > 0
      ? subPolyline(
          start.centerline,
          Math.min(from.offsetMeters, to.offsetMeters),
          Math.max(from.offsetMeters, to.offsetMeters)
        )
      : undefined;
  }

  const visited = new Set<WallId>([from.wallId]);
  const queue: GraphStep[] = [
    { wallId: from.wallId, entryOffset: from.offsetMeters, previous: undefined },
  ];

  while (queue.length > 0) {
    const step = queue.shift();

    if (isNil(step)) {
      break;
    }

    if (step.wallId === to.wallId) {
      return stitchPath(byId, step, to.offsetMeters);
    }

    const run = byId.get(step.wallId);

    if (isNil(run)) {
      continue;
    }

    for (const next of runs) {
      if (visited.has(next.wall.id)) {
        continue;
      }

      const junction = findJunction(run, next);

      if (isNil(junction)) {
        continue;
      }

      visited.add(next.wall.id);
      queue.push({ wallId: next.wall.id, entryOffset: junction.nextOffset, previous: step });
    }
  }

  return undefined;
}

/** Where two walls meet — a shared endpoint — as offsets along each. */
function findJunction(
  run: WallRun,
  next: WallRun
): { readonly runOffset: number; readonly nextOffset: number } | undefined {
  const runEnds = [0, run.length];
  const nextEnds = [0, next.length];

  for (const runOffset of runEnds) {
    const runPoint = endpointAt(run, runOffset);

    for (const nextOffset of nextEnds) {
      const nextPoint = endpointAt(next, nextOffset);

      if (
        Math.hypot(runPoint.x - nextPoint.x, runPoint.y - nextPoint.y) <= JUNCTION_EPSILON_METERS
      ) {
        return { runOffset, nextOffset };
      }
    }
  }

  return undefined;
}

function endpointAt(run: WallRun, offset: number): Vector2 {
  return offset === 0 ? run.centerline[0] : run.centerline[run.centerline.length - 1];
}

/** Replays the BFS chain into one polyline, wall stretch by wall stretch. */
function stitchPath(
  byId: ReadonlyMap<WallId, WallRun>,
  last: GraphStep,
  finalOffset: number
): readonly Vector2[] | undefined {
  const chain: GraphStep[] = [];

  for (let step: GraphStep | undefined = last; !isNil(step); step = step.previous) {
    chain.unshift(step);
  }

  const points: Vector2[] = [];

  for (let index = 0; index < chain.length; index += 1) {
    const step = chain[index];
    const run = byId.get(step.wallId);
    const nextStep = chain[index + 1];
    const nextRun = isNil(nextStep) ? undefined : byId.get(nextStep.wallId);

    if (isNil(run) || (!isNil(nextStep) && isNil(nextRun))) {
      return undefined;
    }

    const exitOffset = isNil(nextRun) ? finalOffset : (findJunction(run, nextRun)?.runOffset ?? 0);
    const stretch = subPolyline(
      run.centerline,
      Math.min(step.entryOffset, exitOffset),
      Math.max(step.entryOffset, exitOffset)
    );
    const ordered = step.entryOffset <= exitOffset ? stretch : [...stretch].reverse();

    for (const point of ordered) {
      const previous = points[points.length - 1];

      if (isNil(previous) || Math.hypot(previous.x - point.x, previous.y - point.y) > 1e-9) {
        points.push(point);
      }
    }
  }

  return points.length > 1 ? points : undefined;
}
