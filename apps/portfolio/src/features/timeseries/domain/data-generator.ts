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
  [ETimeScale.Year]: 365,
  [ETimeScale.Month]: 300,
  [ETimeScale.Week]: 168,
  [ETimeScale.Day]: 480,
  [ETimeScale.Hour]: 360,
  [ETimeScale.Minute]: 60,
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

function computePointColor(normalizedPosition: number): number {
  const red = normalizedPosition;
  const green = 0.8 - normalizedPosition * 0.6;
  const blue = 1.0 - normalizedPosition * 0.2;
  return packColor(red, green, blue, 1.0);
}

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

  const points: IDataPoint[] = new Array(pointCount);

  for (let index = 0; index < pointCount; index++) {
    const time = timeStart + index * step;
    const value = fbm(time);

    const normalizedPosition = Math.max(
      0,
      Math.min(1, (time - GLOBAL_EPOCH_OFFSET) / FULL_YEAR_SECONDS)
    );

    points[index] = {
      time,
      value,
      size: computePointSize(sizeNoise2D, time),
      color: computePointColor(normalizedPosition),
    };
  }

  return points;
}
