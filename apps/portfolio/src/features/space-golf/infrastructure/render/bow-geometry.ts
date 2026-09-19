import type { Vector2 } from '@frozik/utils/math/vector2';

import { AIM_DEAD_ZONE_METERS, MAX_PULL_METERS } from '../../domain/constants';
import { distance } from '../../domain/vector';
import { paintLimb } from './limb-painting';
import type { MeshWriter } from './mesh-writer';
import { PALETTE, withAlpha } from './palette';
import type { DrawnBand } from './scene-frame';
import { around, twinkle, writeHaze, writeStar } from './spark-geometry';

/**
 * Every size here is in band metres — the same on the screen at any zoom —
 * and `meterOnBoard` puts it on the board. A band metre is 64 CSS pixels,
 * and the whole bow is two of them: the thin parts of a painted bow, drawn
 * to their true proportions, would fall under a pixel here, so the string,
 * the shaft and the grip are given the few pixels they need to read.
 */
const LIMB_HALF_HEIGHT_METERS = 1;
/** How far the grip stands ahead of the string at rest, so the unpulled string passes through the anchor. */
const BRACE_METERS = 0.22;
/** The straight middle of the bow, where the hand would be; the limbs grow out of its ends. */
const RISER_HALF_METERS = 0.14;
const LIMB_STEPS = 18;
/**
 * A limb is a blade, not a taper: narrow where it leaves the grip, broadest
 * a little past halfway where the painting goes, a thin horn at the tip.
 * Four half widths a cubic runs through, in band metres.
 */
const LIMB_HALF_WIDTHS_METERS = [0.042, 0.098, 0.088, 0.012] as const;
/** The lacquer sits inside a gold edge this much narrower than the limb. */
const GOLD_EDGE_METERS = 0.02;
/** The limb bellies out this far ahead of the grip, and its tip curls back this far behind the string: the recurve. */
const LIMB_BELLY_METERS = 0.46;
const TIP_CURL_METERS = 0.3;
/** The horn ends this far behind the string, so the recurve reads as a hook. */
const TIP_HOOK_METERS = 0.07;
/** Drawing the string bends the limbs back this far and draws their tips this much closer together. */
const TIP_GIVE_METERS = 0.26;
const TIP_CLOSE_SHARE = 0.05;

const STRING_WIDTH_METERS = 0.05;
const STRING_ALPHA_SLACK = 150;
const STRING_ALPHA_FULL = 245;
/** A drawn string hums: the light along it runs a little brighter and back. */
const STRING_HUM_RADIANS_PER_SECOND = 9;
const STRING_HUM_SHARE = 0.12;

/** The arrow lies on the string and points where the ball will fly, its head this far ahead of the grip. */
const ARROW_AHEAD_METERS = 0.62;
const ARROW_SHAFT_WIDTH_METERS = 0.055;
const ARROW_HEAD_LENGTH_METERS = 0.22;
const ARROW_HEAD_HALF_WIDTH_METERS = 0.095;
/** The fletching: two feathers off the tail, one white and one red, and the horn nock behind them. */
const FLETCHING_FROM_METERS = 0.06;
const FLETCHING_TO_METERS = 0.34;
const FLETCHING_HALF_WIDTH_METERS = 0.11;
/** Where along the feather it reaches its width, and how much of it is left at the rear. */
const FLETCHING_SHOULDER_SHARE = 0.22;
const FLETCHING_TRAIL_SHARE = 0.3;
const NOCK_BINDING_LENGTH_METERS = 0.06;
const NOCK_BINDING_HALF_WIDTH_METERS = 0.05;

/** The grip is the narrowest of the bow, but never narrower than the hand can see. */
const GRIP_HALF_WIDTH_METERS = 0.075;
/** The leather wrap on the grip and the gold rings that hold it. */
const WRAP_HALF_METERS = 0.105;
const WRAP_RING_HALF_METERS = 0.018;

/** The fingers' glow is amber and small: white and wide, it washed out the feathers lying in it. */
const NOCK_HAZE_ALPHA = 170;
/** The hand's own mark: a haze where the pull began, and one at the string's nock. */
const HAZE_RADIUS_METERS = 0.14;
const NOCK_HAZE_RADIUS_METERS = 0.075;
const HAZE_ALPHA_SLACK = 70;
const HAZE_ALPHA_FULL = 150;

/** Sparks of the gold: four-pointed stars riding the arrow, and a few turning about the nock. */
const ARROW_SPARKS = 3;
const NOCK_SPARKS = 3;
const SPARK_RADIUS_METERS = 0.05;
const SPARK_ALPHA = 245;
const SPARK_TRIPS_PER_SECOND = 0.5;
const NOCK_SPARK_AWAY_METERS = 0.24;
const NOCK_SPARK_RADIANS_PER_SECOND = 0.8;
const TWINKLE_RADIANS_PER_SECOND = 5.5;

