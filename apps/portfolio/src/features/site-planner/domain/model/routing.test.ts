import { describe, expect, it } from 'vitest';

import {
  createUtilityRoute,
  parallelSeparationMeters,
  routeLengthMeters,
  sewerSlopeFor,
  trenchDepthMeters,
} from './routing';

describe('trenchDepthMeters', () => {
  it('digs each system to its norm against the frost line', () => {
    expect(trenchDepthMeters('water', 1.5)).toBeCloseTo(2);
    expect(trenchDepthMeters('sewer', 1.5)).toBeCloseTo(1.8);
    expect(trenchDepthMeters('power', 1.5)).toBeCloseTo(0.7);
    expect(trenchDepthMeters('network', 1.5)).toBeCloseTo(0.7);
    // Gas digs to the СП 62 cover: its FACADE entry depth does not apply here.
    expect(trenchDepthMeters('gas', 1.5)).toBeCloseTo(0.8);
  });

  it('follows an edited frost depth', () => {
    expect(trenchDepthMeters('water', 2.2)).toBeCloseTo(2.7);
  });
});

describe('parallelSeparationMeters', () => {
  it('reads the pair in either order', () => {
    expect(parallelSeparationMeters('water', 'sewer')).toBeCloseTo(1.5);
    expect(parallelSeparationMeters('sewer', 'water')).toBeCloseTo(1.5);
  });

  it('rules nothing for a pair the table does not seat', () => {
    expect(parallelSeparationMeters('water', 'water')).toBeUndefined();
  });
});

describe('sewerSlopeFor', () => {
  it('picks the rule of the largest pipe that fits the bore', () => {
    expect(sewerSlopeFor(0.11).recommended).toBeCloseTo(0.02);
    expect(sewerSlopeFor(0.05).recommended).toBeCloseTo(0.03);
    expect(sewerSlopeFor(0.16).recommended).toBeCloseTo(0.02);
  });

  it('falls back to the smallest tabled pipe below the table', () => {
    expect(sewerSlopeFor(0.032).min).toBeCloseTo(0.02);
  });
});

describe('createUtilityRoute', () => {
  it('gives only a sewer a bore', () => {
    const sewer = createUtilityRoute({ system: 'sewer', points: [] });
    const water = createUtilityRoute({ system: 'water', points: [] });

    expect(sewer.diameterMeters).toBeCloseTo(0.11);
    expect(water.diameterMeters).toBeUndefined();
  });
});

describe('routeLengthMeters', () => {
  it('sums the drawn segments', () => {
    expect(
      routeLengthMeters([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 4 },
      ])
    ).toBeCloseTo(7);
  });
});
