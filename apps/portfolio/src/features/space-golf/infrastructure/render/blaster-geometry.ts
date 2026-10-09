import type { Vector2 } from '@frozik/utils/math/vector2';

import { AIM_DEAD_ZONE_METERS, MAX_PULL_METERS } from '../../domain/constants';
import { distance } from '../../domain/vector';
import type { MeshWriter, Rgba } from './mesh-writer';
import { PALETTE, withAlpha } from './palette';
import type { DrawnBand } from './scene-frame';
import { twinkle, writeHaze, writeStar } from './spark-geometry';

/**
 * Every size here is in band metres — the same on the screen at any zoom —
 * and `meterOnBoard` puts it on the board. A band metre is 64 CSS pixels.
 */
const RETICLE_RADIUS_METERS = 0.25;
const RETICLE_WIDTH_METERS = 0.018;
/** The four ticks of the reticle point in at the core from round it, so the centre reads at a glance. */
const RETICLE_TICK_FROM_METERS = 0.19;
const RETICLE_TICK_TO_METERS = 0.31;
const RETICLE_TICK_HALF_WIDTH_METERS = 0.014;
const RETICLE_ALPHA = 200;

/** The core swells and whitens as it charges, and beats faster. */
const CORE_RADIUS_METERS = { empty: 0.06, full: 0.16 } as const;
/** The core's glow stays inside the chamber: spilling over the gauge, it washed the lit segments out. */
const CORE_HAZE_RADIUS_METERS = { empty: 0.16, full: 0.34 } as const;
const CORE_HAZE_ALPHA = { empty: 90, full: 220 } as const;
const CORE_BEATS_PER_SECOND = { empty: 1.2, full: 5 } as const;
const CORE_BEAT_SHARE = 0.12;

/** The chamber the core sits in: a lacquer ring with the charge gauge set in it. */
const CHAMBER_INNER_METERS = 0.36;
const CHAMBER_OUTER_METERS = 0.54;
const GOLD_EDGE_METERS = 0.024;
/** The gauge: segments lighting from the back of the chamber round both sides to the nose. */
const GAUGE_SEGMENTS_A_SIDE = 6;
const GAUGE_GAP_RADIANS = 0.1;
const GAUGE_INSET_METERS = 0.02;
const GAUGE_ARC_STEPS = 4;
const GAUGE_DARK_ALPHA = 80;
/** A full charge makes the whole gauge flicker gold to white, so the strongest stroke reads without counting. */
const FULL_FLICKER_RADIANS_PER_SECOND = 9;

/**
 * The hull is one smooth shape: the chamber round the core drawn out into
 * a nose along the shot, the two joined by the lines touching both — no
 * barrel bolted on, no fins (2026-10-10, the user's call).
 */
const NOSE_AHEAD_METERS = 1.08;
const NOSE_RADIUS_METERS = 0.07;
const HULL_ARC_STEPS = 32;
/** The channel inside the hull that the energy fills from the chamber to the nose. */
const CHANNEL_FROM_METERS = CHAMBER_OUTER_METERS - GOLD_EDGE_METERS;
const CHANNEL_HALF_WIDTH_METERS = 0.028;
const CHANNEL_DARK_ALPHA = 110;
/**
 * Focusing rings float ahead of the nose, touching nothing, each bowed
 * forward; they light one by one as the charge passes their share.
 */
const LENS_SHARES = [1 / 3, 2 / 3, 1] as const;
const LENS_AHEAD_METERS = [1.24, 1.4, 1.55] as const;
const LENS_RADIUS_METERS = [0.26, 0.22, 0.18] as const;
const LENS_HALF_ANGLE_RADIANS = 0.7;
const LENS_WIDTH_METERS = 0.035;
const LENS_ARC_STEPS = 8;
const EXIT_HAZE_RADIUS_METERS = 0.3;
const EXIT_HAZE_ALPHA = 200;

