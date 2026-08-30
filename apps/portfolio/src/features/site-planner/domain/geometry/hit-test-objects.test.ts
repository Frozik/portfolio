import { describe, expect, it } from 'vitest';

import { CAR_LENGTH_METERS, CAR_WIDTH_METERS } from '../constants';
import type { CarInstance, SitePath, TreeInstance } from '../model/site-plan';
import { createCar, createSitePath, createTree } from '../model/site-plan';
import { distanceToPolyline, hitTestCar, hitTestPath, hitTestTree } from './hit-test-objects';

const NO_TOLERANCE = 0;
const HALF = 0.5;
/** Clear of the outline by more than any rounding, in metres. */
const MARGIN = 0.01;

function tree(): TreeInstance {
  return createTree({
    species: 'spruce',
    position: { x: 10, y: 10 },
    crownRadius: 2,
    height: 6,
  });
}

function car(rotationDegrees: number): CarInstance {
  return createCar({ position: { x: 10, y: 10 }, rotationDegrees });
}

/** An L: four metres east, then four metres north. */
function elbowPath(): SitePath {
  return createSitePath({
    points: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
    ],
    width: 1,
  });
}

describe('distanceToPolyline', () => {
  it('measures to the nearest segment, not to the nearest vertex', () => {
    expect(
      distanceToPolyline(
        elbowPath().points.map(point => point.position),
        { x: 2, y: 1 }
      )
    ).toBeCloseTo(1);
  });

  it('measures to an end point past the end of the line', () => {
    expect(
      distanceToPolyline(
        elbowPath().points.map(point => point.position),
        { x: -3, y: 4 }
      )
    ).toBeCloseTo(5);
  });

  it('measures to the single point of a polyline that has only one', () => {
    expect(distanceToPolyline([{ x: 1, y: 1 }], { x: 4, y: 5 })).toBeCloseTo(5);
  });

  it('leaves an empty polyline unreachable', () => {
    expect(distanceToPolyline([], { x: 0, y: 0 })).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('hitTestTree', () => {
  it('answers inside the crown and stays silent outside it', () => {
    expect(hitTestTree(tree(), { x: 11.5, y: 10 }, NO_TOLERANCE)).toBe(true);
    expect(hitTestTree(tree(), { x: 12.5, y: 10 }, NO_TOLERANCE)).toBe(false);
  });

  it('grows the crown by the pick tolerance', () => {
    expect(hitTestTree(tree(), { x: 12.5, y: 10 }, 1)).toBe(true);
  });
});

describe('hitTestCar', () => {
  it('answers over the body of a car facing east', () => {
    const eastbound = car(0);

    expect(hitTestCar(eastbound, { x: 12, y: 10 }, NO_TOLERANCE)).toBe(true);
    expect(
      hitTestCar(eastbound, { x: 10 + CAR_LENGTH_METERS * HALF - MARGIN, y: 10 }, NO_TOLERANCE)
    ).toBe(true);
    expect(
      hitTestCar(eastbound, { x: 10 + CAR_LENGTH_METERS * HALF + MARGIN, y: 10 }, NO_TOLERANCE)
    ).toBe(false);
    expect(
      hitTestCar(eastbound, { x: 10, y: 10 + CAR_WIDTH_METERS * HALF + MARGIN }, NO_TOLERANCE)
    ).toBe(false);
  });

  it('turns the body with the car', () => {
    const northbound = car(90);

    // What the nose covered facing east is now beside the car, and vice versa.
    expect(hitTestCar(northbound, { x: 12, y: 10 }, NO_TOLERANCE)).toBe(false);
    expect(
      hitTestCar(northbound, { x: 10, y: 10 + CAR_LENGTH_METERS * HALF - MARGIN }, NO_TOLERANCE)
    ).toBe(true);
  });

  it('grows the body by the pick tolerance', () => {
    expect(hitTestCar(car(0), { x: 10, y: 10 + CAR_WIDTH_METERS * HALF + 0.5 }, 1)).toBe(true);
  });
});

describe('hitTestPath', () => {
  it('answers within half the width of the ribbon', () => {
    expect(hitTestPath(elbowPath(), { x: 2, y: 0.4 }, NO_TOLERANCE)).toBe(true);
    expect(hitTestPath(elbowPath(), { x: 2, y: 0.6 }, NO_TOLERANCE)).toBe(false);
  });

  it('answers around the elbow as well as along the straights', () => {
    expect(hitTestPath(elbowPath(), { x: 4.4, y: 2 }, NO_TOLERANCE)).toBe(true);
  });

  it('widens the answer where the ribbon itself widens', () => {
    const tapered: SitePath = {
      ...elbowPath(),
      points: [
        { position: { x: 0, y: 0 }, width: 1 },
        { position: { x: 4, y: 0 }, width: 3 },
      ],
    };

    expect(hitTestPath(tapered, { x: 2, y: 0.9 }, NO_TOLERANCE)).toBe(true);
    expect(hitTestPath(tapered, { x: 2, y: 1.1 }, NO_TOLERANCE)).toBe(false);
    expect(hitTestPath(tapered, { x: 0, y: 0.6 }, NO_TOLERANCE)).toBe(false);
    expect(hitTestPath(tapered, { x: 4, y: 1.4 }, NO_TOLERANCE)).toBe(true);
  });
});
