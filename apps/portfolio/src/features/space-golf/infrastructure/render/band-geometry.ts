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
const CORE_RADIUS_SHARE = 0.42;
const CORE_ALPHA_SLACK = 110;
const CORE_ALPHA_FULL = 225;
/** The lines of energy from the anchor to the finger: each sways in a wave that travels along it. */
const ARCS = 3;
const ARC_STEPS = 16;
const ARC_WIDTH_METERS = 0.035;
const ARC_SWAY_SHARE = 0.09;
const ARC_WAVES = 1.5;
const ARC_RADIANS_PER_SECOND = 5.5;
const ARC_ALPHA = 235;
/** The energy runs the line: a bright pulse travels along it, never fading below the floor. */
const FLOW_PULSES = 2;
const FLOW_RADIANS_PER_SECOND = 7;
const FLOW_FLOOR = 0.45;
/** The finger's own spark, at the far end of the lines. */
const SPARK_RADIUS_METERS = 0.13;
const SPARK_ALPHA = 210;
const HALF = 0.5;
const FULL_TURN = Math.PI * 2;

/**
 * The band the player is pulling: a hazy blue sphere quivering where the
 * pull began — the point the stroke is measured from, which nothing else on
 * the board shows — and lines of energy arcing from it to the finger,
 * brighter the further the band is stretched. The dots say where the ball
 * will go; this says how hard it is about to be hit.
 */
export function writeBand(writer: MeshWriter, band: DrawnBand, timeSeconds: number): void {
  const stretchMeters = distance(band.anchor, band.pull) / band.meterOnBoard;
  const pulled = Math.min(
    1,
    Math.max(0, (stretchMeters - AIM_DEAD_ZONE_METERS) / (MAX_PULL_METERS - AIM_DEAD_ZONE_METERS))
  );
  writeHalo(writer, band, pulled, timeSeconds);
  writeArcs(writer, band, pulled, timeSeconds);
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
  writeGlow(writer, band.anchor, angle => radiusAt(angle) * CORE_RADIUS_SHARE, {
    color: PALETTE.bandCore,
    centerAlpha: between(CORE_ALPHA_SLACK, CORE_ALPHA_FULL, pulled),
  });
}

function writeArcs(writer: MeshWriter, band: DrawnBand, pulled: number, timeSeconds: number): void {
  const along = subtract(band.pull, band.anchor);
  const span = length(along);
  if (pulled <= 0 || span === 0) {
    return;
  }
  const across = { x: -along.y / span, y: along.x / span };
  const width = ARC_WIDTH_METERS * band.meterOnBoard;
  for (let arc = 0; arc < ARCS; arc += 1) {
    const phase = (arc / ARCS) * FULL_TURN;
    const pointAt = (share: number): Vector2 => {
      const sway =
        Math.sin(share * Math.PI) *
        Math.sin(share * ARC_WAVES * FULL_TURN - timeSeconds * ARC_RADIANS_PER_SECOND + phase) *
        span *
        ARC_SWAY_SHARE;
      return {
        x: band.anchor.x + along.x * share + across.x * sway,
        y: band.anchor.y + along.y * share + across.y * sway,
      };
    };
    const flowAt = (share: number): number =>
      FLOW_FLOOR +
      (1 - FLOW_FLOOR) *
        (HALF +
          HALF *
            Math.sin(
              share * FLOW_PULSES * FULL_TURN - timeSeconds * FLOW_RADIANS_PER_SECOND + phase
            ));
    let from = band.anchor;
    for (let step = 1; step <= ARC_STEPS; step += 1) {
      const share = step / ARC_STEPS;
      const to = pointAt(share);
      writer.segment(
        from,
        to,
        width,
        withAlpha(PALETTE.bandCore, ARC_ALPHA * pulled * flowAt(share))
      );
      from = to;
    }
  }
  writeGlow(writer, band.pull, () => SPARK_RADIUS_METERS * band.meterOnBoard, {
    color: PALETTE.bandCore,
    centerAlpha: SPARK_ALPHA * pulled,
  });
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

function around(center: Vector2, angle: number, radius: number): Vector2 {
  return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
}

function between(slack: number, full: number, pulled: number): number {
  return slack + (full - slack) * pulled;
}
