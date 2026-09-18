import type { Vector2 } from '@frozik/utils/math/vector2';

import { AIM_DEAD_ZONE_METERS, MAX_PULL_METERS } from '../../domain/constants';
import { distance, length, subtract } from '../../domain/vector';
import type { MeshWriter, Rgba } from './mesh-writer';
import { PALETTE, withAlpha } from './palette';
import type { DrawnBand } from './scene-frame';

/** Every size here is in band metres — the same on the screen at any zoom — and `meterOnBoard` puts it on the board. */
const HALO_RADIUS_METERS = 0.34;
const HALO_SEGMENTS = 28;
/** The haze swells this much more when the band is stretched to the full. */
const HALO_PULL_GROWTH = 0.28;
/** It breathes as a whole, and its rim runs in two waves of different length: it quivers rather than pulses. */
const HALO_BREATH_SHARE = 0.07;
const HALO_BREATH_RADIANS_PER_SECOND = 3.4;
const HALO_WAVES = [
  { lobes: 3, share: 0.08, radiansPerSecond: 1.9 },
  { lobes: 5, share: 0.04, radiansPerSecond: -2.7 },
] as const;
const HALO_ALPHA_SLACK = 80;
const HALO_ALPHA_FULL = 165;
const HALO_CORE_RADIUS_SHARE = 0.42;
const HALO_CORE_ALPHA_SLACK = 110;
const HALO_CORE_ALPHA_FULL = 225;

/**
 * The streams of light: how far each bows off the straight way to the
 * finger — a share of the span, the sign its side — and where its pulse
 * stands when the others' stand elsewhere.
 */
const STREAMS = [
  { bowShare: 0.26, curlTurns: 1.15 },
  { bowShare: -0.11, curlTurns: 0.85 },
  { bowShare: -0.3, curlTurns: 1.3 },
] as const;
const STREAM_STEPS = 18;
const STREAM_HALF_WIDTH_METERS = 0.055;
/** The width at the ends of the stream, where it leaves the haze and where its curl begins; fattest halfway. */
const STREAM_TIP_SHARE = 0.34;
const STREAM_WIDTH_POWER = 0.6;
/** The white-hot thread inside the gold. */
const STREAM_CORE_WIDTH_SHARE = 0.4;
const STREAM_CORE_ALPHA_SHARE = 0.75;
const STREAM_ALPHA = 235;
/** The bow breathes, and a shorter ripple runs along the stream: the light never lies still. */
const BOW_SWAY_SHARE = 0.3;
const BOW_RADIANS_PER_SECOND = 1.7;
const RIPPLE_SHARE = 0.05;
const RIPPLE_WAVES = 2;
const RIPPLE_RADIANS_PER_SECOND = 3.1;
/** The energy runs the stream: a bright pulse travels along it, never fading below the floor. */
const FLOW_PULSES = 2;
const FLOW_RADIANS_PER_SECOND = 7;
const FLOW_FLOOR = 0.5;

/** Every stream ends the way a Khokhloma tendril does: winding into a tightening curl by the finger. */
const CURL_STEPS = 14;
const CURL_RADIUS_METERS = 0.19;
/** A short pull gets a curl to match: never wider than this share of the way to the finger. */
const CURL_SPAN_SHARE = 0.34;
const CURL_TIGHTENING = 0.82;
/** The curl winds up and unwinds again, so it reads as drawn by a hand and not stamped. */
const CURL_BREATH_SHARE = 0.09;
const CURL_RADIANS_PER_SECOND = 2.2;

/** Sparks of the Khokhloma gold: four-pointed stars riding the streams, and a few more round the haze. */
const STAR_TIPS = 4;
const STAR_WAIST_SHARE = 0.3;
const SPARKS_PER_STREAM = 3;
const SPARK_RADIUS_METERS = 0.055;
const SPARK_ALPHA = 245;
const SPARK_TRIPS_PER_SECOND = 0.42;
const SPARK_SWAY_SHARE = 0.06;
const HALO_SPARKS = 4;
const HALO_SPARK_AWAY_SHARE = 1.15;
const HALO_SPARK_RADIANS_PER_SECOND = 0.6;
const TWINKLE_RADIANS_PER_SECOND = 5.5;