/** The energy drawn in from the finger: a beam widening with the charge and motes flowing along it into the core. */
const TETHER_HALF_WIDTH_METERS = { empty: 0.018, full: 0.075 } as const;
const TETHER_ALPHA = { empty: 90, full: 210 } as const;
const TETHER_CORE_SHARE = 0.35;
const MOTES = 5;
const MOTE_RADIUS_METERS = 0.06;
const MOTE_TRIPS_PER_SECOND = { empty: 0.5, full: 2.2 } as const;
const MOTE_ALPHA = 240;
const TWINKLE_RADIANS_PER_SECOND = 5.5;

const FULL_CHARGE_TOLERANCE = 1e-9;
const FULL_TURN = Math.PI * 2;

interface Span {
  readonly empty: number;
  readonly full: number;
}

/** The blaster where the player pressed, measured in its own frame: `ahead` along the shot, `aside` across it. */
interface Blaster {
  readonly meterOnBoard: number;
  readonly core: Vector2;
  readonly forward: Vector2;
  readonly across: Vector2;
  /** How full the core is: nothing at the softest stroke, all at the strongest. */
  readonly charge: number;
  /** How far behind the core the energy is drawn from, in band metres: the finger, up to the strongest stroke. */
  readonly drawMeters: number;
  readonly armed: boolean;
  readonly timeSeconds: number;
}

/**
 * The rubber band drawn as a blaster charging. The press is the core where
 * the energy gathers: a reticle marks it from the first touch, so the
 * centre is never in doubt. Once the pull earns a stroke the blaster stands
 * round the core, its hull drawn out into a nose along the shot; a beam
 * draws energy from the finger into the core, which swells and whitens, a
 * gauge of twelve segments in the chamber fills from the back round both
 * sides to the nose, a channel inside the hull fills towards the nose, and
 * three focusing rings floating ahead of it light in turn — at full charge
 * the gauge flickers white and the light gathers past the last ring. Past the strongest stroke nothing
 * grows: the beam stops where that stroke ends, and pulling on only turns
 * the blaster. With the ball still moving it charges all the same but its
 * gauge and channel stay grey and its rings cold: the shot waits for the rest.
 */
export function writeBlaster(
  writer: MeshWriter,
  band: DrawnBand,
  shot: { readonly armed: boolean; readonly timeSeconds: number }
): void {
  const stretchMeters = distance(band.anchor, band.pull) / band.meterOnBoard;
  const charge = chargeOf(stretchMeters);
  const forward =
    stretchMeters > 0
      ? {
          x: (band.anchor.x - band.pull.x) / (stretchMeters * band.meterOnBoard),
          y: (band.anchor.y - band.pull.y) / (stretchMeters * band.meterOnBoard),
        }
      : { x: 0, y: 1 };
  const blaster: Blaster = {
    meterOnBoard: band.meterOnBoard,
    core: band.anchor,
    forward,
    across: { x: -forward.y, y: forward.x },
    charge,
    drawMeters: Math.min(stretchMeters, MAX_PULL_METERS),
    armed: shot.armed,
    timeSeconds: shot.timeSeconds,
  };
  // A slack band plays no stroke, so there is no blaster to promise one: the reticle and the core mark the press.
  if (stretchMeters >= AIM_DEAD_ZONE_METERS) {
    writeTether(writer, blaster);
    writeBody(writer, blaster);
    writeGauge(writer, blaster);
  }
  writeReticle(writer, blaster);
  writeCore(writer, blaster);
}

function at(blaster: Blaster, ahead: number, aside: number): Vector2 {
  return {
    x:
      blaster.core.x +
      (blaster.forward.x * ahead + blaster.across.x * aside) * blaster.meterOnBoard,
    y:
      blaster.core.y +
      (blaster.forward.y * ahead + blaster.across.y * aside) * blaster.meterOnBoard,
  };
}

