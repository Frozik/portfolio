import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { BallState } from '../domain/ball';
import { CELL_METERS } from '../domain/constants';
import type { Play } from '../domain/course';
import { hasSector, keepingSectors, withSector } from '../domain/course';
import type { SectorSize } from '../domain/generator/generate-sector';
import { sectorAt, sectorKey } from '../domain/generator/generate-sector';
import type { Bounds } from '../domain/level';
import { add, scale } from '../domain/vector';
import type { Size } from './camera';
import { VIEW_PIXELS_PER_METER } from './camera';

/** A sector is never smaller than this, in cells — twelve metres. */
const MIN_SECTOR_CELLS = 24;
/**
 * A brake on memory, not a rule of the game: past this many sectors the
 * seen ones farthest from the ball are forgotten, even before a hole-out.
 */
const MAX_SECTORS = 120;
/** While the ball rests the country is made this many sectors out from it in every direction: two screens. */
const AHEAD_RING_SECTORS = 2;
/** A flight makes the sector it will be in this much later, if it is not there. */
const FLIGHT_LOOKAHEAD_SECONDS = 0.5;

/** What the player has uncovered since the last hole-out, by sector key. */
export type Seen = ReadonlySet<string>;

/**
 * The size of a sector for a world made on this screen: each side the
 * larger of the minimum and what the screen shows along it at the one
 * scale. Fixed for the life of the world; a window resized or a phone
 * turned afterwards only shows more or fewer sectors.
 */
export function sectorSizeFor(screen: Size): SectorSize {
  const cells = (pixels: number): number =>
    Math.max(MIN_SECTOR_CELLS, Math.ceil(pixels / VIEW_PIXELS_PER_METER / CELL_METERS));
  return { widthCells: cells(screen.width), heightCells: cells(screen.height) };
}

interface Charted {
  readonly play: Play;
  readonly seen: Seen;
}

interface SectorIndex {
  readonly sx: number;
  readonly sy: number;
}

/** The play with the ball's own sector made, if it was not there: a ball never flies over ground that does not exist. */
export function ground(play: Play): Play {
  const here = sectorAt(play.course.size, play.ball.position);
  return withSector(play, here.sx, here.sy);
}

/**
 * A frame's work on the map: at most one sector beyond the ball's own, so
 * the making never shows as a hitch. A ball at rest is the time to make the
 * country — whatever the camera shows first, then the block of
 * `AHEAD_RING_SECTORS` round the ball, the nearest first — so that a flight
 * finds it standing. A flight stops that work at once and makes only what
 * it cannot do without: the sector it is heading into and what the camera
 * shows, when they are not there. What the camera shows is remembered as
 * seen, and past the cap the farthest of the seen is forgotten.
 */
export function chart(play: Play, seen: Seen, visible: Bounds): Charted {
  const grounded = ground(play);
  const { course, ball } = grounded;
  const here = sectorAt(course.size, ball.position);

  const shown = sectorsIn(course.size, visible);
  const wanted =
    ball.phase === 'aiming'
      ? [...shown, ...nearestFirst(blockRound(here, AHEAD_RING_SECTORS), here)]
      : [sectorAt(course.size, headingOf(ball)), ...shown];
  const missing = wanted.find(({ sx, sy }) => !hasSector(course, sx, sy));
  const made = isNil(missing) ? grounded : withSector(grounded, missing.sx, missing.sy);

  const nowSeen = new Set(seen);
  for (const { sx, sy } of shown) {
    if (hasSector(made.course, sx, sy)) {
      nowSeen.add(sectorKey(sx, sy));
    }
  }
  return forgetFarthest({ play: made, seen: nowSeen });
}

/** The play after a hole-out has dropped the far sectors: nothing is seen yet in the new country. */
export function nothingSeen(): Seen {
  return new Set();
}

function headingOf(ball: BallState): Vector2 {
  return add(ball.position, scale(ball.velocity, FLIGHT_LOOKAHEAD_SECONDS));
}

function forgetFarthest(charted: Charted): Charted {
  const { course, ball } = charted.play;
  if (course.sectors.length <= MAX_SECTORS) {
    return charted;
  }
  const here = sectorAt(course.size, ball.position);
  const ring = new Set(blockRound(here, AHEAD_RING_SECTORS).map(({ sx, sy }) => sectorKey(sx, sy)));
  const room = Math.max(0, MAX_SECTORS - ring.size);
  const nearestSeen = [...charted.seen]
    .filter(key => !ring.has(key))
    .map(key => {
      const [sx, sy] = key.split(',').map(Number);
      return { key, away: steps({ sx, sy }, here) };
    })
    .sort((a, b) => a.away - b.away)
    .slice(0, room)
    .map(each => each.key);
  const keep = new Set([...ring, ...nearestSeen]);
  return {
    play: keepingSectors(charted.play, keep),
    seen: new Set(nearestSeen),
  };
}

function sectorsIn(size: SectorSize, box: Bounds): readonly SectorIndex[] {
  return block(sectorAt(size, box.min), sectorAt(size, box.max));
}

function blockRound(center: SectorIndex, ring: number): readonly SectorIndex[] {
  return block(
    { sx: center.sx - ring, sy: center.sy - ring },
    { sx: center.sx + ring, sy: center.sy + ring }
  );
}

function block(from: SectorIndex, to: SectorIndex): readonly SectorIndex[] {
  const sectors: SectorIndex[] = [];
  for (let sy = from.sy; sy <= to.sy; sy += 1) {
    for (let sx = from.sx; sx <= to.sx; sx += 1) {
      sectors.push({ sx, sy });
    }
  }
  return sectors;
}

function nearestFirst(sectors: readonly SectorIndex[], here: SectorIndex): readonly SectorIndex[] {
  return [...sectors].sort((a, b) => steps(a, here) - steps(b, here));
}

function steps(a: SectorIndex, b: SectorIndex): number {
  return Math.abs(a.sx - b.sx) + Math.abs(a.sy - b.sy);
}