const HALF = 0.5;
const FULL_TURN = Math.PI * 2;

/** A point of a stream: where it runs, how wide it is there and how brightly the pulse lights it. */
interface StreamPoint {
  readonly point: Vector2;
  readonly widthShare: number;
  readonly lit: number;
}

/**
 * The band the player is pulling, painted in the board's own Khokhloma
 * gold: a hazy amber sphere quivering where the pull began — the point the
 * stroke is measured from, which nothing else on the board shows — and
 * streams of gold light bowing from it to the finger, each ending in a
 * tendril's curl, with sparks riding along them. Everything fades up with
 * the pull: the dots say where the ball will go, this says how hard it is
 * about to be hit.
 */
export function writeBand(writer: MeshWriter, band: DrawnBand, timeSeconds: number): void {
  const stretchMeters = distance(band.anchor, band.pull) / band.meterOnBoard;
  const pulled = Math.min(
    1,
    Math.max(0, (stretchMeters - AIM_DEAD_ZONE_METERS) / (MAX_PULL_METERS - AIM_DEAD_ZONE_METERS))
  );
  writeHalo(writer, band, pulled, timeSeconds);
  writeHaloSparks(writer, band, pulled, timeSeconds);
  if (pulled <= 0) {
    return;
  }
  STREAMS.forEach((stream, index) => {
    const phase = (index / STREAMS.length) * FULL_TURN;
    const points = streamOf(band, stream, phase, timeSeconds);
    if (points.length < 2) {
      return;
    }
    writeStream(writer, band, points, pulled);
    writeStreamSparks(writer, band, points, { pulled, phase, timeSeconds });
  });
}

function writeHalo(writer: MeshWriter, band: DrawnBand, pulled: number, timeSeconds: number): void {
  const breathing =
    HALO_RADIUS_METERS *
    band.meterOnBoard *
    (1 + HALO_PULL_GROWTH * pulled) *
    (1 + HALO_BREATH_SHARE * Math.sin(timeSeconds * HALO_BREATH_RADIANS_PER_SECOND));
  const radiusAt = (angle: number): number =>
    breathing *
    HALO_WAVES.reduce(
      (share, wave) =>
        share + wave.share * Math.sin(wave.lobes * angle + timeSeconds * wave.radiansPerSecond),
      1
    );
  writeGlow(writer, band.anchor, radiusAt, {
    color: PALETTE.bandGlow,
    centerAlpha: between(HALO_ALPHA_SLACK, HALO_ALPHA_FULL, pulled),
  });
  writeGlow(writer, band.anchor, angle => radiusAt(angle) * HALO_CORE_RADIUS_SHARE, {
    color: PALETTE.bandCore,
    centerAlpha: between(HALO_CORE_ALPHA_SLACK, HALO_CORE_ALPHA_FULL, pulled),
  });
}

/**
 * One stream, from the haze to the finger and on into its curl: bowed off
 * the straight way, rippling along it, thinnest at either end.
 */
function streamOf(
  band: DrawnBand,
  stream: (typeof STREAMS)[number],
  phase: number,
  timeSeconds: number
): readonly StreamPoint[] {
  const along = subtract(band.pull, band.anchor);
  const span = length(along);
  if (span === 0) {
    return [];
  }
  const forward = { x: along.x / span, y: along.y / span };
  const across = { x: -forward.y, y: forward.x };
  const flowAt = (share: number): number =>
    FLOW_FLOOR +
    (1 - FLOW_FLOOR) *
      (HALF +
        HALF *
          Math.sin(
            share * FLOW_PULSES * FULL_TURN - timeSeconds * FLOW_RADIANS_PER_SECOND + phase
          ));
  const points: StreamPoint[] = [];
  for (let step = 0; step <= STREAM_STEPS; step += 1) {
    const share = step / STREAM_STEPS;
    const swell = Math.sin(share * Math.PI);
    const bow =
      swell *
      span *
      stream.bowShare *
      (1 -
        BOW_SWAY_SHARE +
        BOW_SWAY_SHARE * Math.sin(timeSeconds * BOW_RADIANS_PER_SECOND + phase));
    const ripple =
      swell *
      span *
      RIPPLE_SHARE *
      Math.sin(share * RIPPLE_WAVES * FULL_TURN - timeSeconds * RIPPLE_RADIANS_PER_SECOND + phase);
    points.push({
      point: {
        x: band.anchor.x + forward.x * span * share + across.x * (bow + ripple),
        y: band.anchor.y + forward.y * span * share + across.y * (bow + ripple),
      },
      widthShare: STREAM_TIP_SHARE + (1 - STREAM_TIP_SHARE) * swell ** STREAM_WIDTH_POWER,
      lit: flowAt(share),
    });
  }
  return [...points, ...curlOf(points, band, stream, { span, phase, timeSeconds, flowAt })];
}