/** A point at `radius` band metres from the core, `angle` turned from the shot. */
function round(blaster: Blaster, angle: number, radius: number): Vector2 {
  return at(blaster, Math.cos(angle) * radius, Math.sin(angle) * radius);
}

function writeReticle(writer: MeshWriter, blaster: Blaster): void {
  const color = withAlpha(PALETTE.bandCore, RETICLE_ALPHA);
  const radius = RETICLE_RADIUS_METERS * blaster.meterOnBoard;
  const halfWidth = (RETICLE_WIDTH_METERS / 2) * blaster.meterOnBoard;
  writer.ring(blaster.core, radius - halfWidth, radius + halfWidth, color);
  for (let tick = 0; tick < 4; tick += 1) {
    const angle = (tick / 4) * FULL_TURN + FULL_TURN / 8;
    writer.ribbon(
      [
        round(blaster, angle, RETICLE_TICK_FROM_METERS),
        round(blaster, angle, RETICLE_TICK_TO_METERS),
      ],
      () => ({ halfWidth: RETICLE_TICK_HALF_WIDTH_METERS * blaster.meterOnBoard, color })
    );
  }
}

function writeCore(writer: MeshWriter, blaster: Blaster): void {
  const { charge, timeSeconds } = blaster;
  const beat =
    1 + CORE_BEAT_SHARE * Math.sin(timeSeconds * spanOf(CORE_BEATS_PER_SECOND, charge) * FULL_TURN);
  writeHaze(writer, blaster.core, {
    radius: spanOf(CORE_HAZE_RADIUS_METERS, charge) * blaster.meterOnBoard,
    color: PALETTE.bandGlow,
    alpha: spanOf(CORE_HAZE_ALPHA, charge),
    timeSeconds,
  });
  writer.circle(
    blaster.core,
    spanOf(CORE_RADIUS_METERS, charge) * beat * blaster.meterOnBoard,
    mix(PALETTE.bandGold, PALETTE.bandCore, charge)
  );
}

/** The beam from the finger — or from where the strongest stroke ends — into the core, with motes riding it in. */
function writeTether(writer: MeshWriter, blaster: Blaster): void {
  const { charge, timeSeconds } = blaster;
  const source = at(blaster, -blaster.drawMeters, 0);
  const halfWidth = spanOf(TETHER_HALF_WIDTH_METERS, charge) * blaster.meterOnBoard;
  const alpha = spanOf(TETHER_ALPHA, charge);
  writer.ribbon([source, blaster.core], index => ({
    halfWidth,
    color: withAlpha(PALETTE.bandGlow, index === 0 ? alpha / 3 : alpha),
  }));
  writer.ribbon([source, blaster.core], () => ({
    halfWidth: halfWidth * TETHER_CORE_SHARE,
    color: withAlpha(PALETTE.bandCore, alpha),
  }));
  const trips = spanOf(MOTE_TRIPS_PER_SECOND, charge);
  for (let index = 0; index < MOTES; index += 1) {
    const offset = index / MOTES;
    const share = fraction(offset + timeSeconds * trips);
    const alive = Math.sin(share * Math.PI);
    writeStar(writer, at(blaster, -blaster.drawMeters * (1 - share), 0), {
      radius: MOTE_RADIUS_METERS * blaster.meterOnBoard * alive,
      turn: offset * FULL_TURN + timeSeconds,
      color: withAlpha(
        PALETTE.bandGold,
        MOTE_ALPHA * alive * twinkle(timeSeconds, offset, TWINKLE_RADIANS_PER_SECOND)
      ),
    });
  }
}

