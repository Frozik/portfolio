import type { Vector2 } from '@frozik/utils/math/vector2';

import { createRandom } from '../../domain/generator/random';
import { add, dot, length, normalize, scale, subtract } from '../../domain/vector';
import type { DustWindow } from './particles';
import { grownBy, isWithin, middleOf, reachOf } from './sky-window';

const MIN_WAIT_SECONDS = 45;
const MAX_WAIT_SECONDS = 100;
/** The first one is not long coming, so a new world shows what its sky does. */
const FIRST_WAIT_SECONDS = 8;
const SPEED_METERS_PER_SECOND = 1.5;
/** A pull this nearly whole has settled on its floor: one still turning is shorter, and points between two floors. */
const SETTLED_PULL = 0.999;
/** Half the truss, tip to middle: the whole of it is half as wide as a middling galaxy's radius. */
export const STATION_HALF_SPAN_METERS = 1.05;
/** The circle that holds the whole of it, the outermost wing's far corner included, in half spans. */
const REACH_SHARE = 1.25;
export const STATION_REACH_METERS = STATION_HALF_SPAN_METERS * REACH_SHARE;
const OFFSCREEN_MARGIN_METERS = 0.5;
/** The way in crosses the screen through its middle part, never along an edge. */
const THROUGH_SHARE = 0.5;
/** How much of a pan it is carried along with: nearer than the galaxies, further than any mote. */
const CAMERA_CARRY_SHARE = 0.7;
const FULL_TURN = Math.PI * 2;

export interface Station {
  readonly position: Vector2;
  /** A unit vector, the way its modules are strung: the pull it set out along, kept for the whole pass. */
  readonly attitude: Vector2;
  readonly ageSeconds: number;
  /** How far round its day it was when it set out, 0 to 1: what it is lit by follows from this and its age. */
  readonly dayShare: number;
  /** A unit vector in its own frame: the way the planet's shadow comes over it and goes. */
  readonly shadowWay: Vector2;
}

export interface StationSky {
  readonly seed: number;
  /** How many have passed: what the next one is drawn from. */
  readonly passes: number;
  /** Until the next one sets out, while none is on its way. */
  readonly waitSeconds: number;
  /** What the camera showed a frame ago, to tell how far it has panned since. */
  readonly visible: DustWindow;
  readonly station: Station | undefined;
}

export function createStationSky(seed: number, visible: DustWindow): StationSky {
  return { seed, passes: 0, waitSeconds: FIRST_WAIT_SECONDS, visible, station: undefined };
}

/**
 * The sky a moment later. A station on its way falls the way the board's
 * gravity pulls, as the dust does: when the floor changes it goes the new
 * way — sideways or tail first, since it cannot turn — and through
 * weightlessness it hangs still. It comes in from off the screen and is
 * over once it is off it again and falling away, so it is never seen to
 * start or stop.
 */
export function advanceStationSky(
  sky: StationSky,
  gravity: Vector2,
  dt: number,
  visible: DustWindow
): StationSky {
  if (sky.station !== undefined) {
    const station = flown(sky.station, {
      gravity,
      dt,
      panned: subtract(middleOf(visible), middleOf(sky.visible)),
    });
    if (!isGone(station, gravity, visible)) {
      return { ...sky, visible, station };
    }
    const random = createRandom(`${sky.seed}/station/${sky.passes}/wait`);
    return {
      ...sky,
      visible,
      passes: sky.passes + 1,
      waitSeconds: MIN_WAIT_SECONDS + random.next() * (MAX_WAIT_SECONDS - MIN_WAIT_SECONDS),
      station: undefined,
    };
  }
  const waitSeconds = sky.waitSeconds - dt;
  if (waitSeconds > 0) {
    return { ...sky, visible, waitSeconds };
  }
  return { ...sky, visible, waitSeconds: 0, station: launched(sky, gravity, visible) };
}

function flown(
  station: Station,
  frame: { readonly gravity: Vector2; readonly dt: number; readonly panned: Vector2 }
): Station {
  return {
    ...station,
    ageSeconds: station.ageSeconds + frame.dt,
    position: add(
      add(station.position, scale(frame.panned, CAMERA_CARRY_SHARE)),
      scale(frame.gravity, SPEED_METERS_PER_SECOND * frame.dt)
    ),
  };
}

function isGone(station: Station, gravity: Vector2, visible: DustWindow): boolean {
  if (isWithin(launchBoundsOf(visible), station.position)) {
    return false;
  }
  return dot(subtract(middleOf(visible), station.position), gravity) < 0;
}

/** A new station, upstream of the pull and off the screen, or none yet while the floor is still turning. */
function launched(sky: StationSky, gravity: Vector2, visible: DustWindow): Station | undefined {
  if (length(gravity) < SETTLED_PULL) {
    return undefined;
  }
  const heading = normalize(gravity);
  const random = createRandom(`${sky.seed}/station/${sky.passes}`);
  const through = {
    x:
      visible.min.x +
      (visible.max.x - visible.min.x) * (0.5 + (random.next() - 0.5) * THROUGH_SHARE),
    y:
      visible.min.y +
      (visible.max.y - visible.min.y) * (0.5 + (random.next() - 0.5) * THROUGH_SHARE),
  };
  const [back] = reachOf(through, heading, launchBoundsOf(visible));
  const shadowTurn = random.next() * FULL_TURN;
  return {
    position: add(through, scale(heading, back)),
    attitude: heading,
    ageSeconds: 0,
    dayShare: random.next(),
    shadowWay: { x: Math.cos(shadowTurn), y: Math.sin(shadowTurn) },
  };
}

function launchBoundsOf(visible: DustWindow): DustWindow {
  return grownBy(visible, STATION_REACH_METERS + OFFSCREEN_MARGIN_METERS);
}