/** The tendril's end: the stream winds on round the finger, tightening and thinning away to nothing. */
function curlOf(
  stream: readonly StreamPoint[],
  band: DrawnBand,
  { bowShare, curlTurns }: (typeof STREAMS)[number],
  wind: {
    readonly span: number;
    readonly phase: number;
    readonly timeSeconds: number;
    readonly flowAt: (share: number) => number;
  }
): readonly StreamPoint[] {
  const last = stream[stream.length - 1].point;
  const before = stream[stream.length - 2].point;
  const incoming = subtract(last, before);
  const step = length(incoming);
  if (step === 0) {
    return [];
  }
  const side = bowShare >= 0 ? 1 : -1;
  const radius = Math.min(CURL_RADIUS_METERS * band.meterOnBoard, wind.span * CURL_SPAN_SHARE);
  const center = {
    x: last.x + (-incoming.y / step) * radius * side,
    y: last.y + (incoming.x / step) * radius * side,
  };
  const start = Math.atan2(last.y - center.y, last.x - center.x);
  const turns =
    curlTurns *
    (1 + CURL_BREATH_SHARE * Math.sin(wind.timeSeconds * CURL_RADIANS_PER_SECOND + wind.phase));
  const points: StreamPoint[] = [];
  for (let index = 1; index <= CURL_STEPS; index += 1) {
    const share = index / CURL_STEPS;
    const angle = start + side * turns * FULL_TURN * share;
    const winding = radius * (1 - CURL_TIGHTENING * share);
    points.push({
      point: {
        x: center.x + Math.cos(angle) * winding,
        y: center.y + Math.sin(angle) * winding,
      },
      widthShare: STREAM_TIP_SHARE * (1 - share),
      lit: wind.flowAt(1 + share),
    });
  }
  return points;
}

/** The stream itself: a ribbon of gold with a white-hot thread down the middle of it. */
function writeStream(
  writer: MeshWriter,
  band: DrawnBand,
  points: readonly StreamPoint[],
  pulled: number
): void {
  const path = points.map(({ point }) => point);
  const halfWidth = STREAM_HALF_WIDTH_METERS * band.meterOnBoard;
  writer.ribbon(path, index => ({
    halfWidth: halfWidth * points[index].widthShare,
    color: withAlpha(PALETTE.bandGold, STREAM_ALPHA * pulled * points[index].lit),
  }));
  writer.ribbon(path, index => ({
    halfWidth: halfWidth * points[index].widthShare * STREAM_CORE_WIDTH_SHARE,
    color: withAlpha(
      PALETTE.bandCore,
      STREAM_ALPHA * STREAM_CORE_ALPHA_SHARE * pulled * points[index].lit
    ),
  }));
}