const FULL_TURN = Math.PI * 2;

/**
 * The bow standing where the player pressed: its grip on the anchor, its
 * limbs across the way the ball will fly, and the string drawn back to the
 * finger.
 */
interface Bow {
  /** Board metres per band metre: everything is measured on the screen. */
  readonly meterOnBoard: number;
  readonly grip: Vector2;
  /** Where the ball will fly, and the way along the limbs from the grip. */
  readonly forward: Vector2;
  readonly across: Vector2;
  /** How far the string is drawn, in band metres, and that as a share of the strongest stroke. */
  readonly drawMeters: number;
  readonly drawn: number;
}

/**
 * The rubber band drawn as what it is — a bow, after the Khokhloma-painted
 * one the player brought: the grip stands where the press landed, the limbs
 * lie across the shot with their lacquer inside a gold edge and berries
 * along them, the string is drawn back to the finger, and the arrow on it
 * points where the ball will go. It is brighter the further the string is
 * drawn, with sparks of gold riding the arrow. A band too slack to play a
 * stroke shows no bow at all, and one drawn past the strongest stroke
 * draws no further. The arrow is nocked only while a stroke can be played:
 * the band may be pulled with the ball still moving, and then the bow is
 * drawn on nothing.
 */
export function writeBow(
  writer: MeshWriter,
  band: DrawnBand,
  shot: { readonly nocked: boolean; readonly timeSeconds: number }
): void {
  const { timeSeconds } = shot;
  const stretchMeters = distance(band.anchor, band.pull) / band.meterOnBoard;
  const drawn = Math.min(
    1,
    Math.max(0, (stretchMeters - AIM_DEAD_ZONE_METERS) / (MAX_PULL_METERS - AIM_DEAD_ZONE_METERS))
  );
  writeHaze(writer, band.anchor, {
    radius: HAZE_RADIUS_METERS * band.meterOnBoard,
    color: PALETTE.bandGlow,
    alpha: between(HAZE_ALPHA_SLACK, HAZE_ALPHA_FULL, drawn),
    timeSeconds,
  });
  // A slack band plays no stroke, so there is no bow to promise one: the
  // haze alone marks where the pull began, as the ring and the dots stay away too.
  if (stretchMeters < AIM_DEAD_ZONE_METERS) {
    return;
  }
  const forward = {
    x: (band.anchor.x - band.pull.x) / (stretchMeters * band.meterOnBoard),
    y: (band.anchor.y - band.pull.y) / (stretchMeters * band.meterOnBoard),
  };
  const bow: Bow = {
    meterOnBoard: band.meterOnBoard,
    grip: {
      x: band.anchor.x + forward.x * BRACE_METERS * band.meterOnBoard,
      y: band.anchor.y + forward.y * BRACE_METERS * band.meterOnBoard,
    },
    forward,
    across: { x: -forward.y, y: forward.x },
    // Past the strongest stroke the string has nowhere further to go: pulling on only turns the bow.
    drawMeters: Math.min(stretchMeters, MAX_PULL_METERS),
    drawn,
  };
  writeLimbs(writer, bow);
  writeString(writer, bow, timeSeconds);
  // The glow at the fingers goes under the arrow: over it, it washed the feathers out.
  writeHaze(writer, nockOf(bow), {
    radius: NOCK_HAZE_RADIUS_METERS * bow.meterOnBoard,
    color: PALETTE.bandGlow,
    alpha: NOCK_HAZE_ALPHA * drawn,
    timeSeconds,
  });
  if (shot.nocked) {
    writeArrow(writer, bow);
  }
  writeSparks(writer, bow, { nocked: shot.nocked, timeSeconds });
}

/** Where the fingers hold the string: on the bow's axis, the draw behind the grip. */
function nockOf(bow: Bow): Vector2 {
  return along(bow, -(BRACE_METERS + bow.drawMeters), 0);
}

/** A point of the bow's own frame on the board: `ahead` along the shot from the grip, `aside` across it. */
function along(bow: Bow, ahead: number, aside: number): Vector2 {
  return {
    x: bow.grip.x + (bow.forward.x * ahead + bow.across.x * aside) * bow.meterOnBoard,
    y: bow.grip.y + (bow.forward.y * ahead + bow.across.y * aside) * bow.meterOnBoard,
  };
}

/** The tip of one limb: its horn hooks a little past the string, and is drawn back and inward as the string is pulled. */
function tipOf(bow: Bow, side: number): Vector2 {
  return along(
    bow,
    -(BRACE_METERS + TIP_HOOK_METERS + TIP_GIVE_METERS * bow.drawn),
    side * LIMB_HALF_HEIGHT_METERS * (1 - TIP_CLOSE_SHARE * bow.drawn)
  );
}

