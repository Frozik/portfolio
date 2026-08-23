import { clamp, random } from 'lodash-es';

import {
  FULLY_FLATTENED_MAX_STEP_WU_PER_COLUMN,
  MAX_BUMPINESS_AMPLITUDE_WU,
  MAX_SLOPE_TILT_WU,
  MAX_TERRAIN_HEIGHT_WU,
  MAX_TERRAIN_KNOB,
  MIDPOINT_DISPLACEMENT_LEVELS,
  MIN_TERRAIN_HEIGHT_WU,
  TERRAIN_BASE_HEIGHT_WU,
  TERRAIN_COLUMN_COUNT,
  TERRAIN_ROUGHNESS_DECAY,
  UNFLATTENED_MAX_STEP_WU_PER_COLUMN,
} from '../constants';
import type { TerrainOptions } from '../types';
import type { Heightfield } from './heightfield';
import { createHeightfield } from './heightfield';

/**
 * The original never documented its generator, only the three knobs, so §10 picks midpoint
 * displacement and maps the knobs onto it: Bumpiness is the displacement amplitude, Slope is a
 * low-frequency tilt applied to the endpoints, and Flatten Peaks is a slope clamp.
 */
function createDisplacedSamples(bumpiness: number, slope: number): number[] {
  const sampleCount = 2 ** MIDPOINT_DISPLACEMENT_LEVELS + 1;
  const tiltWu = (MAX_SLOPE_TILT_WU * slope) / MAX_TERRAIN_KNOB;
  const samples = new Array<number>(sampleCount).fill(TERRAIN_BASE_HEIGHT_WU);

  samples[0] = TERRAIN_BASE_HEIGHT_WU - tiltWu / 2;
  samples[sampleCount - 1] = TERRAIN_BASE_HEIGHT_WU + tiltWu / 2;

  let amplitudeWu = (MAX_BUMPINESS_AMPLITUDE_WU * bumpiness) / MAX_TERRAIN_KNOB;
  let stride = sampleCount - 1;

  while (stride > 1) {
    const halfStride = stride / 2;

    for (let left = 0; left + stride < sampleCount; left += stride) {
      const midpoint = (samples[left] + samples[left + stride]) / 2;

      samples[left + halfStride] = midpoint + random(-1, 1, true) * amplitudeWu;
    }

    amplitudeWu *= TERRAIN_ROUGHNESS_DECAY;
    stride = halfStride;
  }

  return samples;
}

/** Two sweeps of a Lipschitz limiter: peaks the knob rejects are shaved from both sides. */
function limitSlope(samples: number[], maxStepWu: number): void {
  for (let index = 1; index < samples.length; index++) {
    samples[index] = clamp(
      samples[index],
      samples[index - 1] - maxStepWu,
      samples[index - 1] + maxStepWu
    );
  }

  for (let index = samples.length - 2; index >= 0; index--) {
    samples[index] = clamp(
      samples[index],
      samples[index + 1] - maxStepWu,
      samples[index + 1] + maxStepWu
    );
  }
}

function resample(samples: readonly number[], columnCount: number): number[] {
  const lastSampleIndex = samples.length - 1;

  return Array.from({ length: columnCount }, (_unused, columnIndex) => {
    const position = (columnIndex * lastSampleIndex) / Math.max(1, columnCount - 1);
    const lowerIndex = Math.min(lastSampleIndex, Math.floor(position));
    const upperIndex = Math.min(lastSampleIndex, lowerIndex + 1);
    const blend = position - lowerIndex;
    const height = samples[lowerIndex] * (1 - blend) + samples[upperIndex] * blend;

    return clamp(height, MIN_TERRAIN_HEIGHT_WU, MAX_TERRAIN_HEIGHT_WU);
  });
}

export function generateTerrainHeights(
  options: TerrainOptions,
  columnCount: number = TERRAIN_COLUMN_COUNT
): readonly number[] {
  const samples = createDisplacedSamples(options.bumpiness, options.slope);
  const samplesPerColumn = (samples.length - 1) / Math.max(1, columnCount - 1);
  const flatten = clamp(options.flattenPeaks, 0, MAX_TERRAIN_KNOB) / MAX_TERRAIN_KNOB;
  const maxStepWuPerColumn =
    UNFLATTENED_MAX_STEP_WU_PER_COLUMN +
    (FULLY_FLATTENED_MAX_STEP_WU_PER_COLUMN - UNFLATTENED_MAX_STEP_WU_PER_COLUMN) * flatten;

  limitSlope(samples, maxStepWuPerColumn / samplesPerColumn);

  return resample(samples, columnCount);
}

export function generateTerrain(
  options: TerrainOptions,
  columnCount: number = TERRAIN_COLUMN_COUNT
): Heightfield {
  return createHeightfield(generateTerrainHeights(options, columnCount));
}
