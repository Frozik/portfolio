import type { Vector2 } from '@frozik/utils/math/vector2';

import type { UtilitySystem } from '../model/foundation';
import { routeLengthMeters, sewerSlopeFor, TRENCH_WIDTH_METERS } from '../model/routing';
import type { Meters } from '../units';

/**
 * How often the profile reads the ground between the drawn bends. Fine enough
 * to catch a bump between two clicks, coarse enough to stay a hand of samples
 * on a garden-plot run.
 */
const STATION_STEP_METERS = 1;

/** One reading along the trench: where the ground is and where the pipe is. */
export interface TrenchStation {
  readonly position: Vector2;
  /** Distance from the route's first point, along the drawn line. */
  readonly offsetMeters: Meters;
  readonly gradeElevation: Meters;
  readonly pipeElevation: Meters;
}

/**
 * The trench resolved against the terrain (`building-editor.md` §8): the pipe
 * line under the ground line, the depths the digging must reach, and what the
 * digging displaces.
 */
export interface TrenchProfile {
  readonly stations: readonly TrenchStation[];
  readonly lengthMeters: Meters;
  /** How deep the pipe sits at each end — the entry side first. */
  readonly startDepthMeters: Meters;
  readonly endDepthMeters: Meters;
  readonly minDepthMeters: Meters;
  readonly maxDepthMeters: Meters;
  /** The fall per metre of a gravity run; nothing for pressurized systems. */
  readonly slope: number | undefined;
  readonly volumeCubicMeters: number;
}

/**
 * Builds the depth profile of one trench. A pressurized or cabled system
 * follows the ground at its norm burial — the pipe line is the terrain shifted
 * down. A sewer is gravity work: it starts at the entry's depth and FALLS at
 * the recommended slope for its bore the whole way out, so its depth below
 * grade is whatever the terrain leaves — the profile is exactly what shows
 * where the run surfaces or digs itself impractically deep.
 */
export function buildTrenchProfile({
  points,
  system,
  burialDepthMeters,
  diameterMeters,
  sampleElevation,
}: {
  readonly points: readonly Vector2[];
  readonly system: UtilitySystem;
  /** The norm depth (`trenchDepthMeters`) — a sewer starts here, others hold it. */
  readonly burialDepthMeters: Meters;
  readonly diameterMeters: Meters;
  readonly sampleElevation: (position: Vector2) => Meters;
}): TrenchProfile | undefined {
  const samples = sampleAlong(points);

  if (samples.length < 2) {
    return undefined;
  }

  const slope = system === 'sewer' ? sewerSlopeFor(diameterMeters).recommended : undefined;
  const startPipeElevation = sampleElevation(samples[0].position) - burialDepthMeters;
  const stations = samples.map(({ position, offsetMeters }) => {
    const gradeElevation = sampleElevation(position);

    return {
      position,
      offsetMeters,
      gradeElevation,
      pipeElevation:
        slope === undefined
          ? gradeElevation - burialDepthMeters
          : startPipeElevation - slope * offsetMeters,
    };
  });

  const depths = stations.map(station => station.gradeElevation - station.pipeElevation);
  const lengthMeters = routeLengthMeters(points);

  return {
    stations,
    lengthMeters,
    startDepthMeters: depths[0],
    endDepthMeters: depths[depths.length - 1],
    minDepthMeters: Math.min(...depths),
    maxDepthMeters: Math.max(...depths),
    slope,
    volumeCubicMeters: trenchVolume(stations, depths),
  };
}

/** The drawn bends plus evenly spaced stations between them, with run offsets. */
function sampleAlong(
  points: readonly Vector2[]
): readonly { readonly position: Vector2; readonly offsetMeters: Meters }[] {
  if (points.length < 2) {
    return points.map(position => ({ position, offsetMeters: 0 }));
  }

  const samples: { position: Vector2; offsetMeters: Meters }[] = [
    { position: points[0], offsetMeters: 0 },
  ];
  let runOffset = 0;

  for (let index = 0; index + 1 < points.length; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);

    if (segmentLength === 0) {
      continue;
    }

    const stepCount = Math.max(1, Math.ceil(segmentLength / STATION_STEP_METERS));

    for (let step = 1; step <= stepCount; step += 1) {
      const fraction = step / stepCount;

      samples.push({
        position: {
          x: start.x + (end.x - start.x) * fraction,
          y: start.y + (end.y - start.y) * fraction,
        },
        offsetMeters: runOffset + segmentLength * fraction,
      });
    }

    runOffset += segmentLength;
  }

  return samples;
}

/** Trapezoidal sum of depth × width along the run; a surfaced pipe digs nothing. */
function trenchVolume(stations: readonly TrenchStation[], depths: readonly number[]): number {
  let volume = 0;

  for (let index = 0; index + 1 < stations.length; index += 1) {
    const stretch = stations[index + 1].offsetMeters - stations[index].offsetMeters;
    const meanDepth = (Math.max(depths[index], 0) + Math.max(depths[index + 1], 0)) / 2;

    volume += stretch * meanDepth * TRENCH_WIDTH_METERS;
  }

  return volume;
}
