import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState } from './ball';
import { createBall } from './ball';
import { distanceToSegment } from './collision';
import { BALL_RADIUS_METERS, CONTACT_EPSILON_METERS } from './constants';
import { carveCup, cupCenter, hasCup } from './cup';
import type { Sector, SectorSize } from './generator/generate-sector';
import {
  generateSector,
  NEIGHBOUR_REACH_SECTORS,
  sectorAt,
  sectorBounds,
  sectorKey,
} from './generator/generate-sector';
import { placeCup } from './generator/place-cup';
import { createRandom } from './generator/random';
import type { Bounds, Edge, Level } from './level';
import { edgeOf } from './level';
import { rodSeat } from './rods';
import { dot, ZERO } from './vector';

/** The next cup lies this many sectors from the one just played, counted along the axes — Manhattan distance. */
const CUP_MIN_SECTORS = 1;
const CUP_MAX_SECTORS = 3;
/** Sectors always kept round the ball: the block of three by three. */
const KEPT_RING_SECTORS = 1;
const ON_FACE_TOLERANCE_METERS = 1e-6;

/** The cup: a notch in a face of one sector's wall, by that sector's own wall index. */
export interface CourseCup {
  readonly sector: string;
  readonly wall: number;
  readonly edge: number;
  readonly at: number;
  readonly radius: number;
}

/**
 * The endless course: the sectors of the plane made so far, in the order
 * they were made, and the one cup. `epoch` counts the holes played; it goes
 * into every new sector's seed, so the country beyond the kept sectors is a
 * new one after every hole.
 */
export interface Course {
  readonly worldSeed: number;
  readonly size: SectorSize;
  readonly epoch: number;
  readonly sectors: readonly Sector[];
  readonly cup: CourseCup | undefined;
  /** Where the very first ball started. */
  readonly spawn: Vector2;
}

/** The course and the ball together: the ball's per-obstacle states run in the order of the course's sectors. */
export interface Play {
  readonly course: Course;
  readonly ball: BallState;
}

/** One sector as a level of its own, for drawing it: its walls — the cup cut in if it is here — and what stands on them. */
export interface SectorSlice {
  readonly sector: Sector;
  readonly level: Level;
  /** The course's cup while it is cut into this sector. */
  readonly cup: CourseCup | undefined;
  /** Everything of it, overhang included. */
  readonly bounds: Bounds;
}

const levels = new WeakMap<Course, Level>();
const slices = new WeakMap<Course, readonly SectorSlice[]>();

/** The whole course as the one level the physics plays on: every sector's pieces in a row, the cup cut in. */
export function levelOf(course: Course): Level {
  let level = levels.get(course);
  if (level === undefined) {
    level = compose(course, course.sectors);
    levels.set(course, level);
  }
  return level;
}

export function slicesOf(course: Course): readonly SectorSlice[] {
  let made = slices.get(course);
  if (made === undefined) {
    made = course.sectors.map(sector => ({
      sector,
      level: compose(course, [sector]),
      cup: course.cup?.sector === keyOf(sector) ? course.cup : undefined,
      bounds: boundsOf(sector),
    }));
    slices.set(course, made);
  }
  return made;
}

function compose(course: Course, sectors: readonly Sector[]): Level {
  const cupSector =
    course.cup === undefined ? -1 : sectors.findIndex(each => keyOf(each) === course.cup?.sector);
  const wallsBefore = sectors
    .slice(0, Math.max(cupSector, 0))
    .reduce((sum, each) => sum + each.walls.length, 0);
  const level: Level = {
    seed: course.worldSeed,
    walls: sectors.flatMap(sector => sector.walls),
    tee: course.spawn,
    cup:
      course.cup === undefined || cupSector < 0
        ? undefined
        : { ...course.cup, wall: wallsBefore + course.cup.wall },
    spikes: sectors.flatMap(sector => sector.spikes),
    floaters: sectors.flatMap(sector => sector.floaters),
    rods: sectors.flatMap(sector => sector.rods),
  };
  return hasCup(level) ? carveCup(level) : level;
}

function keyOf(sector: Sector): string {
  return sectorKey(sector.sx, sector.sy);
}