/** The hull, black lacquer in a gold edge like the islands, the energy channel along it and the rings ahead of it. */
function writeBody(writer: MeshWriter, blaster: Blaster): void {
  writer.convexPolygon(hullOf(blaster, GOLD_EDGE_METERS), PALETTE.rim);
  writer.convexPolygon(hullOf(blaster, 0), PALETTE.lacquer);
  const inner = CHAMBER_INNER_METERS * blaster.meterOnBoard;
  writer.ring(blaster.core, inner - GOLD_EDGE_METERS * blaster.meterOnBoard, inner, PALETTE.rim);
  writeChannel(writer, blaster);
  LENS_AHEAD_METERS.forEach((ahead, index) => {
    const lit = blaster.armed && blaster.charge >= LENS_SHARES[index];
    writeLens(writer, blaster, { ahead, radius: LENS_RADIUS_METERS[index] }, lit);
  });
  if (blaster.armed && blaster.charge >= 1) {
    writeHaze(writer, at(blaster, LENS_AHEAD_METERS[LENS_AHEAD_METERS.length - 1], 0), {
      radius: EXIT_HAZE_RADIUS_METERS * blaster.meterOnBoard,
      color: PALETTE.bandCore,
      alpha: EXIT_HAZE_ALPHA,
      timeSeconds: blaster.timeSeconds,
    });
  }
}

/**
 * The chamber and the nose wrapped by the two lines touching both: the arc
 * of the chamber round the back, the arc of the nose round the front, `grow`
 * band metres wider all round for the gold edge.
 */
function hullOf(blaster: Blaster, grow: number): readonly Vector2[] {
  const chamber = CHAMBER_OUTER_METERS + grow;
  const nose = NOSE_RADIUS_METERS + grow;
  // Where the touching lines leave both circles: the same angle on each.
  const touch = Math.acos((chamber - nose) / NOSE_AHEAD_METERS);
  const points: Vector2[] = [];
  for (let step = 0; step <= HULL_ARC_STEPS; step += 1) {
    const angle = touch + ((FULL_TURN - 2 * touch) * step) / HULL_ARC_STEPS;
    points.push(round(blaster, angle, chamber));
  }
  for (let step = 0; step <= HULL_ARC_STEPS; step += 1) {
    const angle = -touch + (2 * touch * step) / HULL_ARC_STEPS;
    points.push(at(blaster, NOSE_AHEAD_METERS + Math.cos(angle) * nose, Math.sin(angle) * nose));
  }
  return points;
}

/** The channel from the chamber to the nose: dark, and lit from the chamber on as far as the charge has come. */
function writeChannel(writer: MeshWriter, blaster: Blaster): void {
  const to = NOSE_AHEAD_METERS;
  const halfWidth = CHANNEL_HALF_WIDTH_METERS * blaster.meterOnBoard;
  writer.ribbon([at(blaster, CHANNEL_FROM_METERS, 0), at(blaster, to, 0)], () => ({
    halfWidth,
    color: withAlpha(PALETTE.rim, CHANNEL_DARK_ALPHA),
  }));
  if (blaster.charge <= 0) {
    return;
  }
  const reach = CHANNEL_FROM_METERS + (to - CHANNEL_FROM_METERS) * blaster.charge;
  const tip = blaster.armed
    ? mix(PALETTE.bandGold, PALETTE.bandCore, blaster.charge)
    : PALETTE.dotPending;
  writer.ribbon([at(blaster, CHANNEL_FROM_METERS, 0), at(blaster, reach, 0)], index => ({
    halfWidth,
    color: index === 0 && blaster.armed ? PALETTE.bandGold : tip,
  }));
}

/** One focusing ring seen edge on: an arc bowed forward, its centre on the axis behind it. */
function writeLens(
  writer: MeshWriter,
  blaster: Blaster,
  lens: { readonly ahead: number; readonly radius: number },
  lit: boolean
): void {
  const center = lens.ahead - lens.radius;
  const points: Vector2[] = [];
  for (let step = 0; step <= LENS_ARC_STEPS; step += 1) {
    const angle = -LENS_HALF_ANGLE_RADIANS + (2 * LENS_HALF_ANGLE_RADIANS * step) / LENS_ARC_STEPS;
    points.push(at(blaster, center + Math.cos(angle) * lens.radius, Math.sin(angle) * lens.radius));
  }
  writer.ribbon(points, () => ({
    halfWidth: (LENS_WIDTH_METERS / 2) * blaster.meterOnBoard,
    color: lit ? PALETTE.bandCore : PALETTE.rim,
  }));
}

