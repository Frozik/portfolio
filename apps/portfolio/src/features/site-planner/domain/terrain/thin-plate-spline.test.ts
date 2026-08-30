import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { describe, expect, it } from 'vitest';

import type { ElevationSample } from './elevation-sample';
import { fitThinPlateSpline } from './thin-plate-spline';

/** A plane that is not axis aligned, so a wrong coefficient cannot hide. */
function planeElevation(x: number, y: number): number {
  return 1.5 + 0.25 * x - 0.1 * y;
}

/**
 * A scattered set of marks over a plot-sized square. Irregular enough that the
 * solver has to pivot, and reproducible run to run — a survey never repeats, but
 * a failing test has to.
 */
function scatteredSamples(count: number): readonly ElevationSample[] {
  const samples: ElevationSample[] = [];

  for (let index = 0; index < count; index += 1) {
    samples.push({
      position: {
        x: 20 + 18 * Math.sin(index * 2.399963),
        y: 20 + 18 * Math.cos(index * 1.618034),
      },
      elevation: 3 * Math.sin(index * 0.7) + 0.4 * index,
    });
  }

  return samples;
}

describe('fitThinPlateSpline', () => {
  it('reproduces the elevation of every mark it was fitted to', () => {
    const samples = scatteredSamples(24);
    const surface = fitThinPlateSpline(samples);

    assert(!isNil(surface), 'scattered marks are expected to admit a spline');

    for (const sample of samples) {
      expect(surface(sample.position.x, sample.position.y)).toBeCloseTo(sample.elevation, 8);
    }
  });

  it('reproduces a plane exactly, far outside the marks it was fitted to', () => {
    // The affine tail carries the plane on its own, so the kernel weights come
    // out zero and the surface stays exact however far it is extrapolated.
    const surface = fitThinPlateSpline(
      scatteredSamples(9).map(sample => ({
        position: sample.position,
        elevation: planeElevation(sample.position.x, sample.position.y),
      }))
    );

    assert(!isNil(surface), 'scattered marks are expected to admit a spline');

    for (const [x, y] of [
      [0, 0],
      [40, 40],
      [-500, 300],
      [1200, -800],
    ]) {
      expect(surface(x, y)).toBeCloseTo(planeElevation(x, y), 6);
    }
  });

  it('is as symmetric as the marks it was fitted to', () => {
    const surface = fitThinPlateSpline([
      { position: { x: -10, y: 0 }, elevation: 1 },
      { position: { x: 10, y: 0 }, elevation: 1 },
      { position: { x: 0, y: 12 }, elevation: -2 },
      { position: { x: 0, y: -12 }, elevation: -2 },
    ]);

    assert(!isNil(surface), 'the four marks are expected to admit a spline');

    for (const [x, y] of [
      [3, 5],
      [7, 1],
      [15, 20],
      [0.5, -9],
    ]) {
      expect(surface(-x, y)).toBeCloseTo(surface(x, y), 9);
      expect(surface(x, -y)).toBeCloseTo(surface(x, y), 9);
    }
  });

  it('declines marks that cannot bend a sheet', () => {
    expect(fitThinPlateSpline([])).toBeUndefined();
    expect(fitThinPlateSpline([{ position: { x: 1, y: 2 }, elevation: 3 }])).toBeUndefined();
    expect(
      fitThinPlateSpline([
        { position: { x: 1, y: 2 }, elevation: 3 },
        { position: { x: 5, y: 9 }, elevation: 4 },
      ])
    ).toBeUndefined();
  });

  it('declines marks that share a line', () => {
    expect(
      fitThinPlateSpline([
        { position: { x: 0, y: 0 }, elevation: 0 },
        { position: { x: 5, y: 5 }, elevation: 2 },
        { position: { x: 10, y: 10 }, elevation: 4 },
      ])
    ).toBeUndefined();

    // A millimetre off the line over twenty metres is the same line to a survey,
    // and an all-but-singular system to the solver.
    expect(
      fitThinPlateSpline([
        { position: { x: 0, y: 0 }, elevation: 0 },
        { position: { x: 5, y: 5.001 }, elevation: 2 },
        { position: { x: 10, y: 10 }, elevation: 4 },
      ])
    ).toBeUndefined();
  });

  it('declines marks that all coincide', () => {
    expect(
      fitThinPlateSpline([
        { position: { x: 7, y: 7 }, elevation: 2 },
        { position: { x: 7, y: 7 }, elevation: 2 },
        { position: { x: 7, y: 7 }, elevation: 2 },
      ])
    ).toBeUndefined();
  });
});
