import { describe, expect, it } from 'vitest';

import type { MultiPolygon, Ring } from '../geometry/polygon-types';
import type { AnalysisRaster, RampColor } from './analysis-raster';
import {
  buildCutFillRaster,
  buildSlopeRaster,
  CUT_FILL_RAMP,
  SLOPE_RAMP,
  toCssColor,
} from './analysis-raster';
import type { Heightfield } from './heightfield';

const RESOLUTION = 11;
const CHANNELS_PER_TEXEL = 4;

/** An 11 x 11 grid of one-metre cells over the square [0, 10]². */
function createGrid(elevationAt: (column: number, row: number) => number): Heightfield {
  const heights = new Float32Array(RESOLUTION * RESOLUTION);

  for (let row = 0; row < RESOLUTION; row += 1) {
    for (let column = 0; column < RESOLUTION; column += 1) {
      heights[row * RESOLUTION + column] = elevationAt(column, row);
    }
  }

  return { resolution: RESOLUTION, originMeters: { x: 0, y: 0 }, cellSizeMeters: 1, heights };
}

/** Counter-clockwise, as the boolean fold leaves an outer ring. */
function rectangle(minX: number, minY: number, maxX: number, maxY: number): Ring {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

/** Covers the samples at columns 2 to 6 of rows 2 to 6. */
const FOOTPRINT: MultiPolygon = [{ outer: rectangle(2, 2, 6, 6), holes: [] }];

function coverEverything(): Float32Array {
  return new Float32Array(RESOLUTION * RESOLUTION).fill(1);
}

function readTexel(
  raster: AnalysisRaster,
  column: number,
  row: number
): RampColor & { alpha: number } {
  const offset = (row * raster.widthTexels + column) * CHANNELS_PER_TEXEL;

  return {
    red: raster.pixels[offset],
    green: raster.pixels[offset + 1],
    blue: raster.pixels[offset + 2],
    alpha: raster.pixels[offset + 3],
  };
}

describe('buildSlopeRaster', () => {
  it('spans the grid it colours, texel for sample', () => {
    const field = createGrid(() => 0);

    const raster = buildSlopeRaster(field, coverEverything());

    expect(raster.widthTexels).toBe(RESOLUTION);
    expect(raster.heightTexels).toBe(RESOLUTION);
    expect(raster.originMeters).toEqual(field.originMeters);
    expect(raster.cellSizeMeters).toBe(field.cellSizeMeters);
    expect(raster.pixels).toHaveLength(RESOLUTION * RESOLUTION * CHANNELS_PER_TEXEL);
  });

  it('paints level ground the gentle end of the ramp', () => {
    const raster = buildSlopeRaster(
      createGrid(() => 2),
      coverEverything()
    );

    const texel = readTexel(raster, 5, 5);

    expect(texel.red).toBe(SLOPE_RAMP.gentle.red);
    expect(texel.green).toBe(SLOPE_RAMP.gentle.green);
    expect(texel.blue).toBe(SLOPE_RAMP.gentle.blue);
    expect(texel.alpha).toBeGreaterThan(0);
  });

  it('paints ground past the steep threshold the red end of the ramp', () => {
    // Twenty per cent, well clear of the blend around the 12 % threshold.
    const raster = buildSlopeRaster(
      createGrid(column => column * 0.2),
      coverEverything()
    );

    const texel = readTexel(raster, 5, 5);

    expect(texel.red).toBe(SLOPE_RAMP.steep.red);
    expect(texel.green).toBe(SLOPE_RAMP.steep.green);
    expect(texel.blue).toBe(SLOPE_RAMP.steep.blue);
  });

  it('paints ground between the thresholds the amber step', () => {
    // Eight per cent: past the first threshold, short of the second.
    const raster = buildSlopeRaster(
      createGrid(column => column * 0.08),
      coverEverything()
    );

    const texel = readTexel(raster, 5, 5);

    expect(texel.red).toBe(SLOPE_RAMP.moderate.red);
    expect(texel.green).toBe(SLOPE_RAMP.moderate.green);
    expect(texel.blue).toBe(SLOPE_RAMP.moderate.blue);
  });

  it('eases across a threshold instead of stepping at it', () => {
    const raster = buildSlopeRaster(
      createGrid(column => column * 0.05),
      coverEverything()
    );

    const texel = readTexel(raster, 5, 5);

    // Exactly five per cent — halfway through the blend, so neither step's own
    // colour, and between the two of them on every channel.
    expect(texel.green).toBeGreaterThan(SLOPE_RAMP.moderate.green);
    expect(texel.green).toBeLessThan(SLOPE_RAMP.gentle.green);
  });

  it('leaves every sample beyond the plot transparent', () => {
    const coverage = new Float32Array(RESOLUTION * RESOLUTION);

    coverage[5 * RESOLUTION + 5] = 1;

    const raster = buildSlopeRaster(
      createGrid(column => column * 0.2),
      coverage
    );

    expect(readTexel(raster, 5, 5).alpha).toBeGreaterThan(0);
    expect(readTexel(raster, 4, 5).alpha).toBe(0);
    expect(readTexel(raster, 0, 0).alpha).toBe(0);
  });
});

describe('buildCutFillRaster', () => {
  it('paints the ground the pad sits below in the cut colour', () => {
    const raster = buildCutFillRaster(
      createGrid(() => 5),
      [{ polygons: FOOTPRINT, padElevation: 4 }]
    );

    const texel = readTexel(raster, 4, 4);

    expect(texel.red).toBe(CUT_FILL_RAMP.cut.red);
    expect(texel.green).toBe(CUT_FILL_RAMP.cut.green);
    expect(texel.blue).toBe(CUT_FILL_RAMP.cut.blue);
  });

  it('paints the ground the pad stands above in the fill colour', () => {
    const raster = buildCutFillRaster(
      createGrid(() => 5),
      [{ polygons: FOOTPRINT, padElevation: 6 }]
    );

    const texel = readTexel(raster, 4, 4);

    expect(texel.red).toBe(CUT_FILL_RAMP.fill.red);
    expect(texel.green).toBe(CUT_FILL_RAMP.fill.green);
    expect(texel.blue).toBe(CUT_FILL_RAMP.fill.blue);
  });

  it('colours deeper earthworks more strongly', () => {
    const shallow = buildCutFillRaster(
      createGrid(() => 5),
      [{ polygons: FOOTPRINT, padElevation: 5.1 }]
    );
    const deep = buildCutFillRaster(
      createGrid(() => 5),
      [{ polygons: FOOTPRINT, padElevation: 6 }]
    );

    expect(readTexel(deep, 4, 4).alpha).toBeGreaterThan(readTexel(shallow, 4, 4).alpha);
  });

  it('leaves a pad already level with the ground transparent', () => {
    // Five millimetres: under the centimetre nobody would move soil for.
    const raster = buildCutFillRaster(
      createGrid(() => 5),
      [{ polygons: FOOTPRINT, padElevation: 5.005 }]
    );

    expect(readTexel(raster, 4, 4).alpha).toBe(0);
  });

  it('leaves every sample outside the footprint transparent', () => {
    const raster = buildCutFillRaster(
      createGrid(() => 5),
      [{ polygons: FOOTPRINT, padElevation: 6 }]
    );

    expect(readTexel(raster, 0, 0).alpha).toBe(0);
    expect(readTexel(raster, 8, 8).alpha).toBe(0);
  });
});

describe('toCssColor', () => {
  it('writes a ramp colour the legend can wear', () => {
    expect(toCssColor(SLOPE_RAMP.steep)).toBe('rgb(255 79 88)');
  });
});
