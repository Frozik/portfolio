import { describe, expect, it } from 'vitest';

import { createStair } from '../model/stairs';
import {
  deriveStairRun,
  isStairRunComfortable,
  spiralGoingMeters,
  stairExitPoint,
  stairFootprint,
  stairLayout,
} from './stair-footprint';

const STANDARD_HEIGHT = 2.7;

describe('deriveStairRun', () => {
  it('stretches the run to a standard storey at comfortable steps', () => {
    const run = deriveStairRun(STANDARD_HEIGHT);

    expect(run.riserCount).toBe(16);
    expect(run.riserMeters * run.riserCount).toBeCloseTo(STANDARD_HEIGHT);
    expect(isStairRunComfortable(run)).toBe(true);
  });

  it('re-derives when the storey grows, keeping the riser in band', () => {
    const run = deriveStairRun(3.2);

    expect(run.riserMeters).toBeGreaterThanOrEqual(0.15);
    expect(run.riserMeters).toBeLessThanOrEqual(0.19);
    expect(run.riserMeters * run.riserCount).toBeCloseTo(3.2);
  });

  it('flags an absurdly low storey instead of refusing it', () => {
    const run = deriveStairRun(0.2);

    expect(run.riserCount).toBe(2);
    expect(isStairRunComfortable(run)).toBe(false);
  });
});

describe('stairLayout', () => {
  it('accounts every riser exactly once across the flights', () => {
    for (const kind of ['straight', 'l-shaped', 'u-shaped', 'spiral'] as const) {
      const layout = stairLayout(kind, STANDARD_HEIGHT, 1.0);
      const climbed = layout.flights.reduce((total, flight) => total + flight.riserCount, 0);

      expect(climbed).toBe(layout.run.riserCount);
    }
  });

  it('runs a straight flight one tread short of the riser count', () => {
    const layout = stairLayout('straight', STANDARD_HEIGHT, 1.0);

    expect(layout.flights).toHaveLength(1);
    expect(layout.flights[0].lengthMeters).toBeCloseTo(
      (layout.run.riserCount - 1) * layout.run.treadMeters
    );
  });

  it('lands the l-shape a quarter turn away from the start', () => {
    const layout = stairLayout('l-shaped', STANDARD_HEIGHT, 1.0);

    expect(layout.flights).toHaveLength(3);
    expect(layout.exitPoint.x).toBeCloseTo(layout.halfSize.x);
  });
});

describe('stairFootprint', () => {
  it('boxes a straight flight to its width and derived length', () => {
    const stair = createStair({ kind: 'straight', position: { x: 10, y: 5 } });
    const [polygon] = stairFootprint(stair, STANDARD_HEIGHT);
    const xs = polygon.outer.map(point => point.x);
    const ys = polygon.outer.map(point => point.y);
    const layout = stairLayout('straight', STANDARD_HEIGHT, stair.widthMeters);

    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(stair.widthMeters);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(layout.flights[0].lengthMeters);
  });

  it('turns the footprint with the instance rotation', () => {
    const stair = createStair({
      kind: 'straight',
      position: { x: 0, y: 0 },
      rotationDegrees: 90,
    });
    const [polygon] = stairFootprint(stair, STANDARD_HEIGHT);
    const xs = polygon.outer.map(point => point.x);

    const layout = stairLayout('straight', STANDARD_HEIGHT, stair.widthMeters);

    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(layout.flights[0].lengthMeters);
  });

  it('draws the spiral as one closed ring around the centre', () => {
    const stair = createStair({ kind: 'spiral', position: { x: 3, y: 3 } });
    const polygons = stairFootprint(stair, STANDARD_HEIGHT);

    expect(polygons).toHaveLength(1);

    for (const point of polygons[0].outer) {
      const distance = Math.hypot(point.x - 3, point.y - 3);

      expect(distance).toBeCloseTo(stair.widthMeters / 2);
    }
  });
});

describe('stairExitPoint', () => {
  it('tops a straight flight out at its far end', () => {
    const stair = createStair({ kind: 'straight', position: { x: 0, y: 0 } });
    const exit = stairExitPoint(stair, STANDARD_HEIGHT);
    const layout = stairLayout('straight', STANDARD_HEIGHT, stair.widthMeters);

    expect(exit.x).toBeCloseTo(0);
    expect(exit.y).toBeCloseTo(layout.halfSize.y);
  });

  it('rotates the exit with the instance', () => {
    const stair = createStair({
      kind: 'straight',
      position: { x: 0, y: 0 },
      rotationDegrees: 90,
    });
    const exit = stairExitPoint(stair, STANDARD_HEIGHT);
    const layout = stairLayout('straight', STANDARD_HEIGHT, stair.widthMeters);

    expect(exit.x).toBeCloseTo(-layout.halfSize.y);
    expect(exit.y).toBeCloseTo(0);
  });
});

describe('spiral comfort', () => {
  it('flags a narrow spiral whose going is too short underfoot', () => {
    const stair = createStair({ kind: 'spiral', position: { x: 0, y: 0 }, widthMeters: 1.2 });
    const run = deriveStairRun(STANDARD_HEIGHT);

    // The straight-flight tread would call this fine; the walking line does not.
    expect(isStairRunComfortable(run)).toBe(true);
    expect(isStairRunComfortable(run, stair)).toBe(false);
  });

  it('accepts a spiral wide enough to walk down', () => {
    const stair = createStair({ kind: 'spiral', position: { x: 0, y: 0 }, widthMeters: 2 });
    const run = deriveStairRun(STANDARD_HEIGHT);

    expect(isStairRunComfortable(run, stair)).toBe(true);
  });

  it('gives a wider spiral a longer going underfoot', () => {
    expect(spiralGoingMeters(2)).toBeGreaterThan(spiralGoingMeters(1.4));
  });
});