/** Sparks carried along the stream, each on its own trip from the haze to the finger, twinkling as it goes. */
function writeStreamSparks(
  writer: MeshWriter,
  band: DrawnBand,
  points: readonly StreamPoint[],
  ride: { readonly pulled: number; readonly phase: number; readonly timeSeconds: number }
): void {
  const ridden = STREAM_STEPS;
  for (let index = 0; index < SPARKS_PER_STREAM; index += 1) {
    const offset = index / SPARKS_PER_STREAM + ride.phase / FULL_TURN;
    const share = fraction(offset + ride.timeSeconds * SPARK_TRIPS_PER_SECOND);
    const place = share * ridden;
    const step = Math.min(ridden - 1, Math.floor(place));
    const from = points[step].point;
    const to = points[step + 1].point;
    const within = place - step;
    const away = SPARK_SWAY_SHARE * band.meterOnBoard * Math.sin(offset * FULL_TURN);
    const at = {
      x: from.x + (to.x - from.x) * within - (to.y - from.y) * away,
      y: from.y + (to.y - from.y) * within + (to.x - from.x) * away,
    };
    // A spark is born out of the haze and gone by the finger: no star pops into being in the open.
    const alive = Math.sin(share * Math.PI);
    writeStar(writer, at, {
      radius: SPARK_RADIUS_METERS * band.meterOnBoard * alive,
      turn: offset * FULL_TURN,
      color: withAlpha(
        PALETTE.bandCore,
        SPARK_ALPHA * ride.pulled * alive * twinkle(ride.timeSeconds, offset)
      ),
    });
  }
}

/** A few stars hanging round the haze itself, turning slowly about it. */
function writeHaloSparks(
  writer: MeshWriter,
  band: DrawnBand,
  pulled: number,
  timeSeconds: number
): void {
  const away = HALO_RADIUS_METERS * HALO_SPARK_AWAY_SHARE * band.meterOnBoard;
  for (let index = 0; index < HALO_SPARKS; index += 1) {
    const offset = index / HALO_SPARKS;
    const angle = offset * FULL_TURN + timeSeconds * HALO_SPARK_RADIANS_PER_SECOND;
    writeStar(writer, around(band.anchor, angle, away), {
      radius: SPARK_RADIUS_METERS * band.meterOnBoard,
      turn: angle,
      color: withAlpha(
        PALETTE.bandCore,
        SPARK_ALPHA *
          between(HALO_ALPHA_SLACK / HALO_ALPHA_FULL, 1, pulled) *
          twinkle(timeSeconds, offset)
      ),
    });
  }
}

/** A four-pointed star: long arms from a narrow waist, the sparkle of the gold. */
function writeStar(
  writer: MeshWriter,
  at: Vector2,
  star: { readonly radius: number; readonly turn: number; readonly color: Rgba }
): void {
  const corners = STAR_TIPS * 2;
  const radiusOf = (corner: number): number =>
    corner % 2 === 0 ? star.radius : star.radius * STAR_WAIST_SHARE;
  for (let corner = 0; corner < corners; corner += 1) {
    const from = star.turn + (corner / corners) * FULL_TURN;
    const to = star.turn + ((corner + 1) / corners) * FULL_TURN;
    writer.triangle(
      at,
      around(at, from, radiusOf(corner)),
      around(at, to, radiusOf(corner + 1)),
      star.color
    );
  }
}

/** A disc with no edge: the colour full in the middle and gone at the rim, one fan of shaded triangles. */
function writeGlow(
  writer: MeshWriter,
  center: Vector2,
  radiusAt: (angle: number) => number,
  paint: { readonly color: Rgba; readonly centerAlpha: number }
): void {
  const middle = withAlpha(paint.color, paint.centerAlpha);
  const rim = withAlpha(paint.color, 0);
  for (let index = 0; index < HALO_SEGMENTS; index += 1) {
    const from = (index / HALO_SEGMENTS) * FULL_TURN;
    const to = ((index + 1) / HALO_SEGMENTS) * FULL_TURN;
    writer.shadedTriangle(
      center,
      around(center, from, radiusAt(from)),
      around(center, to, radiusAt(to)),
      [middle, rim, rim]
    );
  }
}

function twinkle(timeSeconds: number, offset: number): number {
  return HALF + HALF * Math.sin(timeSeconds * TWINKLE_RADIANS_PER_SECOND + offset * FULL_TURN);
}

function around(center: Vector2, angle: number, radius: number): Vector2 {
  return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
}

function between(slack: number, full: number, pulled: number): number {
  return slack + (full - slack) * pulled;
}

function fraction(value: number): number {
  return value - Math.floor(value);
}
