import alea from 'alea';
import { createNoise2D } from 'simplex-noise';

import { packColor } from './color-packing';
import {
  FBM_BASE_AMPLITUDE,
  FBM_BASE_FREQUENCY,
  FBM_GAIN,
  FBM_LACUNARITY,
  FBM_OCTAVES,
  FBM_VALUE_CENTER,
  FULL_YEAR_SECONDS,
  GLOBAL_EPOCH_OFFSET,
  OCTAVE_OFFSET,
} from './constants';
import type { IDataPoint } from './types';
import { ETimeScale } from './types';

const POINTS_PER_SCALE: Record<ETimeScale, number> = {
  [ETimeScale.Year]: 180,
  [ETimeScale.Month]: 180,
  [ETimeScale.Week]: 180,
  [ETimeScale.Day]: 180,
  [ETimeScale.Hour]: 180,
  [ETimeScale.Minute]: 180,
};

const LINE_SIZE_MIN = 1;
const LINE_SIZE_MAX = 10;
const LINE_SIZE_RANGE = LINE_SIZE_MAX - LINE_SIZE_MIN;
const SIZE_NOISE_OCTAVE_OFFSET = 7;
const SIZE_NOISE_HALF = 0.5;

/**
 * Normalize an absolute time (seconds since Unix epoch) into a dimensionless
 * coordinate suitable for simplex noise input. Maps the full year range to [0, 1].
 */
function normalizeTime(absoluteTime: number): number {
  return (absoluteTime - GLOBAL_EPOCH_OFFSET) / FULL_YEAR_SECONDS;
}

/**
 * Create a fractal Brownian motion (fBm) evaluator seeded by the given string.
 * Returns a function that maps a time (in seconds) to a deterministic value.
 */
function createFbm(seed: string): (time: number) => number {
  const noise2D = createNoise2D(alea(seed));

  return (time: number): number => {
    const normalizedTime = normalizeTime(time);
    let value = 0;
    let amplitude = FBM_BASE_AMPLITUDE;
    let frequency = FBM_BASE_FREQUENCY;

    for (let octave = 0; octave < FBM_OCTAVES; octave++) {
      value += amplitude * noise2D(normalizedTime * frequency, octave * OCTAVE_OFFSET);
      amplitude *= FBM_GAIN;
      frequency *= FBM_LACUNARITY;
    }

    return FBM_VALUE_CENTER + value;
  };
}

const BULLISH_COLOR = packColor(0.2, 0.8, 0.3, 1.0);
const BEARISH_COLOR = packColor(0.9, 0.2, 0.2, 1.0);

function computePointSize(noise2D: ReturnType<typeof createNoise2D>, time: number): number {
  const normalizedTime = normalizeTime(time);
  const noise = noise2D(
    normalizedTime * FBM_BASE_FREQUENCY,
    SIZE_NOISE_OCTAVE_OFFSET * OCTAVE_OFFSET
  );
  const normalizedNoise = Math.max(0, Math.min(1, (noise + 1) * SIZE_NOISE_HALF));
  return LINE_SIZE_MIN + normalizedNoise * LINE_SIZE_RANGE;
}

/**
 * Generate timeseries data for a given time range, scale, and seed.
 *
 * Uses fractal Brownian motion (fBm) built on simplex noise for smooth,
 * deterministic, and seed-controllable data generation. Different seeds
 * produce completely different series.
 */
export function generateTimeseriesData(
  timeStart: number,
  timeEnd: number,
  scale: ETimeScale,
  seed: string
): IDataPoint[] {
  const pointCount = POINTS_PER_SCALE[scale];
  const duration = timeEnd - timeStart;
  const step = duration / (pointCount - 1);

  const fbm = createFbm(seed);
  const sizeNoise2D = createNoise2D(alea(`${seed}-size`));

  const times: number[] = new Array(pointCount);
  const values: number[] = new Array(pointCount);

  for (let index = 0; index < pointCount; index++) {
    times[index] = timeStart + index * step;
    values[index] = fbm(times[index]);
  }

  const points: IDataPoint[] = new Array(pointCount);

  for (let index = 0; index < pointCount; index++) {
    const nextIndex = Math.min(index + 1, pointCount - 1);
    const isBullish = values[nextIndex] >= values[index];

    points[index] = {
      time: times[index],
      value: values[index],
      size: computePointSize(sizeNoise2D, times[index]),
      color: isBullish ? BULLISH_COLOR : BEARISH_COLOR,
    };
  }

  return points;
}