/**
 * One limb from the riser to its tip, as a recurve: it bellies out ahead of
 * the grip and curls back at the tip. A cubic through four points, sampled
 * along.
 */
function limbPath(bow: Bow, side: number): readonly Vector2[] {
  const reach = LIMB_HALF_HEIGHT_METERS * (1 - TIP_CLOSE_SHARE * bow.drawn);
  const from = along(bow, 0, side * RISER_HALF_METERS);
  const bellyOut = along(bow, LIMB_BELLY_METERS, side * (RISER_HALF_METERS + reach * 0.4));
  const curlBack = along(
    bow,
    -(BRACE_METERS + TIP_CURL_METERS + TIP_GIVE_METERS * bow.drawn),
    side * reach * 0.9
  );
  const to = tipOf(bow, side);
  const path: Vector2[] = [];
  for (let step = 0; step <= LIMB_STEPS; step += 1) {
    path.push(cubicAt(from, bellyOut, curlBack, to, step / LIMB_STEPS));
  }
  return path;
}

function cubicAt(
  from: Vector2,
  first: Vector2,
  second: Vector2,
  to: Vector2,
  share: number
): Vector2 {
  return {
    x: cubicOf([from.x, first.x, second.x, to.x], share),
    y: cubicOf([from.y, first.y, second.y, to.y], share),
  };
}

/** A cubic through four numbers — a curve's coordinate, or a limb's width along it. */
function cubicOf(values: readonly [number, number, number, number], share: number): number {
  const rest = 1 - share;
  return (
    values[0] * rest ** 3 +
    values[1] * 3 * rest * rest * share +
    values[2] * 3 * rest * share * share +
    values[3] * share ** 3
  );
}

/** Both limbs and the grip between them: black lacquer inside a gold edge, with the painting over it. */
function writeLimbs(writer: MeshWriter, bow: Bow): void {
  const alpha = between(HAZE_ALPHA_FULL, 255, bow.drawn);
  for (const side of [1, -1]) {
    const path = limbPath(bow, side);
    const halfWidthAt = (index: number): number =>
      cubicOf(LIMB_HALF_WIDTHS_METERS, index / LIMB_STEPS) * bow.meterOnBoard;
    writer.ribbon(path, index => ({
      halfWidth: halfWidthAt(index) + GOLD_EDGE_METERS * bow.meterOnBoard,
      color: withAlpha(PALETTE.rim, alpha),
    }));
    writer.ribbon(path, index => ({
      halfWidth: halfWidthAt(index),
      color: withAlpha(PALETTE.lacquer, alpha),
    }));
    paintLimb(writer, { path, halfWidthAt, alpha });
  }
  writeGrip(writer, bow, alpha);
}

/** The grip: the lacquer between the limbs, wrapped in red leather held by two gold rings. */
function writeGrip(writer: MeshWriter, bow: Bow, alpha: number): void {
  const riser = [along(bow, 0, RISER_HALF_METERS), along(bow, 0, -RISER_HALF_METERS)];
  const halfWidth = GRIP_HALF_WIDTH_METERS * bow.meterOnBoard;
  writer.ribbon(riser, () => ({
    halfWidth: halfWidth + GOLD_EDGE_METERS * bow.meterOnBoard,
    color: withAlpha(PALETTE.rim, alpha),
  }));
  writer.ribbon(riser, () => ({ halfWidth, color: withAlpha(PALETTE.lacquer, alpha) }));
  writer.ribbon([along(bow, 0, WRAP_HALF_METERS), along(bow, 0, -WRAP_HALF_METERS)], () => ({
    halfWidth,
    color: withAlpha(PALETTE.berry, alpha),
  }));
  for (const side of [1, -1]) {
    writer.ribbon(
      [
        along(bow, halfWidth / bow.meterOnBoard, side * WRAP_HALF_METERS),
        along(bow, -halfWidth / bow.meterOnBoard, side * WRAP_HALF_METERS),
      ],
      () => ({
        halfWidth: WRAP_RING_HALF_METERS * bow.meterOnBoard,
        color: withAlpha(PALETTE.rim, alpha),
      })
    );
  }
}

/** The string from tip to nock to tip, humming brighter the further it is drawn. */
function writeString(writer: MeshWriter, bow: Bow, timeSeconds: number): void {
  const hum =
    1 - STRING_HUM_SHARE + STRING_HUM_SHARE * Math.sin(timeSeconds * STRING_HUM_RADIANS_PER_SECOND);
  const color = withAlpha(
    PALETTE.bandCore,
    between(STRING_ALPHA_SLACK, STRING_ALPHA_FULL, bow.drawn) * hum
  );
  writer.ribbon([tipOf(bow, 1), nockOf(bow), tipOf(bow, -1)], () => ({
    halfWidth: (STRING_WIDTH_METERS / 2) * bow.meterOnBoard,
    color,
  }));
}

