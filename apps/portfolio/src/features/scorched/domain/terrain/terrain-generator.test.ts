import { random } from 'lodash-es';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_TERRAIN_OPTIONS,
  MAX_TERRAIN_HEIGHT_WU,
  MIN_TERRAIN_HEIGHT_WU,
  TERRAIN_COLUMN_COUNT,
} from '../constants';
import type { TerrainOptions } from '../types';
import { getSurfaceHeight } from './heightfield';
import { generateTerrain, generateTerrainHeights } from './terrain-generator';

vi.mock('lodash-es', async importOriginal => {
  const actual = await importOriginal<typeof import('lodash-es')>();

  return { ...actual, random: vi.fn() };
});

const randomMock = vi.mocked(random);

const COLUMN_COUNT = 200;
/** An irrational stride keeps the draw sequence varied without repeating along the samples. */
const DRAW_STRIDE = Math.SQRT2;

/** Replays the same varied, fully deterministic draw sequence for every generator run. */
function pinRandomDraws(): void {
  let drawIndex = 0;

  randomMock.mockReset();
  randomMock.mockImplementation(() => {
    drawIndex++;

    return Math.sin(drawIndex * DRAW_STRIDE);
  });
}

function createOptions(overrides: Partial<TerrainOptions> = {}): TerrainOptions {
  return { ...DEFAULT_TERRAIN_OPTIONS, ...overrides };
}

function getHeightRange(heights: readonly number[]): number {
  return Math.max(...heights) - Math.min(...heights);
}

function getMaxAdjacentStep(heights: readonly number[]): number {
  let maxStep = 0;

  for (let index = 1; index < heights.length; index++) {
    maxStep = Math.max(maxStep, Math.abs(heights[index] - heights[index - 1]));
  }

  return maxStep;
}

beforeEach(() => {
  pinRandomDraws();
});

describe('generateTerrainHeights', () => {
  it('produces one height per column', () => {
    expect(generateTerrainHeights(createOptions(), COLUMN_COUNT)).toHaveLength(COLUMN_COUNT);
    expect(generateTerrainHeights(createOptions())).toHaveLength(TERRAIN_COLUMN_COUNT);
  });

  it('is deterministic for the same draw sequence', () => {
    const first = generateTerrainHeights(createOptions(), COLUMN_COUNT);

    pinRandomDraws();

    expect(generateTerrainHeights(createOptions(), COLUMN_COUNT)).toEqual(first);
  });

  it('stays inside the terrain bounds even at the extreme knobs', () => {
    const heights = generateTerrainHeights(
      createOptions({ bumpiness: 100, slope: 100, flattenPeaks: 0 }),
      COLUMN_COUNT
    );

    expect(Math.min(...heights)).toBeGreaterThanOrEqual(MIN_TERRAIN_HEIGHT_WU);
    expect(Math.max(...heights)).toBeLessThanOrEqual(MAX_TERRAIN_HEIGHT_WU);
  });

  it('is flat when bumpiness is zero and the field is level', () => {
    const heights = generateTerrainHeights(
      createOptions({ bumpiness: 0, slope: 0, flattenPeaks: 0 }),
      COLUMN_COUNT
    );

    expect(getHeightRange(heights)).toBeCloseTo(0);
  });

  it('grows rougher as Bumpiness rises', () => {
    const ranges = [0, 25, 50, 75].map(bumpiness => {
      pinRandomDraws();

      return getHeightRange(generateTerrainHeights(createOptions({ bumpiness }), COLUMN_COUNT));
    });

    for (let index = 1; index < ranges.length; index++) {
      expect(ranges[index]).toBeGreaterThan(ranges[index - 1]);
    }
  });

  it('tilts the field further to the right as Slope rises', () => {
    const tilts = [0, 25, 50, 100].map(slope => {
      pinRandomDraws();

      const heights = generateTerrainHeights(
        createOptions({ bumpiness: 0, slope, flattenPeaks: 0 }),
        COLUMN_COUNT
      );

      return heights[COLUMN_COUNT - 1] - heights[0];
    });

    for (let index = 1; index < tilts.length; index++) {
      expect(tilts[index]).toBeGreaterThan(tilts[index - 1]);
    }
  });

  it('tilts to the left on a negative Slope', () => {
    const heights = generateTerrainHeights(
      createOptions({ bumpiness: 0, slope: -100, flattenPeaks: 0 }),
      COLUMN_COUNT
    );

    expect(heights[COLUMN_COUNT - 1]).toBeLessThan(heights[0]);
  });

  it('shaves the steepest steps as Flatten Peaks rises', () => {
    const steps = [0, 40, 80, 100].map(flattenPeaks => {
      pinRandomDraws();

      return getMaxAdjacentStep(
        generateTerrainHeights(createOptions({ bumpiness: 100, flattenPeaks }), COLUMN_COUNT)
      );
    });

    for (let index = 1; index < steps.length; index++) {
      expect(steps[index]).toBeLessThan(steps[index - 1]);
    }
  });
});

describe('generateTerrain', () => {
  it('wraps the generated heights in a heightfield', () => {
    const field = generateTerrain(createOptions(), COLUMN_COUNT);

    expect(field).toHaveLength(COLUMN_COUNT);
    expect(getSurfaceHeight(field, 0)).toBeGreaterThanOrEqual(MIN_TERRAIN_HEIGHT_WU);
  });
});