/**
 * Twelve segments set in the chamber: the first pair behind the core,
 * towards the hand, the last pair at the nose. A segment lights once the
 * charge reaches its share, gold to white-hot along the way; grey while
 * the ball still moves.
 */
function writeGauge(writer: MeshWriter, blaster: Blaster): void {
  const { charge, timeSeconds } = blaster;
  const flicker =
    charge >= 1 ? (1 + Math.sin(timeSeconds * FULL_FLICKER_RADIANS_PER_SECOND)) / 2 : 0;
  const inner = CHAMBER_INNER_METERS + GAUGE_INSET_METERS;
  const outer = CHAMBER_OUTER_METERS - GOLD_EDGE_METERS - GAUGE_INSET_METERS;
  const step = Math.PI / GAUGE_SEGMENTS_A_SIDE;
  const lit = Math.round(charge * GAUGE_SEGMENTS_A_SIDE);
  for (let index = 0; index < GAUGE_SEGMENTS_A_SIDE; index += 1) {
    const share = (index + 1) / GAUGE_SEGMENTS_A_SIDE;
    const color =
      index >= lit
        ? withAlpha(PALETTE.rim, GAUGE_DARK_ALPHA)
        : blaster.armed
          ? mix(mix(PALETTE.bandGold, PALETTE.bandCore, share), PALETTE.bandCore, flicker)
          : PALETTE.dotPending;
    for (const side of [1, -1]) {
      // Counted from the back of the chamber, half a turn away from the shot.
      const from = Math.PI - index * step - GAUGE_GAP_RADIANS / 2;
      const to = Math.PI - (index + 1) * step + GAUGE_GAP_RADIANS / 2;
      writeArc(writer, blaster, { from: side * from, to: side * to, inner, outer }, color);
    }
  }
}

function writeArc(
  writer: MeshWriter,
  blaster: Blaster,
  arc: {
    readonly from: number;
    readonly to: number;
    readonly inner: number;
    readonly outer: number;
  },
  color: Rgba
): void {
  for (let step = 0; step < GAUGE_ARC_STEPS; step += 1) {
    const a = arc.from + ((arc.to - arc.from) * step) / GAUGE_ARC_STEPS;
    const b = arc.from + ((arc.to - arc.from) * (step + 1)) / GAUGE_ARC_STEPS;
    writer.convexPolygon(
      [
        round(blaster, a, arc.inner),
        round(blaster, a, arc.outer),
        round(blaster, b, arc.outer),
        round(blaster, b, arc.inner),
      ],
      color
    );
  }
}

/**
 * How full the core is for a stretch: nothing at the softest stroke, all at
 * the strongest. A stretch measured back off the board at the strongest
 * stroke comes out a hair short of it, and the last ring and the light past it
 * would never light: that hair counts as full.
 */
function chargeOf(stretchMeters: number): number {
  const share = (stretchMeters - AIM_DEAD_ZONE_METERS) / (MAX_PULL_METERS - AIM_DEAD_ZONE_METERS);
  return share >= 1 - FULL_CHARGE_TOLERANCE ? 1 : Math.max(0, share);
}

function spanOf(span: Span, charge: number): number {
  return span.empty + (span.full - span.empty) * charge;
}

function mix(from: Rgba, to: Rgba, share: number): Rgba {
  return [
    from[0] + (to[0] - from[0]) * share,
    from[1] + (to[1] - from[1]) * share,
    from[2] + (to[2] - from[2]) * share,
    from[3] + (to[3] - from[3]) * share,
  ];
}

function fraction(value: number): number {
  return value - Math.floor(value);
}