/** The arrow on the string: a brass shaft from the nock, a steel head ahead of the grip, two feathers off the tail. */
function writeArrow(writer: MeshWriter, bow: Bow): void {
  const alpha = between(HAZE_ALPHA_FULL, 255, bow.drawn);
  const headBase = ARROW_AHEAD_METERS - ARROW_HEAD_LENGTH_METERS;
  const notch = -(BRACE_METERS + bow.drawMeters);
  writer.ribbon([nockOf(bow), along(bow, headBase, 0)], () => ({
    halfWidth: (ARROW_SHAFT_WIDTH_METERS / 2) * bow.meterOnBoard,
    color: withAlpha(PALETTE.brass, alpha),
  }));
  writer.triangle(
    along(bow, ARROW_AHEAD_METERS, 0),
    along(bow, headBase, ARROW_HEAD_HALF_WIDTH_METERS),
    along(bow, headBase, -ARROW_HEAD_HALF_WIDTH_METERS),
    withAlpha(PALETTE.steelLight, alpha)
  );
  writeFletching(writer, bow, notch, alpha);
  writer.ribbon([along(bow, notch, 0), along(bow, notch + NOCK_BINDING_LENGTH_METERS, 0)], () => ({
    halfWidth: NOCK_BINDING_HALF_WIDTH_METERS * bow.meterOnBoard,
    color: withAlpha(PALETTE.rim, alpha),
  }));
}

/**
 * The feathers: one white and one red, as on the arrow the player brought.
 * Each runs along the shaft from its shoulder out to its full width and
 * tapers away forward, with a slanted rear edge — a vane, not a wedge.
 */
function writeFletching(writer: MeshWriter, bow: Bow, notch: number, alpha: number): void {
  const from = notch + FLETCHING_FROM_METERS;
  const to = notch + FLETCHING_TO_METERS;
  const shoulder = from + (to - from) * FLETCHING_SHOULDER_SHARE;
  for (const side of [1, -1]) {
    const wide = side * FLETCHING_HALF_WIDTH_METERS;
    writer.convexPolygon(
      [
        along(bow, from, 0),
        along(bow, shoulder, wide),
        along(bow, to, wide * FLETCHING_TRAIL_SHARE),
        along(bow, to, 0),
      ],
      withAlpha(side > 0 ? PALETTE.ball : PALETTE.berry, alpha)
    );
  }
}

/** Sparks riding the arrow out of the nock, and a few turning about the fingers; with no arrow nocked, only the fingers' own. */
function writeSparks(
  writer: MeshWriter,
  bow: Bow,
  shot: { readonly nocked: boolean; readonly timeSeconds: number }
): void {
  const { timeSeconds } = shot;
  const nock = nockOf(bow);
  for (let index = 0; shot.nocked && index < ARROW_SPARKS; index += 1) {
    const offset = index / ARROW_SPARKS;
    const share = fraction(offset + timeSeconds * SPARK_TRIPS_PER_SECOND);
    const notch = -(BRACE_METERS + bow.drawMeters);
    const alive = Math.sin(share * Math.PI);
    writeStar(writer, along(bow, notch + (ARROW_AHEAD_METERS - notch) * share, 0), {
      radius: SPARK_RADIUS_METERS * bow.meterOnBoard * alive,
      turn: offset * FULL_TURN,
      color: withAlpha(
        PALETTE.bandCore,
        SPARK_ALPHA * bow.drawn * alive * twinkle(timeSeconds, offset, TWINKLE_RADIANS_PER_SECOND)
      ),
    });
  }
  for (let index = 0; index < NOCK_SPARKS; index += 1) {
    const offset = index / NOCK_SPARKS;
    const angle = offset * FULL_TURN + timeSeconds * NOCK_SPARK_RADIANS_PER_SECOND;
    writeStar(writer, around(nock, angle, NOCK_SPARK_AWAY_METERS * bow.meterOnBoard), {
      radius: SPARK_RADIUS_METERS * bow.meterOnBoard,
      turn: angle,
      color: withAlpha(
        PALETTE.bandGold,
        SPARK_ALPHA * bow.drawn * twinkle(timeSeconds, offset, TWINKLE_RADIANS_PER_SECOND)
      ),
    });
  }
}

function between(slack: number, full: number, drawn: number): number {
  return slack + (full - slack) * drawn;
}

function fraction(value: number): number {
  return value - Math.floor(value);
}
