import type { Vector2 } from '@frozik/utils/math/vector2';

import { createRandom } from '../../domain/generator/random';
import type { DustWindow } from './particles';

/** A comet comes by every so often: this long to wait between one and the next, at the shortest and the longest. */
const MIN_WAIT_SECONDS = 9;
const MAX_WAIT_SECONDS = 24;
/** The first one is not long coming, so a new world shows what its sky does. */
const FIRST_WAIT_SECONDS = 4;
const SPEED_METERS_PER_SECOND = 14;
/** The way in and out is laid this far beyond the screen, so the whole comet — tail and all — enters and leaves off it. */
export const OFFSCREEN_MARGIN_METERS = 3;
/** The way crosses the screen through its middle part, never grazing a corner. */
const THROUGH_SHARE = 0.6;
const FULL_TURN = Math.PI * 2;

/** One comet on its way: a straight line across the screen, and how far along it it has come. */
export interface Comet {
  readonly from: Vector2;
  readonly to: Vector2;
  readonly ageSeconds: number;
  readonly crossingSeconds: number;
}

export interface CometSky {
  readonly seed: number;
  /** How many have passed: what the next one is drawn from. */
  readonly passes: number;
  /** Until the next one sets out, while none is on its way. */
  readonly waitSeconds: number;
  readonly comet: Comet | undefined;
}

export function createCometSky(seed: number): CometSky {
  return { seed, passes: 0, waitSeconds: FIRST_WAIT_SECONDS, comet: undefined };
}

/** Where the comet is now: on its line, the share of the way it has come. */
export function cometPosition(comet: Comet): Vector2 {
  const share = Math.min(1, comet.ageSeconds / comet.crossingSeconds);
  return {
    x: comet.from.x + (comet.to.x - comet.from.x) * share,
    y: comet.from.y + (comet.to.y - comet.from.y) * share,
  };
}

/** Which way it flies: a unit vector along its line. */
export function cometHeading(comet: Comet): Vector2 {
  const dx = comet.to.x - comet.from.x;
  const dy = comet.to.y - comet.from.y;
  const size = Math.hypot(dx, dy);
  return { x: dx / size, y: dy / size };
}

/**
 * The sky a moment later: a comet on its way goes on, and gone off the
 * far side it is over; while none is about, the wait runs down, and when
 * it is out a new one sets off across whatever the screen shows now. It
 * flies straight and at its own speed — nothing of the board's gravity
 * reaches it — and its line is laid from off one edge to off the other,
 * so it is never seen to start or stop.
 */
export function advanceCometSky(sky: CometSky, dt: number, visible: DustWindow): CometSky {
  if (sky.comet !== undefined) {
    const ageSeconds = sky.comet.ageSeconds + dt;
    if (ageSeconds < sky.comet.crossingSeconds) {
      return { ...sky, comet: { ...sky.comet, ageSeconds } };
    }
    const random = createRandom(`${sky.seed}/comet/${sky.passes}/wait`);
    return {
      ...sky,
      passes: sky.passes + 1,
      waitSeconds: MIN_WAIT_SECONDS + random.next() * (MAX_WAIT_SECONDS - MIN_WAIT_SECONDS),
      comet: undefined,
    };
  }
  const waitSeconds = sky.waitSeconds - dt;
  if (waitSeconds > 0) {
    return { ...sky, waitSeconds };
  }
  return { ...sky, waitSeconds: 0, comet: launched(sky, visible) };
}

/** A new comet's line: through the middle part of the screen at any angle, from off one side to off the other. */
function launched(sky: CometSky, visible: DustWindow): Comet {
  const random = createRandom(`${sky.seed}/comet/${sky.passes}`);
  const angle = random.next() * FULL_TURN;
  const heading = { x: Math.cos(angle), y: Math.sin(angle) };
  const width = visible.max.x - visible.min.x;
  const height = visible.max.y - visible.min.y;
  const through = {
    x: visible.min.x + width * (0.5 + (random.next() - 0.5) * THROUGH_SHARE),
    y: visible.min.y + height * (0.5 + (random.next() - 0.5) * THROUGH_SHARE),
  };
  const bounds = {
    min: { x: visible.min.x - OFFSCREEN_MARGIN_METERS, y: visible.min.y - OFFSCREEN_MARGIN_METERS },
    max: { x: visible.max.x + OFFSCREEN_MARGIN_METERS, y: visible.max.y + OFFSCREEN_MARGIN_METERS },
  };
  const [back, ahead] = reachOf(through, heading, bounds);
  const from = { x: through.x + heading.x * back, y: through.y + heading.y * back };
  const to = { x: through.x + heading.x * ahead, y: through.y + heading.y * ahead };
  return {
    from,
    to,
    ageSeconds: 0,
    crossingSeconds: Math.hypot(to.x - from.x, to.y - from.y) / SPEED_METERS_PER_SECOND,
  };
}

/** How far a line through `point` along `heading` runs inside `bounds`, backwards and forwards. */
function reachOf(
  point: Vector2,
  heading: Vector2,
  bounds: DustWindow
): readonly [back: number, ahead: number] {
  let back = Number.NEGATIVE_INFINITY;
  let ahead = Number.POSITIVE_INFINITY;
  for (const axis of ['x', 'y'] as const) {
    if (heading[axis] === 0) {
      continue;
    }
    const toMin = (bounds.min[axis] - point[axis]) / heading[axis];
    const toMax = (bounds.max[axis] - point[axis]) / heading[axis];
    back = Math.max(back, Math.min(toMin, toMax));
    ahead = Math.min(ahead, Math.max(toMin, toMax));
  }
  return [back, ahead];
}