function boundsOf(sector: Sector): Bounds {
  const xs = sector.walls.flatMap(wall => [wall.bounds.min.x, wall.bounds.max.x]);
  const ys = sector.walls.flatMap(wall => [wall.bounds.min.y, wall.bounds.max.y]);
  return {
    min: { x: Math.min(...xs), y: Math.min(...ys) },
    max: { x: Math.max(...xs), y: Math.max(...ys) },
  };
}

export function hasSector(course: Course, sx: number, sy: number): boolean {
  const key = sectorKey(sx, sy);
  return course.sectors.some(sector => keyOf(sector) === key);
}

/** The keys of the block of sectors round a point that is always kept. */
function keptRound(course: Course, point: Vector2): readonly { sx: number; sy: number }[] {
  const center = sectorAt(course.size, point);
  const ring: { sx: number; sy: number }[] = [];
  for (let dy = -KEPT_RING_SECTORS; dy <= KEPT_RING_SECTORS; dy += 1) {
    for (let dx = -KEPT_RING_SECTORS; dx <= KEPT_RING_SECTORS; dx += 1) {
      ring.push({ sx: center.sx + dx, sy: center.sy + dy });
    }
  }
  return ring;
}

/**
 * The play with the sector at `(sx, sy)` made, if it was not there: made
 * among the sectors standing within reach, clear of the ball, and appended —
 * so nothing the ball's states are indexed by moves — with its spikes,
 * floaters and rods in their starting states.
 */
export function withSector(play: Play, sx: number, sy: number): Play {
  if (hasSector(play.course, sx, sy)) {
    return play;
  }
  const { course, ball } = play;
  const sector = generateSector({
    worldSeed: course.worldSeed,
    epoch: course.epoch,
    sx,
    sy,
    size: course.size,
    neighbours: course.sectors.filter(
      each =>
        Math.abs(each.sx - sx) <= NEIGHBOUR_REACH_SECTORS &&
        Math.abs(each.sy - sy) <= NEIGHBOUR_REACH_SECTORS
    ),
    keepClear: [ball.position, ball.rest.position],
    withTee: false,
  });
  return {
    course: { ...course, sectors: [...course.sectors, sector] },
    ball: {
      ...ball,
      spikes: [...ball.spikes, ...sector.spikes.map(row => row.extendedAtStart)],
      floaters: [...ball.floaters, ...sector.floaters.map(floater => floater.largeAtStart)],
      rods: [...ball.rods, ...sector.rods.map(() => 0)],
    },
  };
}

/**
 * The play with only the sectors `keep` names — the cup's is always kept —
 * and the ball's states of the dropped ones cut out with them. What the
 * ball touched is forgotten too: the indices it was held by have moved.
 */
export function keepingSectors(play: Play, keep: ReadonlySet<string>): Play {
  const { course, ball } = play;
  const stays = (sector: Sector): boolean =>
    keep.has(keyOf(sector)) || keyOf(sector) === course.cup?.sector;
  if (course.sectors.every(stays)) {
    return play;
  }
  const spikes: boolean[] = [];
  const floaters: boolean[] = [];
  const rods: number[] = [];
  let spikeAt = 0;
  let floaterAt = 0;
  let rodAt = 0;
  for (const sector of course.sectors) {
    if (stays(sector)) {
      spikes.push(...ball.spikes.slice(spikeAt, spikeAt + sector.spikes.length));
      floaters.push(...ball.floaters.slice(floaterAt, floaterAt + sector.floaters.length));
      rods.push(...ball.rods.slice(rodAt, rodAt + sector.rods.length));
    }
    spikeAt += sector.spikes.length;
    floaterAt += sector.floaters.length;
    rodAt += sector.rods.length;
  }
  return {
    course: { ...course, sectors: course.sectors.filter(stays) },
    ball: { ...ball, spikes, floaters, rods, contact: undefined },
  };
}

/** A new world: the first sector with its tee shelf, the block round it, the first cup, the ball on the tee. */
export function startCourse(worldSeed: number, size: SectorSize): Play {
  const first = generateSector({
    worldSeed,
    epoch: 0,
    sx: 0,
    sy: 0,
    size,
    neighbours: [],
    keepClear: [],
    withTee: true,
  });
  const spawn = first.tee ?? ZERO;
  const bare: Course = { worldSeed, size, epoch: 0, sectors: [first], cup: undefined, spawn };
  const onTee: Play = { course: bare, ball: createBall(levelOf(bare)) };
  const ringed = keptRound(bare, spawn).reduce(
    (play, { sx, sy }) => withSector(play, sx, sy),
    onTee
  );
  return withNextCup(ringed, { sx: 0, sy: 0 });
}

/**
 * The play after a hole-out: the notch fills and lifts the ball onto the
 * face it was cut in, the epoch moves on, everything but the block round
 * the ball is dropped, and the next cup is cut somewhere else.
 */
export function afterHoleOut(play: Play): Play {
  const level = levelOf(play.course);
  if (play.course.cup === undefined || !hasCup(level)) {
    return play;
  }
  const face = edgeOf(level, level.cup);
  const center = cupCenter(level);
  const lift = BALL_RADIUS_METERS + CONTACT_EPSILON_METERS;
  const position = { x: center.x + face.normal.x * lift, y: center.y + face.normal.y * lift };
  const down = { x: -face.normal.x, y: -face.normal.y };
  const played = play.course.cup.sector.split(',').map(Number);
  const lifted: Play = {
    course: { ...play.course, epoch: play.course.epoch + 1, cup: undefined },
    ball: {
      ...play.ball,
      position,
      velocity: ZERO,
      down,
      phase: 'aiming',
      rest: { position, down },
      contact: undefined,
      cupSeconds: 0,
      settlingSeconds: 0,
      flightSeconds: 0,
      airborneSeconds: 0,
    },
  };
  const kept = new Set(keptRound(lifted.course, position).map(({ sx, sy }) => sectorKey(sx, sy)));
  return withNextCup(keepingSectors(lifted, kept), { sx: played[0], sy: played[1] });
}

/**
 * The play with a cup cut one to three sectors, in Manhattan distance, from
 * `from`: the distance and then the sector are drawn, the sector made if it
 * is not there, and a face found on it; a sector with no face for a cup
 * gives way to the next, and a distance with none to the others.
 */
function withNextCup(play: Play, from: { readonly sx: number; readonly sy: number }): Play {
  const random = createRandom(`${play.course.worldSeed}/cup/${play.course.epoch}`);
  const first = random.int(CUP_MIN_SECTORS, CUP_MAX_SECTORS);
  const distances = [first];
  for (let distance = CUP_MIN_SECTORS; distance <= CUP_MAX_SECTORS; distance += 1) {
    if (distance !== first) {
      distances.push(distance);
    }
  }
  let current = play;
  for (const distance of distances) {
    const ring = manhattanRing(distance);
    while (ring.length > 0) {
      const [offset] = ring.splice(random.int(0, ring.length - 1), 1);
      const sx = from.sx + offset.sx;
      const sy = from.sy + offset.sy;
      current = withSector(current, sx, sy);
      const sector = current.course.sectors.find(each => each.sx === sx && each.sy === sy);
      const cup =
        sector === undefined
          ? undefined
          : placeCup(
              random,
              sector.walls,
              sectorBounds(current.course.size, sx, sy),
              current.ball.position,
              face => isTaken(current.course, sector, face)
            );
      if (cup !== undefined) {
        return {
          ...current,
          course: { ...current.course, cup: { ...cup, sector: sectorKey(sx, sy) } },
        };
      }
    }
  }
  return current;
}

function manhattanRing(distance: number): { sx: number; sy: number }[] {
  const ring: { sx: number; sy: number }[] = [];
  for (let dx = -distance; dx <= distance; dx += 1) {
    const dy = distance - Math.abs(dx);
    ring.push({ sx: dx, sy: dy });
    if (dy !== 0) {
      ring.push({ sx: dx, sy: -dy });
    }
  }
  return ring;
}

/** Whether something already stands on the face: a spike row, or the plate of a rod sliding out of it or seating in it. */
function isTaken(course: Course, sector: Sector, face: Edge): boolean {
  const onFace = (point: Vector2): boolean =>
    distanceToSegment(point, face) < ON_FACE_TOLERANCE_METERS;
  return (
    sector.spikes.some(row => dot(row.base.normal, face.normal) > 0 && onFace(row.base.from)) ||
    course.sectors.some(each => each.rods.some(rod => onFace(rod.base) || onFace(rodSeat(rod))))
  );
}
